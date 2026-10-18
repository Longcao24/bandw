import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProgress, sanitizeProgress, totalPoints, emptyProgress } from '../public/js/core/merge.js';

const A = {
  v: 1, updatedAt: 100,
  ex: { 'u01.l1.q1': { c: 1, a: 1, p: 10, t: 50 }, 'u01.l1.q2': { c: 0, a: 2, p: 0 } },
  lessons: { 'u01.l1': { d: 1, s: 3, p: 20, at: 90 } },
  cards: { 'u01.l1.q9': { r: 'again', n: 1, at: 80 } },
  videos: { 'v-ble': 1 },
  streak: { cur: 3, best: 5, day: '2026-10-17' },
  last: { u: 'u01', l: 'l1', s: 3, at: 90 },
};
const B = {
  v: 1, updatedAt: 200,
  ex: { 'u01.l1.q1': { c: 1, a: 3, p: 6, t: 40 }, 'u02.l1.q1': { c: 1, a: 1, p: 10, t: 120 } },
  lessons: { 'u01.l1': { d: 0, s: 7, p: 0, at: 150 }, 'u02.l1': { d: 0, s: 2, p: 0, at: 160 } },
  cards: { 'u01.l1.q9': { r: 'good', n: 2, at: 140 }, 'u03.d.q1': { r: 'good', n: 1, at: 10 } },
  videos: { 'v-imu-tilt': 1 },
  streak: { cur: 1, best: 2, day: '2026-10-18' },
  last: { u: 'u02', l: 'l1', s: 2, at: 160 },
};

test('merge is commutative and idempotent', () => {
  const ab = mergeProgress(A, B), ba = mergeProgress(B, A);
  assert.deepEqual(ab, ba);
  assert.deepEqual(mergeProgress(ab, ab), ab);
  assert.deepEqual(mergeProgress(ab, A), ab);
  assert.deepEqual(mergeProgress(mergeProgress(A, B), B), ab);
});

test('per-field rules', () => {
  const m = mergeProgress(A, B);
  assert.deepEqual(m.ex['u01.l1.q1'], { c: 1, a: 3, p: 10, t: 40 });
  assert.deepEqual(m.ex['u01.l1.q2'], { c: 0, a: 2, p: 0 });
  assert.ok(m.ex['u02.l1.q1']);
  assert.deepEqual(m.lessons['u01.l1'], { d: 1, s: 7, p: 20, at: 150 }); // s from newer at
  assert.deepEqual(m.cards['u01.l1.q9'], { r: 'good', n: 2, at: 140 });
  assert.deepEqual(m.videos, { 'v-ble': 1, 'v-imu-tilt': 1 });
  assert.deepEqual(m.streak, { cur: 1, best: 5, day: '2026-10-18' });
  assert.deepEqual(m.last, B.last);
  assert.equal(m.updatedAt, 200);
});

test('card tie on `at` → good wins; lesson tie on `at` → larger s; same-day streak → max cur', () => {
  const x = { ...emptyProgress(), cards: { 'u01.l1.q9': { r: 'again', n: 4, at: 5 } }, lessons: { 'u01.l1': { d: 0, s: 2, p: 0, at: 9 } }, streak: { cur: 2, best: 2, day: '2026-10-18' } };
  const y = { ...emptyProgress(), cards: { 'u01.l1.q9': { r: 'good', n: 1, at: 5 } }, lessons: { 'u01.l1': { d: 0, s: 5, p: 0, at: 9 } }, streak: { cur: 4, best: 4, day: '2026-10-18' } };
  const m = mergeProgress(x, y);
  assert.deepEqual(m.cards['u01.l1.q9'], { r: 'good', n: 4, at: 5 });
  assert.equal(m.lessons['u01.l1'].s, 5);
  assert.deepEqual(m.streak, { cur: 4, best: 4, day: '2026-10-18' });
  assert.deepEqual(mergeProgress(y, x), m);
});

test('merging never loses data (union)', () => {
  const m = mergeProgress(A, B);
  for (const src of [A, B]) {
    for (const k of Object.keys(src.ex)) assert.ok(m.ex[k]);
    for (const k of Object.keys(src.lessons)) assert.ok(m.lessons[k]);
    for (const k of Object.keys(src.cards)) assert.ok(m.cards[k]);
    for (const k of Object.keys(src.videos)) assert.ok(m.videos[k]);
  }
});

test('sanitize strips junk, bad ids and clamps numbers', () => {
  const dirty = {
    v: 1, updatedAt: '123', hacker: true,
    ex: { 'u01.l1.q1': { c: 5, a: 99999, p: -3, t: 1.7, extra: 'x' }, 'bad id': { c: 1 }, '<script>': {}, 'u01.d.q2': { c: 1, a: 1, p: 6 } },
    lessons: { 'u01.l1': { d: true, s: 2.9, p: 1e20, at: 5 }, 'u1.l1': { d: 1 } },
    cards: { 'u01.l1.q9': { r: 'great', n: 1, at: 1 }, 'u01.l1.q8': { r: 'good', n: 1, at: 1 } },
    videos: { 'v-ble': 1, 'not a video': 1, 'v-imu-tilt': 0 },
    streak: { cur: 3, best: 9, day: '18/10/2026' },
    last: { u: 'u01', l: 'l1', s: 1, at: 2, evil: 1 },
  };
  const s = sanitizeProgress(dirty);
  assert.equal(s.hacker, undefined);
  assert.equal(s.updatedAt, 123);
  assert.deepEqual(s.ex['u01.l1.q1'], { c: 0, a: 1000, p: 0, t: 1 });
  assert.deepEqual(Object.keys(s.ex).sort(), ['u01.d.q2', 'u01.l1.q1']);
  assert.deepEqual(s.lessons, { 'u01.l1': { d: 1, s: 2, p: 1000, at: 5 } });
  assert.deepEqual(Object.keys(s.cards), ['u01.l1.q8']);
  assert.deepEqual(s.videos, { 'v-ble': 1 });
  assert.deepEqual(s.streak, { cur: 0, best: 9, day: '' });
  assert.deepEqual(s.last, { u: 'u01', l: 'l1', s: 1, at: 2 });
  assert.equal(sanitizeProgress({ v: 2 }), null);
  assert.equal(sanitizeProgress([]), null);
  assert.equal(sanitizeProgress('x'), null);
  assert.equal(sanitizeProgress(null), null);
});

test('sanitize limits key counts', () => {
  const ex = {};
  for (let u = 0; u < 30; u++) for (let l = 0; l < 10; l++) for (let q = 0; q < 10; q++) ex[`u${String(u).padStart(2, '0')}.l${l}.q${q}`] = { c: 1, a: 1, p: 10 };
  const s = sanitizeProgress({ v: 1, ex });
  assert.equal(Object.keys(s.ex).length, 2000);
});

test('points are derived: Σ ex.p + Σ lessons.p + 5 per rated card', () => {
  const m = mergeProgress(A, B);
  assert.equal(totalPoints(m), 10 + 0 + 10 + 20 + 0 + 5 + 5);
  assert.equal(totalPoints(emptyProgress()), 0);
});
