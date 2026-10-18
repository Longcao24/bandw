// Progress model v1: sanitize, merge (pure, commutative, idempotent) and derived points.
// Shared by the browser and the Pages Function.
import { isExerciseId, isLessonKey, VIDEO_RE, DAY_RE, UNIT_RE, LESSON_RE } from './ids.js';

export const LIMITS = { ex: 2000, lessons: 300, cards: 500, videos: 50, exams: 30 };
/** Mock-exam attempt id (see exam/generate.js newAttemptId) and modes. */
export const EXAM_ID_RE = /^e[0-9a-z]{8,16}$/;
export const EXAM_MODES = ['full', 'quick', 'unit', 'defense'];
const EXAM_MAX_Q = 200; // per-attempt question / key-point count cap
const EXAM_MAX_SEC = 4 * 3600;
export const CARD_POINTS = 5;
const MAX_TS = 1e13;
const MAX_COUNT = 1000;

export function emptyProgress() {
  return { v: 1, updatedAt: 0, ex: {}, lessons: {}, cards: {}, videos: {}, streak: { cur: 0, best: 0, day: '' }, last: null, exams: {} };
}

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function int(x, max = MAX_TS) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.floor(n)));
}
const bit = (x) => (x === 1 || x === true ? 1 : 0);

/** Drops unknown keys and bad ids, clamps numbers. Returns null when x is not a v:1 object. */
export function sanitizeProgress(x) {
  if (!isObj(x) || x.v !== 1) return null;
  const out = emptyProgress();
  out.updatedAt = int(x.updatedAt);
  if (isObj(x.ex)) {
    for (const [k, e] of Object.entries(x.ex)) {
      if (Object.keys(out.ex).length >= LIMITS.ex) break;
      if (!isExerciseId(k) || !isObj(e)) continue;
      const v = { c: bit(e.c), a: int(e.a, MAX_COUNT), p: int(e.p, MAX_COUNT) };
      if (e.t !== undefined && e.t !== null) v.t = int(e.t);
      out.ex[k] = v;
    }
  }
  if (isObj(x.lessons)) {
    for (const [k, e] of Object.entries(x.lessons)) {
      if (Object.keys(out.lessons).length >= LIMITS.lessons) break;
      if (!isLessonKey(k) || !isObj(e)) continue;
      out.lessons[k] = { d: bit(e.d), s: int(e.s, MAX_COUNT), p: int(e.p, MAX_COUNT), at: int(e.at) };
    }
  }
  if (isObj(x.cards)) {
    for (const [k, e] of Object.entries(x.cards)) {
      if (Object.keys(out.cards).length >= LIMITS.cards) break;
      if (!isExerciseId(k) || !isObj(e)) continue;
      if (e.r !== 'good' && e.r !== 'again') continue;
      out.cards[k] = { r: e.r, n: int(e.n, MAX_COUNT), at: int(e.at) };
    }
  }
  if (isObj(x.videos)) {
    for (const [k, e] of Object.entries(x.videos)) {
      if (Object.keys(out.videos).length >= LIMITS.videos) break;
      if (VIDEO_RE.test(k) && e) out.videos[k] = 1;
    }
  }
  if (isObj(x.streak)) {
    const day = typeof x.streak.day === 'string' && DAY_RE.test(x.streak.day) ? x.streak.day : '';
    out.streak = { cur: int(x.streak.cur, MAX_COUNT), best: int(x.streak.best, MAX_COUNT), day };
    if (!day) out.streak.cur = 0;
  }
  if (isObj(x.last) && UNIT_RE.test(x.last.u) && LESSON_RE.test(x.last.l)) {
    out.last = { u: x.last.u, l: x.last.l, s: int(x.last.s, MAX_COUNT), at: int(x.last.at) };
  }
  if (isObj(x.exams)) {
    const list = [];
    for (const [k, e] of Object.entries(x.exams)) {
      if (list.length >= LIMITS.exams * 4) break; // bound the work on hostile input before capping
      const v = sanitizeExam(k, e);
      if (v) list.push([k, v]);
    }
    out.exams = capExams(list);
  }
  return out;
}

/**
 * One exam attempt SUMMARY (no answers): { m: mode, at: ms, s: score, n: max score, d: seconds,
 * u: { uNN: [score, max] }, uu?: unit id for 'unit' mode }. Returns null when unusable.
 */
export function sanitizeExam(k, e) {
  if (typeof k !== 'string' || !EXAM_ID_RE.test(k) || !isObj(e)) return null;
  if (!EXAM_MODES.includes(e.m)) return null;
  const n = int(e.n, EXAM_MAX_Q);
  if (!n) return null;
  const v = { m: e.m, at: int(e.at), s: Math.min(int(e.s, EXAM_MAX_Q), n), n, d: int(e.d, EXAM_MAX_SEC), u: {} };
  if (isObj(e.u)) {
    for (const [u, p] of Object.entries(e.u)) {
      if (Object.keys(v.u).length >= 20) break;
      if (!UNIT_RE.test(u) || !Array.isArray(p) || p.length !== 2) continue;
      const t = int(p[1], EXAM_MAX_Q);
      if (!t) continue;
      v.u[u] = [Math.min(int(p[0], EXAM_MAX_Q), t), t];
    }
  }
  if (e.m === 'unit' && UNIT_RE.test(e.uu)) v.uu = e.uu;
  return v;
}
/** Keeps the newest LIMITS.exams attempts (by at, then id) as an object with a stable key order. */
function capExams(entries) {
  entries.sort((a, b) => (b[1].at - a[1].at) || (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  return Object.fromEntries(entries.slice(0, LIMITS.exams));
}

function minDefined(a, b) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}
const stable = (o) => JSON.stringify(o);

/** Pure merge. Inputs are assumed sanitized (or at least shaped); null/undefined treated as empty. */
export function mergeProgress(a, b) {
  a = a || emptyProgress();
  b = b || emptyProgress();
  const out = emptyProgress();
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);

  const exA = a.ex || {}, exB = b.ex || {};
  for (const k of new Set([...Object.keys(exA), ...Object.keys(exB)])) {
    const x = exA[k], y = exB[k];
    if (!x || !y) { out.ex[k] = { ...(x || y) }; continue; }
    const v = { c: Math.max(x.c || 0, y.c || 0), a: Math.max(x.a || 0, y.a || 0), p: Math.max(x.p || 0, y.p || 0) };
    const t = minDefined(x.t, y.t);
    if (t !== undefined) v.t = t;
    out.ex[k] = v;
  }

  const lA = a.lessons || {}, lB = b.lessons || {};
  for (const k of new Set([...Object.keys(lA), ...Object.keys(lB)])) {
    const x = lA[k], y = lB[k];
    if (!x || !y) { out.lessons[k] = { ...(x || y) }; continue; }
    const newer = (x.at || 0) > (y.at || 0) ? x : (y.at || 0) > (x.at || 0) ? y : ((x.s || 0) >= (y.s || 0) ? x : y);
    out.lessons[k] = { d: Math.max(x.d || 0, y.d || 0), s: newer.s || 0, p: Math.max(x.p || 0, y.p || 0), at: Math.max(x.at || 0, y.at || 0) };
  }

  const cA = a.cards || {}, cB = b.cards || {};
  for (const k of new Set([...Object.keys(cA), ...Object.keys(cB)])) {
    const x = cA[k], y = cB[k];
    if (!x || !y) { out.cards[k] = { ...(x || y) }; continue; }
    let win;
    if ((x.at || 0) !== (y.at || 0)) win = (x.at || 0) > (y.at || 0) ? x : y;
    else win = x.r === 'good' ? x : y;
    out.cards[k] = { r: win.r, n: Math.max(x.n || 0, y.n || 0), at: Math.max(x.at || 0, y.at || 0) };
  }

  for (const k of new Set([...Object.keys(a.videos || {}), ...Object.keys(b.videos || {})])) out.videos[k] = 1;

  const sA = a.streak || { cur: 0, best: 0, day: '' }, sB = b.streak || { cur: 0, best: 0, day: '' };
  const best = Math.max(sA.best || 0, sB.best || 0);
  if ((sA.day || '') === (sB.day || '')) out.streak = { cur: Math.max(sA.cur || 0, sB.cur || 0), best, day: sA.day || '' };
  else {
    const later = (sA.day || '') > (sB.day || '') ? sA : sB;
    out.streak = { cur: later.cur || 0, best, day: later.day };
  }
  out.streak.best = Math.max(out.streak.best, out.streak.cur);

  // exams: union by attempt id; the same id on both sides keeps one deterministic winner; newest 30 kept.
  const eA = a.exams || {}, eB = b.exams || {};
  const ent = [];
  for (const k of new Set([...Object.keys(eA), ...Object.keys(eB)])) {
    const x = eA[k], y = eB[k];
    let w = x || y;
    if (x && y && stable(x) !== stable(y)) w = (x.at || 0) !== (y.at || 0) ? ((x.at || 0) > (y.at || 0) ? x : y) : (stable(x) > stable(y) ? x : y);
    ent.push([k, JSON.parse(stable(w))]);
  }
  out.exams = capExams(ent);

  const la = a.last, lb = b.last;
  if (!la || !lb) out.last = la || lb ? { ...(la || lb) } : null;
  else if ((la.at || 0) !== (lb.at || 0)) out.last = { ...((la.at || 0) > (lb.at || 0) ? la : lb) };
  else out.last = { ...(stable(la) >= stable(lb) ? la : lb) };
  return out;
}

export const cardPoints = (card) => (card && card.n > 0 ? CARD_POINTS : 0);

/** Derived total "điểm năng lượng". */
export function totalPoints(p) {
  if (!p) return 0;
  let s = 0;
  for (const e of Object.values(p.ex || {})) s += e.p || 0;
  for (const e of Object.values(p.lessons || {})) s += e.p || 0;
  for (const e of Object.values(p.cards || {})) s += cardPoints(e);
  return s;
}
