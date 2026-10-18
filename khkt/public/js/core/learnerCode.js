// Learner code ("mã học tập"): 128 random bits, Crockford base32, 2-char checksum.
// Shared by the browser and the Pages Function. Pure: uses globalThis.crypto only inside functions.
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_RE = /^BW(-[0-9A-HJKMNP-TV-Z]{4}){7}$/;
const VAL = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

function checksum(vals) {
  let s = 0;
  for (let i = 0; i < vals.length; i++) s += (i + 1) * vals[i];
  return s % 1024;
}
function format(chars28) {
  const groups = chars28.match(/.{4}/g);
  return 'BW-' + groups.join('-');
}

/** 16 bytes → 26 base32 chars (first char = top 3 bits, so 0–7). */
export function encodeBytes(bytes) {
  let big = 0n;
  for (const b of bytes) big = (big << 8n) | BigInt(b);
  const out = [];
  for (let i = 0; i < 26; i++) { out.push(Number(big & 31n)); big >>= 5n; }
  out.reverse();
  return out;
}

export function fromBytes(bytes) {
  if (!bytes || bytes.length !== 16) throw new Error('need 16 bytes');
  const vals = encodeBytes(bytes);
  const c = checksum(vals);
  const all = [...vals, c >> 5, c & 31].map((v) => ALPHABET[v]).join('');
  return format(all);
}

export function generate() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return fromBytes(bytes);
}

/** Returns the canonical code or null. Accepts lowercase, spaces, dashes, O→0, I/L→1. */
export function normalize(input) {
  if (typeof input !== 'string') return null;
  let s = input.toUpperCase().replace(/[\s-]+/g, '');
  if (s.startsWith('BW')) s = s.slice(2);
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (s.length !== 28) return null;
  const vals = [];
  for (const ch of s) {
    if (!(ch in VAL)) return null;
    vals.push(VAL[ch]);
  }
  if (vals[0] > 7) return null;
  const c = checksum(vals.slice(0, 26));
  if (vals[26] !== c >> 5 || vals[27] !== (c & 31)) return null;
  return format(s);
}

export const isValid = (input) => normalize(input) !== null;

/** SHA-256 of the canonical code → 64 lowercase hex chars. */
export async function hash(code) {
  const canonical = normalize(code);
  if (!canonical) throw new Error('bad code');
  return sha256Hex(canonical);
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
