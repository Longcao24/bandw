// Mock exam: generator determinism + coverage, grading, progress merge of exam summaries, store, API, router.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { course } from '../public/content/index.js';
import bank from '../public/content/exam/bank.js';
import { generateExam, generateDefense, collectPool, collectOpen, allocate, indexQuestions, MODES, SIM_PREDICT_CAP, newAttemptId, followUpFor } from '../public/js/exam/generate.js';
import { gradeAnswer, scoreAttempt, idealAnswer, isAnswerShape, correctText, answerText } from '../public/js/exam/grade.js';
import { mergeProgress, sanitizeProgress, emptyProgress, EXAM_ID_RE, LIMITS } from '../public/js/core/merge.js';
import { createStore, makeStorage, KEYS } from '../public/js/progress/store.js';
import { saveDetail, loadDetails, loadCurrent, saveCurrent, secondsLeft, MAX_DETAILS, fmtClock } from '../public/js/exam/session.js';
import { unitBarsSvg, trendSvg } from '../public/js/exam/chart.js';
import { parseHash } from '../public/js/router.js';
import { handle } from '../functions/api/progress.js';
import { createMockD1 } from './helpers/mock-d1.mjs';
import { generate } from '../public/js/core/learnerCode.js';

const index = indexQuestions(course, bank);
const pool = collectPool(course, bank);
const unitsWithPool = new Set(pool.map((p) => p.unitId));

// ---------- generator ----------
test('exam generator is deterministic for a seed and differs across seeds', () => {
  for (const mode of ['full', 'quick']) {
    const a = generateExam({ course, bank, mode, seed: 'e-seed-1' });
    const b = generateExam({ course, bank, mode, seed: 'e-seed-1' });
    assert.deepEqual(a, b, mode);
    const c = generateExam({ course, bank, mode, seed: 'e-seed-2' });
    assert.notDeepEqual(a.map((q) => q.id), c.map((q) => q.id), mode);
  }
});

test('full = 30, quick = 15, no duplicates, every id resolvable and auto-gradable', () => {
  for (const [mode, n] of [['full', MODES.full.size], ['quick', MODES.quick.size]]) {
    for (let s = 0; s < 25; s++) {
      const qs = generateExam({ course, bank, mode, seed: `seed${s}` });
      assert.equal(qs.length, n, `${mode} seed${s}`);
      assert.equal(new Set(qs.map((q) => q.id)).size, n, 'duplicates');
      for (const q of qs) {
        const it = index.get(q.id);
        assert.ok(it, q.id);
        assert.notEqual(it.step.type, 'flashcard');
        assert.equal(it.unitId, q.unitId);
      }
    }
  }
});

test('stratified coverage: every unit with questions appears in every full and quick paper', () => {
  for (let s = 0; s < 40; s++) {
    for (const mode of ['full', 'quick']) {
      const units = new Set(generateExam({ course, bank, mode, seed: `cov${s}` }).map((q) => q.unitId));
      for (const u of unitsWithPool) assert.ok(units.has(u), `${mode} cov${s} misses ${u}`);
    }
  }
});

test('coverage weighting: bigger units get at least as many seats; counts sum to size', () => {
  const counts = {};
  for (const it of pool) counts[it.unitId] = (counts[it.unitId] || 0) + 1;
  const alloc = allocate(counts, 30);
  assert.equal(Object.values(alloc).reduce((a, b) => a + b, 0), 30);
  for (const u of Object.keys(counts)) assert.ok(alloc[u] >= 1 && alloc[u] <= counts[u]);
  const ids = Object.keys(counts).sort((a, b) => counts[a] - counts[b]);
  assert.ok(alloc[ids[ids.length - 1]] >= alloc[ids[0]], 'largest unit has ≥ seats of smallest');
  assert.deepEqual(allocate({ a: 2, b: 0 }, 5), { a: 2 }); // capped by availability
  assert.deepEqual(allocate({ a: 5, b: 5, c: 5 }, 2), allocate({ a: 5, b: 5, c: 5 }, 2)); // fewer seats than units still fine
  assert.equal(Object.values(allocate({ a: 5, b: 5, c: 5 }, 2)).reduce((x, y) => x + y, 0), 2);
});

test('exam bank questions are drawn and sim-predict is capped per paper', () => {
  let bankSeen = 0;
  for (let s = 0; s < 30; s++) {
    for (const mode of ['full', 'quick']) {
      const qs = generateExam({ course, bank, mode, seed: `b${s}` });
      bankSeen += qs.filter((q) => q.src === 'bank').length;
      const sims = qs.filter((q) => index.get(q.id).step.type === 'sim-predict').length;
      assert.ok(sims <= SIM_PREDICT_CAP[mode], `${mode} b${s}: ${sims} sim-predict`);
    }
  }
  assert.ok(bankSeen > 60, `bank questions should appear regularly (seen ${bankSeen})`);
});

test('unit mode: only that unit, up to 10 questions, spread across lessons', () => {
  for (const u of course.units) {
    const qs = generateExam({ course, bank, mode: 'unit', unitId: u.id, seed: 'u' });
    const avail = pool.filter((p) => p.unitId === u.id).length;
    assert.equal(qs.length, Math.min(MODES.unit.size, avail), u.id);
    assert.ok(qs.every((q) => q.unitId === u.id));
    if (qs.length >= 6 && u.lessons.length >= 3) assert.ok(new Set(qs.map((q) => q.lessonId)).size >= 3, `${u.id}: lessons spread`);
  }
});

test('defense: 8 open questions, deterministic, ≥ 2 from the exam bank, "again" cards preferred', () => {
  const a = generateDefense({ course, bank, seed: 'd1', size: 8 });
  assert.deepEqual(a, generateDefense({ course, bank, seed: 'd1', size: 8 }));
  assert.equal(a.length, 8);
  assert.equal(new Set(a.map((q) => q.id)).size, 8);
  assert.ok(a.filter((q) => q.src === 'bank').length >= 2);
  for (const q of a) { const st = index.get(q.id).step; assert.equal(st.type, 'flashcard'); assert.ok(st.keyPoints.length >= 2); }
  assert.ok(new Set(a.map((q) => q.unitId)).size >= 5, 'spread across units');
  // a card rated "again" in a unit is picked before other cards of that unit when the unit is drawn
  const open = collectOpen(course, bank).filter((o) => o.src === 'course');
  const target = open.find((o) => o.unitId === 'u05');
  const cards = Object.fromEntries(open.filter((o) => o.unitId === 'u05' && o.id !== target.id).map((o) => [o.id, { r: 'good', n: 1, at: 1 }]));
  cards[target.id] = { r: 'again', n: 1, at: 1 };
  for (let s = 0; s < 10; s++) {
    const qs = generateDefense({ course, bank, seed: `p${s}`, size: 8, cards });
    const u05 = qs.filter((q) => q.unitId === 'u05' && q.src === 'course');
    if (u05.length) assert.ok(u05.some((q) => q.id === target.id), `p${s}`);
  }
});

test('follow-up: own followUp, else keyword match, else generic', () => {
  const own = bank.open.find((o) => o.followUp);
  assert.equal(followUpFor(own, [], null), own.followUp);
  const generic = { prompt: 'g', answer: 'g' };
  assert.equal(followUpFor({ prompt: 'Giám khảo hỏi: HELP là gì?' }, [{ match: 'HELP', prompt: 'p', answer: 'a' }], generic).prompt, 'p');
  assert.equal(followUpFor({ prompt: 'Màu vỏ là gì?' }, [{ match: 'HELP', prompt: 'p', answer: 'a' }], generic), generic);
});

test('attempt ids match the sync format', () => {
  for (let i = 0; i < 200; i++) assert.match(newAttemptId(Date.now() + i * 1e9), EXAM_ID_RE);
});

// ---------- grading ----------
test('gradeAnswer: ideal answers pass, empty and wrong answers fail, for every pooled question', () => {
  for (const it of pool) {
    const st = it.step;
    const ideal = idealAnswer(st);
    assert.ok(isAnswerShape(st, ideal), `${st.id} ideal shape`);
    assert.equal(gradeAnswer(st, ideal), true, `${st.id} ideal`);
    assert.equal(gradeAnswer(st, null), false);
    assert.ok(correctText(st).length > 0, `${st.id} correctText`);
    assert.notEqual(answerText(st, ideal), 'Chưa trả lời');
  }
});

test('gradeAnswer per type edge cases', () => {
  assert.equal(gradeAnswer({ type: 'number', answer: 0.9, tolerance: 0 }, '0,9'), true);
  assert.equal(gradeAnswer({ type: 'number', answer: 40, tolerance: 2 }, ' 41.5 '), true);
  assert.equal(gradeAnswer({ type: 'number', answer: 40, tolerance: 0 }, 'bốn mươi'), false);
  assert.equal(gradeAnswer({ type: 'multi', answers: [0, 2] }, [2, 0]), true);
  assert.equal(gradeAnswer({ type: 'multi', answers: [0, 2] }, [0]), false);
  assert.equal(gradeAnswer({ type: 'order', items: ['a', 'b', 'c'] }, [0, 2, 1]), false);
  assert.equal(gradeAnswer({ type: 'match', pairs: [['a', '1'], ['b', '2']] }, [0, -1]), false);
  assert.equal(gradeAnswer({ type: 'hotspot', answer: ['x', 'y'] }, ['y', 'x']), true);
  assert.equal(gradeAnswer({ type: 'hotspot', answer: 'x' }, ['x', 'y']), false);
  assert.equal(gradeAnswer({ type: 'truefalse', answer: false }, false), true);
  assert.equal(gradeAnswer({ type: 'truefalse', answer: false }, 0), false);
  assert.equal(gradeAnswer({ type: 'mcq', answer: 1, options: ['a', 'b'] }, '1'), false);
});

test('scoreAttempt: totals, per-unit, unanswered = wrong, unknown ids skipped', () => {
  const qs = generateExam({ course, bank, mode: 'quick', seed: 'score' });
  const ans = {};
  qs.forEach((q, i) => { if (i % 3 === 0) ans[q.id] = idealAnswer(index.get(q.id).step); });
  const r = scoreAttempt({ qs: [...qs, { id: 'u99.l1.q1', unitId: 'u99' }], ans }, index);
  assert.equal(r.n, qs.length);
  assert.equal(r.c, Math.ceil(qs.length / 3));
  assert.equal(Object.values(r.perUnit).reduce((a, [c]) => a + c, 0), r.c);
  assert.equal(Object.values(r.perUnit).reduce((a, [, t]) => a + t, 0), r.n);
  assert.equal(r.ok['u99.l1.q1'], undefined);
});

// ---------- merge / sanitize ----------
const ex = (at, s = 5, extra = {}) => ({ m: 'quick', at, s, n: 15, d: 600, u: { u01: [1, 2], u05: [3, 4] }, ...extra });
test('exam summaries: union by attempt id, commutative, idempotent', () => {
  const A = { ...emptyProgress(), exams: { e0000000001: ex(100), e0000000002: ex(200) } };
  const B = { ...emptyProgress(), exams: { e0000000002: ex(200), e0000000003: ex(300, 9, { m: 'unit', uu: 'u03', u: { u03: [9, 10] }, n: 10 }) } };
  const ab = mergeProgress(A, B), ba = mergeProgress(B, A);
  assert.deepEqual(ab, ba);
  assert.deepEqual(Object.keys(ab.exams).sort(), ['e0000000001', 'e0000000002', 'e0000000003']);
  assert.deepEqual(mergeProgress(ab, ab), ab);
  assert.deepEqual(mergeProgress(ab, A), ab);
  // conflicting copies of one id (should not happen) still merge deterministically
  const X = { ...emptyProgress(), exams: { e0000000009: ex(50, 3) } };
  const Y = { ...emptyProgress(), exams: { e0000000009: ex(50, 4) } };
  assert.deepEqual(mergeProgress(X, Y), mergeProgress(Y, X));
});

test('exam summaries: capped at the newest 30 after merge and sanitize', () => {
  const mk = (from) => Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`e${String(from + i).padStart(10, '0')}`, ex(from + i)]));
  const m = mergeProgress({ ...emptyProgress(), exams: mk(0) }, { ...emptyProgress(), exams: mk(100) });
  assert.equal(Object.keys(m.exams).length, LIMITS.exams);
  assert.ok(Object.values(m.exams).every((e) => e.at >= 20 || e.at >= 100));
  assert.ok(m.exams['e0000000124'] && !m.exams['e0000000000']);
  const big = { v: 1, exams: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`e${String(i).padStart(10, '0')}`, ex(i)])) };
  assert.equal(Object.keys(sanitizeProgress(big).exams).length, LIMITS.exams);
});

test('exam summaries: sanitize drops bad ids/modes and clamps numbers', () => {
  const s = sanitizeProgress({ v: 1, exams: {
    e0000000001: { m: 'full', at: 5, s: 999, n: 30, d: 1e9, u: { u01: [9, 3], bad: [1, 1], u02: [1, 0], u03: 'x' }, junk: 1 },
    e0000000002: { m: 'hack', at: 1, s: 1, n: 1 },
    'nope': { m: 'full', at: 1, s: 1, n: 1 },
    e0000000003: { m: 'quick', at: 1, s: 1, n: 0 },
    e0000000004: { m: 'unit', at: 2, s: 1, n: 10, d: 30, u: {}, uu: 'u04' },
    e0000000005: { m: 'full', at: 2, s: 1, n: 10, d: 30, u: {}, uu: 'u04' },
  } });
  assert.deepEqual(Object.keys(s.exams).sort(), ['e0000000001', 'e0000000004', 'e0000000005']);
  assert.deepEqual(s.exams.e0000000001, { m: 'full', at: 5, s: 30, n: 30, d: 4 * 3600, u: { u01: [3, 3] } });
  assert.equal(s.exams.e0000000004.uu, 'u04');
  assert.equal(s.exams.e0000000005.uu, undefined);
  assert.deepEqual(sanitizeProgress({ v: 1 }).exams, {});
});

// ---------- store + session ----------
function memBackend() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
test('store.recordExam saves a sanitized summary, emits a local change and lists history newest first', () => {
  let t = 1000;
  const store = createStore({ storage: makeStorage(memBackend()), now: () => t });
  const reasons = [];
  store.on((r, { local }) => reasons.push([r, local]));
  assert.equal(store.recordExam('bad', ex(1)), null);
  store.recordExam('e0000000001', ex(10, 3));
  t = 2000;
  store.recordExam('e0000000002', { ...ex(20, 12), extra: 'x' });
  assert.deepEqual(reasons, [['exam', true], ['exam', true]]);
  const h = store.examHistory();
  assert.deepEqual(h.map((x) => x.id), ['e0000000002', 'e0000000001']);
  assert.equal(h[0].extra, undefined);
  assert.equal(store.progress.updatedAt, 2000);
  store.flush();
  assert.ok(JSON.parse(store.storage.get(KEYS.progress)).exams.e0000000002);
});

test('session: in-progress attempt round-trips; details keep the newest few; clock format', () => {
  const st = makeStorage(memBackend());
  assert.equal(loadCurrent(st), null);
  st.set(KEYS.examCurrent, '{broken');
  assert.equal(loadCurrent(st), null);
  const a = { v: 1, id: 'e0000000001', mode: 'quick', qs: [{ id: 'x.q01', unitId: 'u01' }], ans: { 'x.q01': [0, 1] }, flags: ['x.q01'], cur: 9, deadline: 61000 };
  saveCurrent(st, a);
  const b = loadCurrent(st);
  assert.equal(b.cur, 0); // out-of-range index repaired
  assert.deepEqual(b.ans, a.ans);
  assert.equal(secondsLeft(b, 1000), 60);
  assert.equal(secondsLeft({}, 0), Infinity);
  for (let i = 0; i < MAX_DETAILS + 4; i++) saveDetail(st, { id: `e000000000${i}`.slice(0, 11) + i, at: i });
  assert.equal(Object.keys(loadDetails(st)).length, MAX_DETAILS);
  assert.equal(fmtClock(1799), '29:59');
  assert.equal(fmtClock(-5), '00:00');
});

test('charts render safe SVG strings with text values', () => {
  const svg = unitBarsSvg([{ label: 'Ch. 1', name: '<x>', c: 2, t: 4 }, { label: 'Ch. 2', name: 'B', c: 4, t: 4 }]);
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('2/4 · 50%') && svg.includes('4/4 · 100%'));
  assert.ok(!svg.includes('<x>'));
  assert.match(trendSvg([{ pct: 40, label: 'a' }, { pct: 80, label: 'b' }]), /polyline/);
  assert.match(trendSvg([{ pct: 40, label: 'a' }]), /circle/);
});

// ---------- router ----------
test('router: exam routes', () => {
  assert.deepEqual(parseHash('#/exam'), { name: 'exam', params: {} });
  assert.deepEqual(parseHash('#/exam/full'), { name: 'exam-run', params: { mode: 'full', unitId: null } });
  assert.deepEqual(parseHash('#/exam/quick'), { name: 'exam-run', params: { mode: 'quick', unitId: null } });
  assert.deepEqual(parseHash('#/exam/unit/u03'), { name: 'exam-run', params: { mode: 'unit', unitId: 'u03' } });
  assert.deepEqual(parseHash('#/exam/unit'), { name: 'exam-run', params: { mode: 'unit', unitId: null } });
  assert.deepEqual(parseHash('#/exam/defense'), { name: 'exam-defense', params: {} });
  assert.deepEqual(parseHash('#/exam/result/e0000000001'), { name: 'exam-result', params: { attemptId: 'e0000000001' } });
  assert.equal(parseHash('#/exam/bogus').name, 'notfound');
});

// ---------- API ----------
const ORIGIN = 'https://bandw-khkt.pages.dev';
function put(code, body, ip) {
  return new Request(ORIGIN + '/api/progress', { method: 'PUT', headers: { 'X-Learner-Code': code, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) });
}
test('API: exam summaries from two devices are unioned; junk is stripped', async () => {
  const env = { DB: createMockD1() };
  const code = generate();
  let r = await handle(put(code, { ...emptyProgress(), exams: { e0000000001: ex(10), evil: { m: 'full' } } }, '10.9.0.1'), env, 1000);
  assert.equal(r.status, 200);
  r = await handle(put(code, { ...emptyProgress(), exams: { e0000000002: ex(20, 1, { m: 'defense', u: { u10: [5, 12] }, n: 30 }) } }, '10.9.0.2'), env, 2000);
  const j = await r.json();
  assert.deepEqual(Object.keys(j.progress.exams).sort(), ['e0000000001', 'e0000000002']);
  assert.equal(j.progress.exams.e0000000002.m, 'defense');
});

test('API: a finished course + 30 exam summaries fits under the size limit', async () => {
  const p = emptyProgress();
  for (const it of collectPool(course, bank)) if (!it.id.startsWith('x.')) p.ex[it.id] = { c: 1, a: 3, p: 10, t: 1760000000000 };
  for (const it of collectOpen(course, bank)) if (!it.id.startsWith('x.')) p.cards[it.id] = { r: 'good', n: 3, at: 1760000000000 };
  for (const u of course.units) for (const l of u.lessons) p.lessons[`${u.id}.${l.id}`] = { d: 1, s: 0, p: 20, at: 1760000000000 };
  for (let i = 0; i < 30; i++) p.exams[`e${(1760000000000 + i).toString(36)}abcd`] = { m: 'full', at: 1760000000000 + i, s: 20, n: 30, d: 1799, u: Object.fromEntries(course.units.map((u) => [u.id, [2, 3]])) };
  const size = JSON.stringify(sanitizeProgress(p)).length;
  const r = await handle(put(generate(), p, '10.9.0.3'), { DB: createMockD1() }, 1);
  assert.equal(r.status, 200, `size ${size}`);
});
