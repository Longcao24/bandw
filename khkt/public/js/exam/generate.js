// Pure, seeded exam generator. Same (course, bank, mode, seed) → same questions in the same order, so an
// attempt can be rebuilt from its seed after a refresh. No DOM access (tested in node).
import { seededRandom, shuffle } from '../util.js';
import { isAutoGradable } from './grade.js';

export const MODES = {
  full: { label: 'Đề tổng hợp', icon: '📝', size: 30, minutes: 30, kind: 'exam' },
  quick: { label: 'Đề nhanh', icon: '⚡', size: 15, minutes: 15, kind: 'exam' },
  unit: { label: 'Theo chương', icon: '📚', size: 10, minutes: 12, kind: 'exam' },
  defense: { label: 'Phản biện thử', icon: '🎤', size: 8, minutes: 0, kind: 'defense' },
};
export const MODE_IDS = Object.keys(MODES);
/** Sims that animate to a pause point are slow in a timed exam: cap them per paper. */
export const SIM_PREDICT_CAP = { full: 3, quick: 2, unit: 2 };

/** Every auto-gradable question: lessons of the course + exam bank. item = { id, step, unitId, lessonId, src } */
export function collectPool(course, bank) {
  const out = [];
  const units = new Set(course.units.map((u) => u.id));
  for (const u of course.units) {
    for (const l of u.lessons || []) for (const s of l.steps || []) {
      if (isAutoGradable(s)) out.push({ id: s.id, step: s, unitId: u.id, lessonId: l.id, src: 'course' });
    }
  }
  for (const q of (bank && bank.questions) || []) {
    if (isAutoGradable(q) && units.has(q.unitId)) out.push({ id: q.id, step: q, unitId: q.unitId, lessonId: q.lessonId, src: 'bank' });
  }
  return out;
}

/** Open (judge) questions for the mock defense: course flashcards + unit.defense + bank.open. */
export function collectOpen(course, bank) {
  const out = [];
  for (const u of course.units) {
    for (const l of u.lessons || []) for (const s of l.steps || []) {
      if (s.type === 'flashcard') out.push({ id: s.id, step: s, unitId: u.id, lessonId: l.id, src: 'course' });
    }
    for (const s of u.defense || []) out.push({ id: s.id, step: s, unitId: u.id, lessonId: null, src: 'course' });
  }
  for (const q of (bank && bank.open) || []) out.push({ id: q.id, step: q, unitId: q.unitId, lessonId: q.lessonId || null, src: 'bank' });
  return out;
}

/**
 * Splits `size` across units in proportion to sqrt(pool size) (coverage weighting: big units get more,
 * small units are not drowned out), at least 1 per non-empty unit when size allows, largest remainder.
 */
export function allocate(counts, size) {
  const ids = Object.keys(counts).filter((k) => counts[k] > 0);
  const total = ids.reduce((a, k) => a + counts[k], 0);
  size = Math.min(size, total);
  const alloc = Object.fromEntries(ids.map((k) => [k, 0]));
  if (!ids.length || size <= 0) return alloc;
  const w = Object.fromEntries(ids.map((k) => [k, Math.sqrt(counts[k])]));
  let left = size;
  if (size >= ids.length) { for (const k of ids) alloc[k] = 1; left -= ids.length; }
  // Largest remainder over the remaining seats, never above what a unit has.
  while (left > 0) {
    const open = ids.filter((k) => alloc[k] < counts[k]);
    const wsum = open.reduce((a, k) => a + w[k], 0);
    const target = Object.fromEntries(open.map((k) => [k, (w[k] / wsum) * left]));
    let given = 0;
    for (const k of open) { const f = Math.min(Math.floor(target[k]), counts[k] - alloc[k]); alloc[k] += f; given += f; }
    left -= given;
    if (left <= 0) break;
    const rest = open.filter((k) => alloc[k] < counts[k])
      .sort((a, b) => (target[b] - Math.floor(target[b])) - (target[a] - Math.floor(target[a])) || counts[b] - counts[a] || (a < b ? -1 : 1));
    for (const k of rest) { if (left <= 0) break; alloc[k] += 1; left -= 1; }
  }
  return alloc;
}

/** Round-robin over lessons (bank counts as its own "lesson"), each lesson's questions seeded-shuffled. */
function spreadPick(items, n, seed, accept) {
  const groups = new Map();
  for (const it of shuffle(items, seed)) {
    const g = it.src === 'bank' ? '#bank' : it.lessonId;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  const order = shuffle([...groups.keys()].sort(), seed + ':g');
  const picked = [];
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const g of order) {
      const q = groups.get(g);
      while (q.length && picked.length < n) {
        const it = q.shift();
        if (accept(it)) { picked.push(it); progress = true; break; }
      }
    }
  }
  return picked;
}

/**
 * generateExam({ course, bank, mode:'full'|'quick'|'unit', seed, unitId?, size? })
 * → [{ id, unitId, lessonId, src }]  (ordered by unit, then seeded within the unit)
 */
export function generateExam({ course, bank, mode = 'full', seed = 'x', unitId = null, size } = {}) {
  const m = MODES[mode] || MODES.full;
  const n = size || m.size;
  let pool = collectPool(course, bank);
  if (mode === 'unit') pool = pool.filter((it) => it.unitId === unitId);
  const cap = SIM_PREDICT_CAP[mode] ?? 2;
  let simCount = 0;
  const accept = (it) => {
    if (it.step.type !== 'sim-predict') return true;
    if (simCount >= cap) return false;
    simCount += 1; return true;
  };
  const byUnit = new Map();
  for (const it of pool) { if (!byUnit.has(it.unitId)) byUnit.set(it.unitId, []); byUnit.get(it.unitId).push(it); }
  const counts = Object.fromEntries([...byUnit].map(([k, v]) => [k, v.length]));
  const alloc = allocate(counts, n);
  const unitOrder = course.units.map((u) => u.id).filter((id) => byUnit.has(id));
  const chosen = [];
  for (const u of unitOrder) chosen.push(...spreadPick(byUnit.get(u), alloc[u] || 0, `${seed}:${u}`, accept));
  // A unit may fall short (sim cap): top up from the leftovers, still seeded.
  if (chosen.length < Math.min(n, pool.length)) {
    const have = new Set(chosen.map((c) => c.id));
    const extra = shuffle(pool.filter((it) => !have.has(it.id)), seed + ':fill');
    for (const it of extra) { if (chosen.length >= n) break; if (accept(it)) chosen.push(it); }
    const rank = Object.fromEntries(unitOrder.map((u, i) => [u, i]));
    chosen.sort((a, b) => rank[a.unitId] - rank[b.unitId]);
  }
  return chosen.slice(0, n).map(({ id, unitId: u, lessonId, src }) => ({ id, unitId: u, lessonId, src }));
}

/** Defense: n open questions across units, ≥ 2 from the exam bank, cards rated "again" preferred. */
export function generateDefense({ course, bank, seed = 'x', size = 8, cards = {} } = {}) {
  const pool = collectOpen(course, bank);
  const rnd = seededRandom(seed + ':def');
  const bankItems = shuffle(pool.filter((p) => p.src === 'bank'), seed + ':b');
  const nBank = Math.min(bankItems.length, Math.max(2, Math.round(size / 4)));
  const picked = bankItems.slice(0, nBank);
  const rest = pool.filter((p) => p.src !== 'bank');
  const byUnit = new Map();
  for (const it of rest) { if (!byUnit.has(it.unitId)) byUnit.set(it.unitId, []); byUnit.get(it.unitId).push(it); }
  // Within a unit: "again" first, then unseen, then good; ties broken by the seed.
  for (const [u, list] of byUnit) {
    const rank = (it) => (cards[it.id]?.r === 'again' ? 0 : cards[it.id] ? 2 : 1);
    byUnit.set(u, shuffle(list, `${seed}:${u}`).map((it, i) => ({ it, r: rank(it), i })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it));
  }
  const units = shuffle([...byUnit.keys()].sort(), seed + ':u');
  const usedUnits = new Set(picked.map((p) => p.unitId));
  // first pass: units not yet covered by the bank picks
  for (const u of units) { if (picked.length >= size) break; if (!usedUnits.has(u) && byUnit.get(u).length) { picked.push(byUnit.get(u).shift()); usedUnits.add(u); } }
  while (picked.length < size) {
    const open = units.filter((u) => byUnit.get(u).length);
    if (!open.length) break;
    picked.push(byUnit.get(open[Math.floor(rnd() * open.length)]).shift());
  }
  return shuffle(picked, seed + ':o').map(({ id, unitId, lessonId, src }) => ({ id, unitId, lessonId, src }));
}

/** id → { step, unitId, lessonId, src } for both pools (rebuild an attempt from saved ids). */
export function indexQuestions(course, bank) {
  const map = new Map();
  for (const it of collectPool(course, bank)) map.set(it.id, it);
  for (const it of collectOpen(course, bank)) map.set(it.id, it);
  return map;
}

/** Follow-up ("hỏi xoáy") for an open question: its own, else the first keyword match, else generic. */
export function followUpFor(step, followUps = [], generic = null) {
  if (step.followUp) return step.followUp;
  // Only the question itself decides: model answers mention many topics in passing.
  for (const f of followUps) if (new RegExp(f.match, 'i').test(step.prompt)) return f;
  return generic;
}

/** New attempt id: 'e' + base36 time + 4 random base36 chars (matches EXAM_ID_RE in core/merge.js). */
export function newAttemptId(now = Date.now(), rnd = Math.random) {
  let r = '';
  for (let i = 0; i < 4; i++) r += Math.floor(rnd() * 36).toString(36);
  return 'e' + now.toString(36) + r;
}
