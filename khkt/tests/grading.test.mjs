// AI grading client, /question data index, router paths and the progress.ai field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResult, normalizeScore, errorKind, errorMessage, checkAnswer, gradeAnswer, matchKeyPoint, GradeError, MAX_CHARS } from '../public/js/grading/api.js';
import * as idx from '../public/content/defense-index.js';
import { parseHash, parseLocation } from '../public/js/router.js';
import { mergeProgress, sanitizeProgress, emptyProgress, totalPoints, LIMITS } from '../public/js/core/merge.js';
import { createStore, makeStorage, GRADED } from '../public/js/progress/store.js';
import { course } from '../public/content/index.js';
import { MAX_BYTES } from '../functions/api/progress.js';

const KP = ['Bản cũ: gập và giữ 400 ms', 'Lỗi: uống nước gây HELP nhầm', 'Bản mới: 2 lần nhấp cùng chiều', '25°/12°, ≤ 700 ms'];

test('normalizeScore: 0–10, percentages, strings with comma, clamped', () => {
  assert.equal(normalizeScore(7.46), 7.5);
  assert.equal(normalizeScore(85), 8.5);
  assert.equal(normalizeScore('6,5'), 6.5);
  assert.equal(normalizeScore(-3), 0);
  assert.equal(normalizeScore('abc'), null);
});

test('normalizeResult: indices (0- and 1-based), texts, detailed objects, aliases', () => {
  const a = normalizeResult({ score: 6, covered: [0, 2], missing: [1, 3], factualErrors: ['x'], feedback: 'ok', improvedAnswer: 'better' }, KP);
  assert.deepEqual(a.covered, [0, 2]);
  assert.deepEqual(a.points.map((p) => p.ok), [true, false, true, false]);
  assert.deepEqual(a.errors, ['x']);
  assert.equal(a.improved, 'better');
  const b = normalizeResult({ score: 8, covered: [1, 4] }, KP); // contains n → 1-based
  assert.deepEqual(b.covered, [0, 3]);
  const c = normalizeResult({ score: 5, coveredKeyPoints: ['bản mới: 2 lần nhấp cùng chiều'], missingKeyPoints: ['Nói thêm về kiểm thử'], factual_errors: [], improved_answer: 'y' }, KP);
  assert.deepEqual(c.covered, [2]);
  assert.deepEqual(c.extraMissing, ['Nói thêm về kiểm thử']);
  assert.equal(c.improved, 'y');
  const d = normalizeResult({ result: { score: 9, keyPoints: [{ index: 0, covered: true }, { index: 1, covered: false }, { point: 'Bản mới 2 lần nhấp cùng chiều', covered: true }] } }, KP);
  assert.deepEqual(d.covered, [0, 2]);
  assert.equal(normalizeResult({ feedback: 'no score' }, KP), null);
  assert.equal(normalizeResult(null, KP), null);
});

test('matchKeyPoint is accent-insensitive and rejects unrelated text', () => {
  assert.equal(matchKeyPoint('loi uong nuoc gay help nham', KP), 1);
  assert.equal(matchKeyPoint('pin dùng được bao lâu', KP), -1);
});

test('error kinds and Vietnamese messages', () => {
  assert.equal(errorKind(429), 'rate');
  assert.equal(errorKind(503, 'ai_unavailable'), 'busy');
  assert.equal(errorKind(413), 'long');
  assert.equal(errorKind(400, 'too_short'), 'short');
  assert.equal(errorKind(404), 'missing');
  assert.equal(errorKind(404, 'unknown_question'), 'unknown');
  assert.equal(errorKind(429, 'daily_limit'), 'daily');
  assert.equal(errorKind(503, 'no_ai'), 'missing');
  assert.match(errorMessage('rate', { retryAfter: '42' }), /42 giây/);
  assert.match(errorMessage('network'), /mạng/);
  assert.equal(checkAnswer('ngắn'), 'short');
  assert.equal(checkAnswer('x'.repeat(MAX_CHARS + 1)), 'long');
  assert.equal(checkAnswer('Một câu trả lời đủ dài để chấm.'), null);
});

test('gradeAnswer: posts {id, answer} only (no learner code), maps HTTP errors', async () => {
  let seen = null;
  const okFetch = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, headers: new Map(), json: async () => ({ score: 7, covered: [0] }) }; };
  const r = await gradeAnswer({ id: 'x.d.q01', answer: '  Bản cũ gập và giữ 400 ms, nay là hai lần nhấp.  ', keyPoints: KP, fetchImpl: okFetch });
  assert.equal(r.score, 7);
  assert.equal(seen.url, '/api/grade');
  assert.equal(seen.init.method, 'POST');
  assert.deepEqual(Object.keys(JSON.parse(seen.init.body)).sort(), ['answer', 'id']);
  assert.ok(!Object.keys(seen.init.headers).some((h) => /learner/i.test(h)));
  const errFetch = (status, body, ra) => async () => ({ ok: false, status, headers: { get: (k) => (k === 'Retry-After' ? ra : null) }, json: async () => body });
  await assert.rejects(gradeAnswer({ id: 'a', answer: 'đủ dài để gửi lên máy chấm', fetchImpl: errFetch(429, { error: 'rate_limited' }, '30') }), (e) => e instanceof GradeError && e.kind === 'rate' && /30 giây/.test(e.message));
  await assert.rejects(gradeAnswer({ id: 'a', answer: 'đủ dài để gửi lên máy chấm', fetchImpl: errFetch(503, { error: 'ai_unavailable' }) }), (e) => e.kind === 'busy');
  await assert.rejects(gradeAnswer({ id: 'a', answer: 'đủ dài để gửi lên máy chấm', fetchImpl: async () => { throw new TypeError('fail'); } }), (e) => e.kind === 'network');
  await assert.rejects(gradeAnswer({ id: 'a', answer: 'ngắn', fetchImpl: okFetch }), (e) => e.kind === 'short');
  await assert.rejects(gradeAnswer({ id: 'a', answer: 'đủ dài để gửi lên máy chấm', fetchImpl: async () => ({ ok: true, status: 200, headers: new Map(), json: async () => ({}) }) }), (e) => e.kind === 'bad');
});

test('defense index: exactly 200 questions, unique ids, gradable, every one reachable from a lesson', () => {
  const list = idx.list();
  assert.equal(idx.count(), list.length);
  assert.equal(list.length, 200, `có ${list.length} câu phản biện (mục tiêu 200)`);
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  list.forEach((it, i) => {
    assert.equal(it.n, i + 1);
    assert.equal(idx.byId(it.id), it);
    assert.ok(it.keyPoints.length >= 2, it.id);
    assert.ok(it.modelAnswer.length > 20, it.id);
    assert.ok(it.topic && it.topic.id && it.topic.label, it.id);
    assert.match(it.href, /^#\/unit\/u\d{2}(\/lesson\/l\d{1,2}(\/q\/.+)?)?$/, it.id);
    if (it.src === 'lesson') { assert.ok(it.embedded && it.lessonId && it.href.endsWith(`/q/${it.id}`)); }
    const p = idx.gradingPayload(it);
    assert.deepEqual(Object.keys(p).sort(), ['id', 'keyPoints', 'modelAnswer', 'prompt', 'topic']);
  });
  const lessonCards = list.filter((x) => x.src === 'lesson').length;
  assert.ok(lessonCards >= 150, `phần lớn câu phải nằm trong bài học (${lessonCards})`);
  assert.equal(idx.topics().reduce((a, t) => a + t.count, 0), list.length);
  assert.equal(idx.byId('nope'), null);
});

test('defense index: 200 = lesson flashcards + bank.open, all ids unique course-wide, every card resolves to a real lesson', async () => {
  const { course } = await import('../public/content/index.js');
  const bank = (await import('../public/content/exam/bank.js')).default;
  let lessonCards = 0;
  const allCardIds = [];
  const lessons = new Map();
  for (const u of course.units) {
    for (const l of u.lessons) {
      lessons.set(`${u.id}/${l.id}`, l);
      for (const s of l.steps) if (s.type === 'flashcard') { lessonCards++; allCardIds.push(s.id); }
    }
    for (const s of u.defense || []) if (s.type === 'flashcard') allCardIds.push(s.id);
  }
  const open = bank.open.filter((q) => q.type === 'flashcard');
  for (const q of open) allCardIds.push(q.id);
  assert.equal(lessonCards + open.length, 200, `lesson cards ${lessonCards} + bank.open ${open.length}`);
  assert.equal(idx.count(), lessonCards + open.length);
  assert.equal(new Set(allCardIds).size, allCardIds.length, 'flashcard ids must be unique across lessons, unit.defense and bank.open');
  for (const it of idx.list()) {
    const l = lessons.get(`${it.unitId}/${it.lessonId}`);
    assert.ok(l, `${it.id} → ${it.unitId}/${it.lessonId} không phải bài học có thật`);
    if (it.src === 'lesson') assert.equal(l.steps[it.stepIndex].id, it.id);
    assert.ok(it.keyPoints.length >= 3 && it.keyPoints.length <= 5, `${it.id}: ${it.keyPoints.length} keyPoints`);
  }
});

test('defense index: accent-insensitive search', () => {
  assert.equal(idx.fold('Nghiêng TRÁI, đặt tay'), 'nghieng trai, dat tay');
  const a = idx.list().filter((it) => idx.matches(it, 'nghieng')).length;
  const b = idx.list().filter((it) => idx.matches(it, 'nghiêng')).length;
  assert.ok(a > 0 && a === b);
  assert.ok(idx.list().filter((it) => idx.matches(it, 'watchdog 4')).length >= 1);
  assert.equal(idx.questionText('Giám khảo hỏi: "Pin dùng bao lâu?"'), 'Pin dùng bao lâu?');
});

test('router: #/question, #/question/<id>, real path /question, lesson step deep link', () => {
  assert.deepEqual(parseHash('#/question'), { name: 'question', params: { id: null } });
  assert.deepEqual(parseHash('#/question/u05.l8.q1'), { name: 'question', params: { id: 'u05.l8.q1' } });
  assert.deepEqual(parseLocation({ pathname: '/question', hash: '' }), { name: 'question', params: { id: null } });
  assert.deepEqual(parseLocation({ pathname: '/question/', hash: '' }).name, 'question');
  assert.equal(parseLocation({ pathname: '/question', hash: '#/exam' }).name, 'exam');
  assert.equal(parseLocation({ pathname: '/', hash: '' }).name, 'home');
  // the logo / "Về trang chủ" link (#/) must reach home from the real path /question
  assert.equal(parseLocation({ pathname: '/question', hash: '#/' }).name, 'home');
  assert.equal(parseLocation({ pathname: '/question', hash: '#' }).name, 'question');
  assert.deepEqual(parseHash('#/unit/u03/lesson/l2/q/u03.l2.q8'), { name: 'lesson', params: { unitId: 'u03', lessonId: 'l2', stepId: 'u03.l2.q8' } });
});

test('_redirects serves /question as the SPA; _routes.json keeps it away from Functions', async () => {
  const { readFile } = await import('node:fs/promises');
  const red = await readFile(new URL('../public/_redirects', import.meta.url), 'utf8');
  assert.match(red, /^\/question\s+\/\s+200$/m); // not /index.html: Pages would 308 it to "/"
  assert.doesNotMatch(red, /index\.html\s+200/);
  const routes = JSON.parse(await readFile(new URL('../public/_routes.json', import.meta.url), 'utf8'));
  assert.ok(routes.include.every((p) => p.startsWith('/api/')));
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /microphone=\(self\)/, 'dictation needs the microphone on our own origin');
});

test('progress.ai: sanitize, merge (commutative, idempotent, best kept), bank ids allowed, no points', () => {
  const A = { ...emptyProgress(), ai: { 'u01.l1.q6': { b: 60, l: 60, n: 1, at: 10 }, 'x.d.q01': { b: 90, l: 90, n: 2, at: 5 } } };
  const B = { ...emptyProgress(), ai: { 'u01.l1.q6': { b: 80, l: 40, n: 3, at: 20 }, 'u02.l1.q4': { b: 50, l: 50, n: 1, at: 1 } } };
  const ab = mergeProgress(A, B);
  assert.deepEqual(ab, mergeProgress(B, A));
  assert.deepEqual(mergeProgress(ab, ab), ab);
  assert.deepEqual(ab.ai['u01.l1.q6'], { b: 80, l: 40, n: 3, at: 20 });
  assert.equal(Object.keys(ab.ai).length, 3);
  assert.equal(totalPoints(ab), 0);
  const s = sanitizeProgress({ v: 1, ai: { 'u01.l1.q6': { b: 999, l: -4, n: 2, at: 3 }, 'bad id': { b: 1, n: 1 }, 'u01.l1.q7': { b: 5, n: 0 }, 'x.d.q02': 'x' },
    cards: { 'x.d.q01': { r: 'good', n: 1, at: 1 } } });
  assert.deepEqual(s.ai, { 'u01.l1.q6': { b: 100, l: 0, n: 2, at: 3 } });
  assert.ok(s.cards['x.d.q01'], 'bank open questions can be self-rated and synced');
});

test('store.recordGrade keeps the best score and syncs it; full course still fits MAX_BYTES', () => {
  let t = 1000;
  const store = createStore({ storage: makeStorage(null), now: () => t });
  assert.equal(store.grade('u01.l1.q6'), null);
  let r = store.recordGrade('u01.l1.q6', 6.54);
  assert.deepEqual(r, { best: 6.5, last: 6.5, n: 1, improved: true });
  t += 10;
  r = store.recordGrade('u01.l1.q6', 4);
  assert.deepEqual(r, { best: 6.5, last: 4, n: 2, improved: false });
  assert.deepEqual(store.grade('u01.l1.q6'), { best: 6.5, last: 4, n: 2, at: 1010 });
  assert.equal(store.recordGrade('not-an-id', 5), null);
  assert.ok(store.recordGrade('x.d.q03', 10));
  // worst realistic payload: every lesson exercise + every lesson card + 30 exams + all 200 AI grades
  const p = emptyProgress();
  const ts = 1792423561831;
  for (const u of course.units) for (const l of u.lessons) {
    p.lessons[`${u.id}.${l.id}`] = { d: 1, s: l.steps.length, p: 20, at: ts };
    for (const st of l.steps) if (GRADED.has(st.type)) p.ex[st.id] = { c: 1, a: 3, p: 10, t: ts };
  }
  for (const it of idx.list()) { p.cards[it.id] = { r: 'again', n: 12, at: ts }; p.ai[it.id] = { b: 85, l: 70, n: 12, at: ts }; }
  for (let i = 0; i < LIMITS.exams; i++) p.exams[`e${String(i).padStart(10, '0')}`] = { m: 'full', at: ts + i, s: 25, n: 30, d: 1700, u: Object.fromEntries([...Array(10)].map((_, k) => [`u${String(k + 1).padStart(2, '0')}`, [3, 3]])) };
  const clean = sanitizeProgress(p);
  assert.equal(Object.keys(clean.ai).length, 200);
  const bytes = new TextEncoder().encode(JSON.stringify(clean)).byteLength;
  assert.ok(bytes < MAX_BYTES, `${bytes} B ≥ ${MAX_BYTES}`);
});
