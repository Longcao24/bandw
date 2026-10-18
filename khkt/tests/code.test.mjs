import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalize, hash, fromBytes, CODE_RE, isValid } from '../public/js/core/learnerCode.js';

test('format: BW- + 7 groups of 4, Crockford alphabet', () => {
  const c = generate();
  assert.match(c, CODE_RE);
  assert.match(c, /^BW(-[0-9A-HJKMNP-TV-Z]{4}){7}$/);
  assert.equal(c.length, 37); // "BW-" + 28 chars + 6 dashes (spec text said 38)
  assert.ok('01234567'.includes(c[3]), 'first data char encodes top 3 bits');
});

test('normalize accepts lowercase, spaces, missing dashes and O/I/L', () => {
  const c = generate();
  assert.equal(normalize(c.toLowerCase()), c);
  assert.equal(normalize(c.replace(/-/g, ' ')), c);
  assert.equal(normalize(c.slice(3).replace(/-/g, '')), c);
  const zeroOne = fromBytes(new Uint8Array(16)); // all zeros → only '0' chars + checksum
  assert.equal(normalize(zeroOne.replace(/0/g, 'O')), zeroOne);
  const ones = fromBytes(Uint8Array.from({ length: 16 }, () => 0x08));
  assert.ok(ones.includes('1'));
  assert.equal(normalize(ones.replace(/1/g, 'l')), ones);
  assert.equal(normalize(ones.replace(/1/g, 'I')), ones);
});

test('normalize rejects bad checksum, bad length, bad chars and first char > 7', () => {
  const c = generate();
  const body = c.replace(/^BW-/, '').replace(/-/g, '');
  const flipped = body.slice(0, 5) + (body[5] === 'A' ? 'B' : 'A') + body.slice(6);
  assert.equal(normalize(flipped), null);
  assert.equal(normalize(body.slice(0, 27)), null);
  assert.equal(normalize(body.slice(0, 27) + 'U'), null);
  assert.equal(normalize('Z' + body.slice(1)), null);
  assert.equal(normalize(''), null);
  assert.equal(normalize(null), null);
  assert.equal(isValid('BW-hello'), false);
});

test('1000 generated codes are unique and valid', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) { const c = generate(); assert.ok(isValid(c)); set.add(c); }
  assert.equal(set.size, 1000);
});

test('hash is stable SHA-256 hex of the canonical code (known vector)', async () => {
  const c = fromBytes(new Uint8Array(16));
  assert.equal(c, 'BW-0000-0000-0000-0000-0000-0000-0000');
  const h = await hash(c.toLowerCase());
  assert.equal(h, '9f2dbbcf9450e18a6de313c3e36b38d7b5a28b5d11732398e4eb08d0c1ee4c70');
  assert.match(h, /^[0-9a-f]{64}$/);
  const { createHash } = await import('node:crypto');
  assert.equal(h, createHash('sha256').update('BW-0000-0000-0000-0000-0000-0000-0000').digest('hex'));
  assert.equal(await hash(c), h);
});
