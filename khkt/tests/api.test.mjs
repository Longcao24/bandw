import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, onRequest } from '../functions/api/progress.js';
import { createMockD1 } from './helpers/mock-d1.mjs';
import { generate } from '../public/js/core/learnerCode.js';

const ORIGIN = 'https://bandw-khkt.pages.dev';
const URL_ = ORIGIN + '/api/progress';
let ipSeq = 0;
function req(method, { code, body, headers = {}, ip } = {}) {
  const h = new Headers({ 'CF-Connecting-IP': ip || `10.0.0.${++ipSeq % 250}`, ...headers });
  if (code) h.set('X-Learner-Code', code);
  let b;
  if (body !== undefined) {
    b = typeof body === 'string' ? body : JSON.stringify(body);
    if (!h.has('Content-Type')) h.set('Content-Type', 'application/json');
  }
  return new Request(URL_, { method, headers: h, body: b });
}
const prog = (extra = {}) => ({ v: 1, updatedAt: 1, ex: {}, lessons: {}, cards: {}, videos: {}, streak: { cur: 0, best: 0, day: '' }, last: null, ...extra });

test('GET unknown code → 404; bad code → 400', async () => {
  const env = { DB: createMockD1() };
  let r = await handle(req('GET', { code: generate() }), env);
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: 'not_found' });
  assert.equal(r.headers.get('Content-Type'), 'application/json; charset=utf-8');
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  r = await handle(req('GET', { code: 'BW-NOPE' }), env);
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'bad_code' });
  r = await handle(req('GET', {}), env);
  assert.equal(r.status, 400);
});

test('PUT creates, GET returns, second PUT merges (union, never loses data)', async () => {
  const db = createMockD1();
  const env = { DB: db };
  const code = generate();
  let r = await handle(req('PUT', { code, body: prog({ ex: { 'u01.l1.q1': { c: 1, a: 1, p: 10 } }, videos: { 'v-ble': 1 } }) }), env, 1000);
  assert.equal(r.status, 200);
  let j = await r.json();
  assert.equal(j.updatedAt, 1000);
  assert.ok(j.progress.ex['u01.l1.q1']);

  r = await handle(req('GET', { code: code.toLowerCase() }), env);
  assert.equal(r.status, 200);
  j = await r.json();
  assert.equal(j.progress.ex['u01.l1.q1'].p, 10);

  r = await handle(req('PUT', { code, body: prog({ ex: { 'u01.l1.q2': { c: 1, a: 2, p: 6 }, 'u01.l1.q1': { c: 0, a: 3, p: 0 } } }) }), env, 2000);
  j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(j.progress.ex['u01.l1.q1'], { c: 1, a: 3, p: 10 });
  assert.ok(j.progress.ex['u01.l1.q2']);
  assert.ok(j.progress.videos['v-ble']);
  assert.equal(db.progress.size, 1);
  assert.equal([...db.progress.values()][0].version, 2);
});

test('stored key is the 64-hex SHA-256 hash; raw code never reaches the DB', async () => {
  const db = createMockD1();
  const code = generate();
  await handle(req('PUT', { code, body: prog() }), { DB: db });
  const [key] = [...db.progress.keys()];
  assert.match(key, /^[0-9a-f]{64}$/);
  const { createHash } = await import('node:crypto');
  assert.equal(key, createHash('sha256').update(code).digest('hex'));
  const everything = JSON.stringify([...db.progress.entries()]) + JSON.stringify(db.log) + JSON.stringify([...db.rateLimits.entries()]);
  assert.ok(!everything.includes(code));
  assert.ok(!everything.includes(code.replace(/-/g, '')));
});

test('PUT validation: bad json, invalid shape, wrong type, too large', async () => {
  const env = { DB: createMockD1() };
  const code = generate();
  let r = await handle(req('PUT', { code, body: '{nope' }), env);
  assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: 'bad_json' });
  r = await handle(req('PUT', { code, body: { v: 2 } }), env);
  assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: 'invalid' });
  r = await handle(req('PUT', { code, body: prog(), headers: { 'Content-Type': 'text/plain' } }), env);
  assert.equal(r.status, 415); assert.deepEqual(await r.json(), { error: 'bad_type' });
  const big = prog({ junk: 'x'.repeat(70000) });
  r = await handle(req('PUT', { code, body: big }), env);
  assert.equal(r.status, 413); assert.deepEqual(await r.json(), { error: 'too_large' });
  r = await handle(req('PUT', { code: 'garbage', body: prog() }), env);
  assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: 'bad_code' });
});

test('PUT of ~40 KB valid progress (above the old 32 KB column cap, under MAX_BYTES) → 200 and stored', async () => {
  const db = createMockD1();
  const env = { DB: db };
  const code = generate();
  const ex = {};
  for (let u = 1; u <= 10; u++) for (let l = 1; l <= 9; l++) for (let q = 1; q <= 12; q++) ex[`u${String(u).padStart(2, '0')}.l${l}.q${q}`] = { c: 1, a: 2, p: 10 };
  const exams = {};
  for (let i = 0; i < 30; i++) exams[`e${String(i).padStart(8, '0')}`] = { m: 'full', at: 1000 + i, s: 20, n: 30, d: 1500, u: { u01: [2, 3], u02: [3, 3], u03: [2, 3], u04: [1, 3], u05: [3, 3], u06: [2, 3], u07: [2, 3], u08: [3, 3], u09: [1, 3] } };
  const body = prog({ ex, exams });
  const size = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  assert.ok(size > 36000 && size < 65536, `payload ${size} B`);
  const r = await handle(req('PUT', { code, body }), env, 5000);
  assert.equal(r.status, 200);
  const stored = [...db.progress.values()][0].data;
  assert.ok(stored.length > 32768, `stored ${stored.length} chars`);
  assert.equal(Object.keys(JSON.parse(stored).exams).length, 30);
});

test('schema.sql and the D1 migration allow exactly MAX_BYTES, so the API limit is reachable', async () => {
  const { readFileSync } = await import('node:fs');
  const { MAX_BYTES } = await import('../functions/api/progress.js');
  for (const f of ['schema.sql', 'db-migrations/progress_64kb.sql']) {
    const sql = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    const m = sql.match(/length\(data\) <= (\d+)/);
    assert.ok(m, f);
    assert.equal(Number(m[1]), MAX_BYTES, f);
  }
});

test('foreign Origin / cross-site fetch → 403', async () => {
  const env = { DB: createMockD1() };
  const code = generate();
  let r = await handle(req('PUT', { code, body: prog(), headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(r.status, 403); assert.deepEqual(await r.json(), { error: 'bad_origin' });
  r = await handle(req('GET', { code, headers: { 'Sec-Fetch-Site': 'cross-site' } }), env);
  assert.equal(r.status, 403);
  r = await handle(req('PUT', { code, body: prog(), headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' } }), env);
  assert.equal(r.status, 200);
});

test('61st request in a minute for one learner code → 429 with Retry-After: 60', async () => {
  const env = { DB: createMockD1() };
  const code = generate();
  const now = 1_700_000_000_000;
  for (let i = 0; i < 60; i++) {
    const r = await handle(req('GET', { code, ip: '1.2.3.4' }), env, now);
    assert.equal(r.status, 404, `request ${i + 1}`);
  }
  const r = await handle(req('GET', { code, ip: '1.2.3.4' }), env, now);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('Retry-After'), '60');
  assert.deepEqual(await r.json(), { error: 'rate_limited' });
  // Another learner on the same (school) IP is unaffected; next minute resets.
  assert.equal((await handle(req('GET', { code: generate(), ip: '1.2.3.4' }), env, now)).status, 404);
  assert.equal((await handle(req('GET', { code, ip: '1.2.3.4' }), env, now + 60_000)).status, 404);
  // The raw IP and code are never stored.
  assert.ok(![...env.DB.rateLimits.keys()].some((k) => k.includes('1.2.3.4') || k.includes(code)));
});

test('a classroom behind one IP: 30 learners × 20 requests/min pass; the 601st request from that IP → 429', async () => {
  const env = { DB: createMockD1() };
  const now = 1_700_000_000_000;
  const codes = Array.from({ length: 30 }, () => generate());
  for (let i = 0; i < 20; i++) {
    for (const code of codes) {
      const r = await handle(req('GET', { code, ip: '9.9.9.9' }), env, now);
      assert.equal(r.status, 404);
    }
  }
  const r = await handle(req('GET', { code: generate(), ip: '9.9.9.9' }), env, now);
  assert.equal(r.status, 429);
});

test('two devices PUT at the same moment: both contributions survive (version compare-and-swap)', async () => {
  const db = createMockD1();
  const env = { DB: db };
  const code = generate();
  await handle(req('PUT', { code, body: prog({ ex: { 'u01.l1.q1': { c: 1, a: 1, p: 10 } } }) }), env, 1000);
  // Device B's write lands between device A's read and A's UPDATE.
  const prepare = db.prepare.bind(db);
  let injected = false;
  db.prepare = (sql) => {
    if (!injected && /^UPDATE progress/.test(sql)) {
      injected = true;
      const [hash, row] = [...db.progress.entries()][0];
      const data = JSON.parse(row.data);
      data.ex['u01.l1.q3'] = { c: 1, a: 1, p: 10 };
      db.progress.set(hash, { ...row, data: JSON.stringify(data), version: row.version + 1 });
    }
    return prepare(sql);
  };
  const r = await handle(req('PUT', { code, body: prog({ ex: { 'u01.l1.q2': { c: 1, a: 1, p: 10 } } }) }), env, 2000);
  assert.equal(r.status, 200);
  const stored = JSON.parse([...db.progress.values()][0].data);
  assert.deepEqual(Object.keys(stored.ex).sort(), ['u01.l1.q1', 'u01.l1.q2', 'u01.l1.q3']);
  assert.equal([...db.progress.values()][0].version, 3);
  assert.equal(db.log.filter((l) => /^UPDATE progress/.test(l.sql)).length, 2); // first UPDATE matched 0 rows → retried
});

test('rate limiter fails open when its query fails', async () => {
  const env = { DB: createMockD1({ failRateLimit: true }) };
  const r = await handle(req('GET', { code: generate() }), env);
  assert.equal(r.status, 404);
});

test('OPTIONS → 204 without CORS headers; POST → 405; no DB → 503', async () => {
  const env = { DB: createMockD1() };
  let r = await handle(req('OPTIONS', { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'PUT' } }), env);
  assert.equal(r.status, 204);
  for (const [k] of r.headers) assert.ok(!k.toLowerCase().startsWith('access-control-'), k);
  r = await handle(req('POST', { code: generate(), body: prog() }), env);
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('Allow'), 'GET, PUT, OPTIONS');
  r = await handle(req('DELETE', { code: generate() }), env);
  assert.equal(r.status, 405);
  r = await handle(req('GET', { code: generate() }), {});
  assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'no_db' });
  r = await onRequest({ request: req('PUT', { code: generate(), body: prog() }), env: {} });
  assert.equal(r.status, 503);
});
