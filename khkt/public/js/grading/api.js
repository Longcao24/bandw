// AI grading client for POST /api/grade (Cloudflare Workers AI behind a Pages Function). Pure helpers are
// exported for node tests; gradeAnswer() is the only part that touches fetch.
//
// Request : POST /api/grade  { id, answer }   (JSON; NO learner code, NO model answer: the server looks the
//           question up in content/defense-index.js by id)
// Response: { score: 0–10, covered: [keyPoint index | text], missing: [...], factualErrors: [string],
//             feedback: string, improvedAnswer: string, model, fallback: boolean }
//           Field aliases are accepted (see normalizeResult) so small backend naming differences don't break UI.
// Errors  : 400 too_short | bad_request · 404 unknown_question · 413 too_long · 429 rate_limited | daily_limit
//           (Retry-After) · 503 ai_unavailable | no_ai · network / timeout. (Matches functions/api/grade.js.)

export const MIN_CHARS = 15;
export const MAX_CHARS = 2000;
export const TIMEOUT_MS = 35000;
export const ENDPOINT = '/api/grade';

import { fold } from './text.js';

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const str = (x) => (typeof x === 'string' ? x.trim() : x == null ? '' : typeof x === 'object' ? String(x.text || x.point || x.message || x.error || '').trim() : String(x).trim());
const arr = (...xs) => { for (const x of xs) if (Array.isArray(x)) return x; for (const x of xs) if (typeof x === 'string' && x.trim()) return [x]; return []; };

/** Score → 0–10 with one decimal. Accepts 0–1 fractions? No: only 0–10, or 0–100 percentages. */
export function normalizeScore(raw) {
  let n = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
  if (!isNum(n)) return null;
  if (n > 10 && n <= 100) n /= 10;
  n = Math.max(0, Math.min(10, n));
  return Math.round(n * 10) / 10;
}

function tokens(s) { return fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((w) => w.length > 1); }
/** Best key point index for a free-text point, or -1 when nothing overlaps enough. */
export function matchKeyPoint(text, keyPoints) {
  const t = fold(text);
  if (!t) return -1;
  let best = -1, bestScore = 0;
  keyPoints.forEach((k, i) => {
    const fk = fold(k).replace(/[`*]/g, '');
    if (fk && (t.includes(fk) || fk.includes(t))) { if (bestScore < 2) { best = i; bestScore = 2; } return; }
    const a = new Set(tokens(k)), b = tokens(text);
    if (!a.size || !b.length) return;
    const hit = b.filter((w) => a.has(w)).length;
    const s = hit / Math.min(a.size, new Set(b).size);
    if (s > bestScore) { best = i; bestScore = s; }
  });
  return bestScore >= 0.5 ? best : -1;
}

/** Turns a list of covered points (indices 0- or 1-based, texts, or {index|point, covered}) into index sets. */
function toIndices(list, keyPoints) {
  const n = keyPoints.length;
  const ints = list.filter((x) => Number.isInteger(x) || (typeof x === 'string' && /^\d+$/.test(x.trim()))).map(Number);
  const oneBased = ints.length > 0 && !ints.includes(0) && ints.every((x) => x >= 1 && x <= n) && ints.includes(n);
  const out = new Set();
  for (const x of list) {
    let i = -1;
    if (Number.isInteger(x) || (typeof x === 'string' && /^\d+$/.test(x.trim()))) i = Number(x) - (oneBased ? 1 : 0);
    else if (x && typeof x === 'object' && Number.isInteger(x.index)) i = x.index;
    else i = matchKeyPoint(str(x), keyPoints);
    if (i >= 0 && i < n) out.add(i);
  }
  return out;
}

/**
 * normalizeResult(json, keyPoints) → { score, points: [{ text, ok }], covered: [idx], extraMissing: [text],
 * errors: [text], feedback, improved } or null when the payload has no usable score.
 */
export function normalizeResult(json, keyPoints = []) {
  if (!json || typeof json !== 'object') return null;
  const j = json.result && typeof json.result === 'object' ? json.result : json;
  const score = normalizeScore(j.score ?? j.total ?? j.diem ?? j.grade);
  if (score === null) return null;
  let covered = new Set();
  const detailed = arr(j.keyPoints, j.key_points, j.points).filter((p) => p && typeof p === 'object' && 'covered' in p);
  if (detailed.length) {
    detailed.forEach((p, k) => {
      if (!p.covered) return;
      const i = Number.isInteger(p.index) ? p.index : (p.point || p.text ? matchKeyPoint(str(p), keyPoints) : k);
      if (i >= 0 && i < keyPoints.length) covered.add(i);
    });
  } else {
    covered = toIndices(arr(j.covered, j.coveredKeyPoints, j.covered_points, j.coveredPoints), keyPoints);
  }
  const missingRaw = arr(j.missing, j.missingKeyPoints, j.missing_points, j.missingPoints).map((x) => (Number.isInteger(x) ? x : str(x)));
  // missing texts that are not one of the key points are shown as extra hints
  const extraMissing = [];
  for (const m of missingRaw) {
    if (Number.isInteger(m)) continue;
    const i = matchKeyPoint(m, keyPoints);
    if (i < 0 && m) extraMissing.push(m);
  }
  const errors = arr(j.factualErrors, j.factual_errors, j.errors, j.mistakes).map(str).filter(Boolean).slice(0, 8);
  const points = keyPoints.map((text, i) => ({ text, ok: covered.has(i) }));
  return {
    score, points, covered: [...covered].sort((a, b) => a - b), extraMissing: extraMissing.slice(0, 6), errors,
    feedback: str(j.feedback ?? j.comment ?? j.nhanXet).slice(0, 2000),
    improved: str(j.improvedAnswer ?? j.improved_answer ?? j.improved ?? j.betterAnswer ?? j.suggestedAnswer).slice(0, 3000),
    // Graded by the backup model (the main one was busy/slow): shown, but not kept as the best score.
    fallback: j.fallback === true,
  };
}

/** Friendly Vietnamese message for a failed grading. kind: 'rate' | 'busy' | 'short' | 'long' | 'missing' | 'network' | 'timeout' | 'bad' */
export function errorMessage(kind, { retryAfter } = {}) {
  switch (kind) {
    case 'rate': {
      const s = Number(retryAfter) > 0 ? Math.min(3600, Math.round(Number(retryAfter))) : 60;
      return `Em chấm hơi nhanh rồi 😅 Máy chấm cần nghỉ một chút: đợi khoảng ${s} giây rồi bấm chấm lại nhé.`;
    }
    case 'busy': return 'Máy chấm AI đang bận hoặc tạm nghỉ. Trong lúc chờ, em tự đối chiếu với câu trả lời mẫu, lát nữa thử lại nhé.';
    case 'short': return `Câu trả lời ngắn quá để chấm. Em viết (hoặc đọc) ít nhất ${MIN_CHARS} ký tự, nói đủ ý chính → dẫn chứng → giới hạn.`;
    case 'long': return `Câu trả lời dài quá (tối đa ${MAX_CHARS} ký tự). Ở phòng thi em chỉ có khoảng 1 phút: thử nói gọn lại nhé.`;
    case 'daily': return 'Hôm nay máy chấm đã làm việc rất nhiều lần. Mai em luyện tiếp nhé; trong lúc đó tự chấm theo các ý chính và câu trả lời mẫu.';
    case 'unknown': return 'Máy chấm chưa có câu hỏi này (có thể trang vừa được cập nhật). Em tải lại trang rồi thử lại nhé.';
    case 'missing': return 'Máy chấm AI chưa được bật trên trang này. Em tự chấm bằng các ý chính bên dưới nhé.';
    case 'timeout': return 'Máy chấm trả lời lâu quá nên đã dừng chờ. Em bấm chấm lại sau ít phút nhé.';
    case 'network': return 'Không kết nối được tới máy chấm. Em kiểm tra mạng (Wi-Fi/4G) rồi thử lại.';
    default: return 'Máy chấm trả lời không đọc được. Em thử chấm lại nhé.';
  }
}

/** HTTP status (+ server error code) → error kind. */
export function errorKind(status, code = '') {
  if (code === 'daily_limit') return 'daily';
  if (status === 429) return 'rate';
  if (code === 'no_ai') return 'missing';
  if (code === 'unknown_question') return 'unknown';
  if (status === 413 || code === 'too_long') return 'long';
  if (code === 'too_short' || code === 'empty') return 'short';
  if (status === 404 && code !== 'unknown_question') return 'missing';
  if (status === 405 || status === 501) return 'missing';
  if (status === 503 || status === 502 || status === 504 || status >= 500) return 'busy';
  return 'bad';
}

export class GradeError extends Error {
  constructor(kind, info = {}) { super(errorMessage(kind, info)); this.kind = kind; this.retryAfter = info.retryAfter || null; this.status = info.status || 0; }
}

/** Client-side checks before calling the server. Returns an error kind or null. */
export function checkAnswer(answer) {
  const t = String(answer || '').trim();
  if (t.length < MIN_CHARS) return 'short';
  if (t.length > MAX_CHARS) return 'long';
  return null;
}

/** POSTs one answer. Resolves to normalizeResult(...) or throws GradeError. */
export async function gradeAnswer({ id, answer, keyPoints = [], signal, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS }) {
  const bad = checkAnswer(answer);
  if (bad) throw new GradeError(bad);
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  const onAbort = () => ctl.abort();
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ id, answer: String(answer).trim() }), signal: ctl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (signal && signal.aborted) throw new GradeError('aborted');
    throw new GradeError(timedOut ? 'timeout' : 'network');
  } finally {
    if (signal) signal.removeEventListener('abort', onAbort);
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  clearTimeout(timer);
  if (!res.ok) {
    const ra = res.headers && res.headers.get ? res.headers.get('Retry-After') : null;
    throw new GradeError(errorKind(res.status, body && body.error), { retryAfter: ra || (body && body.retryAfter), status: res.status });
  }
  const out = normalizeResult(body, keyPoints);
  if (!out) throw new GradeError('bad', { status: res.status });
  return out;
}

/** 7,5 → "7,5"; 8 → "8" (Vietnamese decimal comma). */
export const fmtScore = (s) => (Math.round(s * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
/** Score band for colours/labels. */
export const scoreBand = (s) => (s >= 8 ? 'good' : s >= 5 ? 'ok' : 'low');
export const bandLabel = (s) => (s >= 8 ? 'Rất tốt! Đủ sức thuyết phục giám khảo.' : s >= 5 ? 'Khá rồi: bổ sung các ý còn thiếu.' : 'Cần ôn lại: xem câu trả lời mẫu rồi thử lần nữa.');
