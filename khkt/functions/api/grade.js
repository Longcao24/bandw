// Cloudflare Pages Function: POST /api/grade — chấm câu trả lời phản biện bằng Workers AI.
// Request : { questionId | id, answer }   (JSON, same-origin). The rubric (question, model answer, key points)
//           is looked up HERE from content/defense-index.js; anything rubric-like the client sends is ignored.
// Response: { questionId, score 0–10, covered:[i], missing:[i], factualErrors:[s], feedback, improvedAnswer,
//             keyPoints:[s], model, fallback }   (fallback: true = graded by the backup model; the client
//             shows it but does not keep it as the learner's best score)
// Privacy : answers are sent to the model and returned, never stored or logged.
import { byId, gradingPayload } from '../../public/content/defense-index.js';
import { hitWindow, ipHash } from '../_lib/ratelimit.js';
import {
  DEFAULT_MODEL, FALLBACK_MODEL, MIN_ANSWER, MAX_ANSWER, TIMEOUT_MS,
  cleanAnswer, buildMessages, runModel, extractContent, parseModelJson, normalizeGrade,
} from '../_lib/grading.js';

export const MAX_BODY_BYTES = 16384;
// A whole class often shares ONE school IP (NAT), so the per-IP buckets are classroom-sized (30 students ×
// ~4 grades/min, ~65/day each). The real cost bound is LIMIT_GLOBAL_PER_DAY (every model call counts).
export const LIMIT_IP_PER_MIN = 120;
export const LIMIT_IP_PER_DAY = 2000;
export const LIMIT_GLOBAL_PER_DAY = 5000;
// Primary 26 s + fallback 8 s stays inside the browser's 35 s wait (public/js/grading/api.js TIMEOUT_MS).
export const FALLBACK_TIMEOUT_MS = 8000;
const BASE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const ALLOW = 'POST, OPTIONS';

const MESSAGES = {
  bad_origin: 'Yêu cầu không hợp lệ.',
  bad_type: 'Cần gửi dữ liệu dạng JSON.',
  bad_request: 'Yêu cầu chấm bài không hợp lệ.',
  too_short: `Câu trả lời ngắn quá để chấm (cần ít nhất ${MIN_ANSWER} ký tự).`,
  too_long: `Câu trả lời dài quá (tối đa ${MAX_ANSWER} ký tự).`,
  unknown_question: 'Không tìm thấy câu hỏi này.',
  rate_limited: 'Em gửi hơi nhanh. Đợi khoảng một phút rồi chấm lại nhé.',
  daily_limit: 'Hôm nay máy này đã chấm rất nhiều lần. Mai em luyện tiếp nhé, hoặc tự chấm theo ý chính.',
  no_ai: 'Máy chấm AI chưa được bật trên trang này. Em tự chấm theo các ý chính nhé.',
  ai_unavailable: 'Máy chấm AI đang bận hoặc tạm nghỉ. Em thử lại sau ít phút nhé.',
  method_not_allowed: 'Phương thức không được hỗ trợ.',
};

function json(status, body, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}
const err = (status, code, extra = {}) => json(status, { error: code, message: MESSAGES[code] || '' }, extra);

function badOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return true;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return true;
  return false;
}

async function readJson(request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { status: 413 };
  let buf;
  try { buf = await request.arrayBuffer(); } catch { return { status: 400 }; }
  if (buf.byteLength > MAX_BODY_BYTES) return { status: 413 };
  try { return { value: JSON.parse(new TextDecoder().decode(buf)) }; } catch { return { status: 400 }; }
}

const untilTomorrow = (now) => String(Math.ceil((86400000 - (now % 86400000)) / 1000));
const CLOSED = { failOpen: false }; // the model is never exposed without a working limiter

/** Per-IP minute + day buckets and one global daily cap (bounds Workers AI cost). Fails closed. */
async function limit(db, request, now, rand) {
  const h = await ipHash(request);
  const key = h || 'unknown';
  const perMin = await hitWindow(db, 'gm:' + key, LIMIT_IP_PER_MIN, 1, now, rand, CLOSED);
  if (perMin.error) return { code: 'ai_unavailable', status: 503, retryAfter: '30' };
  if (!perMin.ok) return { code: 'rate_limited', retryAfter: String(60 - (Math.floor(now / 1000) % 60) || 60) };
  const perDay = await hitWindow(db, 'gd:' + key, LIMIT_IP_PER_DAY, 1440, now, rand, CLOSED);
  if (perDay.error) return { code: 'ai_unavailable', status: 503, retryAfter: '30' };
  if (!perDay.ok) return { code: 'daily_limit', retryAfter: untilTomorrow(now) };
  return globalHit(db, now, rand);
}
/** One model call against the site-wide daily cap. */
async function globalHit(db, now, rand) {
  const global = await hitWindow(db, 'gg:all', LIMIT_GLOBAL_PER_DAY, 1440, now, rand, CLOSED);
  if (global.error) return { code: 'ai_unavailable', status: 503, retryAfter: '30' };
  if (!global.ok) return { code: 'daily_limit', retryAfter: untilTomorrow(now) };
  return null;
}

/** One model attempt → normalized grade or null. Never logs the answer. */
async function attempt(ai, model, messages, rubric, answer, timeoutMs) {
  try {
    const res = await runModel(ai, model, messages, timeoutMs);
    return normalizeGrade(parseModelJson(extractContent(res)), rubric.length, { keyPoints: rubric, answer });
  } catch (e) {
    console.warn('grade: model call failed', model, e && e.message === 'timeout' ? 'timeout' : 'error');
    return null;
  }
}

/**
 * @param {Request} request
 * @param {{AI?: {run: Function}, DB?: object, GRADE_MODEL?: string, GRADE_FALLBACK_MODEL?: string}} env
 * @param {{now?: number, rand?: () => number, lookup?: (id: string) => object|null, timeoutMs?: number}} opts
 */
export async function handle(request, env = {}, opts = {}) {
  const now = opts.now ?? Date.now();
  const rand = opts.rand ?? Math.random;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', Allow: ALLOW } });
  if (method !== 'POST') return err(405, 'method_not_allowed', { Allow: ALLOW });
  if (badOrigin(request)) return err(403, 'bad_origin');

  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return err(415, 'bad_type');
  const body = await readJson(request);
  if (body.status === 413) return err(413, 'too_long');
  if (body.status) return err(400, 'bad_request');
  const input = body.value;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return err(400, 'bad_request');

  const questionId = input.questionId ?? input.id;
  if (typeof questionId !== 'string' || !questionId || questionId.length > 64) return err(400, 'bad_request');
  const answer = cleanAnswer(input.answer);
  if (answer === null) return err(400, 'bad_request');
  if (answer.length < MIN_ANSWER) return err(400, 'too_short');
  if (answer.length > MAX_ANSWER) return err(413, 'too_long');

  const lookup = opts.lookup || ((id) => gradingPayload(byId(id)));
  const q = lookup(questionId);
  if (!q || !q.modelAnswer || !Array.isArray(q.keyPoints) || !q.keyPoints.length) return err(404, 'unknown_question');

  if (!env.AI || typeof env.AI.run !== 'function') return err(503, 'no_ai');
  if (!env.DB) return err(503, 'ai_unavailable'); // no limiter → do not expose the model

  const limited = await limit(env.DB, request, now, rand);
  if (limited) return err(limited.status || 429, limited.code, { 'Retry-After': limited.retryAfter });

  const messages = buildMessages({ question: q.prompt, modelAnswer: q.modelAnswer, keyPoints: q.keyPoints }, answer);
  const primary = env.GRADE_MODEL || DEFAULT_MODEL;
  const fallback = env.GRADE_FALLBACK_MODEL === 'none' ? null : env.GRADE_FALLBACK_MODEL || FALLBACK_MODEL;
  let model = primary;
  let grade = await attempt(env.AI, primary, messages, q.keyPoints, answer, opts.timeoutMs ?? TIMEOUT_MS);
  if (!grade && fallback && fallback !== primary) {
    // The primary call may still be billed (timeout), so the fallback is a second hit on the global cap.
    const capped = await globalHit(env.DB, now, rand);
    if (capped) return err(capped.status || 503, capped.status ? capped.code : 'ai_unavailable', { 'Retry-After': capped.status ? capped.retryAfter : '30' });
    model = fallback;
    grade = await attempt(env.AI, fallback, messages, q.keyPoints, answer, opts.fallbackTimeoutMs ?? FALLBACK_TIMEOUT_MS);
  }
  if (!grade) return err(503, 'ai_unavailable', { 'Retry-After': '30' });
  return json(200, { questionId, ...grade, keyPoints: q.keyPoints, model, fallback: model !== primary });
}

export const onRequest = (context) => handle(context.request, context.env);
