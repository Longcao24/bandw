// Cloudflare Pages Function: /api/progress
// Stores ONLY learner progress JSON keyed by SHA-256(learner code). Questions never touch the server.
import { normalize, sha256Hex } from '../../public/js/core/learnerCode.js';
import { sanitizeProgress, mergeProgress } from '../../public/js/core/merge.js';
import { rateLimit, rateLimitCode } from '../_lib/ratelimit.js';

// 64 KB: a learner who finished the whole course (~400 exercises + cards) plus 30 exam summaries needs ~35 KB.
export const MAX_BYTES = 65536;
const BASE_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

function json(status, body, extra = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...BASE_HEADERS, ...extra } });
}
const err = (status, code, extra) => json(status, { error: code }, extra);

function badOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return true;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return true;
  return false;
}

async function loadRow(db, codeHash) {
  return db.prepare('SELECT data, updated_at, version FROM progress WHERE code_hash = ?1').bind(codeHash).first();
}
const changes = (res) => Number(res && res.meta && res.meta.changes) || 0;
const MAX_ATTEMPTS = 3;

export async function handle(request, env = {}, now = Date.now()) {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store', Allow: 'GET, PUT, OPTIONS' } });
  if (method !== 'GET' && method !== 'PUT') return err(405, 'method_not_allowed', { Allow: 'GET, PUT, OPTIONS' });
  if (badOrigin(request)) return err(403, 'bad_origin');
  const db = env.DB;
  if (!db) return err(503, 'no_db');

  const rl = await rateLimit(db, request, now);
  if (!rl.ok) return err(429, 'rate_limited', { 'Retry-After': '60' });

  const code = normalize(request.headers.get('X-Learner-Code') || '');
  if (!code) return err(400, 'bad_code');
  const codeHash = await sha256Hex(code);
  const rlc = await rateLimitCode(db, codeHash, now);
  if (!rlc.ok) return err(429, 'rate_limited', { 'Retry-After': '60' });

  if (method === 'GET') {
    let row;
    try { row = await loadRow(db, codeHash); } catch { return err(503, 'no_db'); }
    if (!row) return err(404, 'not_found');
    let progress;
    try { progress = sanitizeProgress(JSON.parse(row.data)); } catch { progress = null; }
    if (!progress) return err(404, 'not_found');
    return json(200, { progress, updatedAt: Number(row.updated_at) });
  }

  // PUT
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return err(415, 'bad_type');
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return err(413, 'too_large');
  let text;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return err(413, 'too_large');
    text = new TextDecoder().decode(buf);
  } catch { return err(400, 'bad_json'); }
  let raw;
  try { raw = JSON.parse(text); } catch { return err(400, 'bad_json'); }
  const incoming = sanitizeProgress(raw);
  if (!incoming) return err(400, 'invalid');

  // Optimistic concurrency: read (data, version), merge, then write only if the version is unchanged.
  // If another device wrote in between, nothing changes, so re-read, re-merge and try again.
  let merged = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !merged; attempt++) {
    let row, existing = null;
    try { row = await loadRow(db, codeHash); } catch { return err(503, 'no_db'); }
    if (row) { try { existing = sanitizeProgress(JSON.parse(row.data)); } catch { existing = null; } }
    const candidate = mergeProgress(existing, incoming);
    const data = JSON.stringify(candidate);
    if (new TextEncoder().encode(data).byteLength > MAX_BYTES) return err(413, 'too_large');
    let res;
    try {
      res = row
        ? await db.prepare('UPDATE progress SET data = ?2, updated_at = ?3, version = version + 1 WHERE code_hash = ?1 AND version = ?4')
          .bind(codeHash, data, now, Number(row.version) || 1).run()
        : await db.prepare('INSERT INTO progress (code_hash, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?3) ON CONFLICT(code_hash) DO NOTHING')
          .bind(codeHash, data, now).run();
    } catch { return err(503, 'no_db'); }
    if (changes(res) > 0) merged = candidate;
  }
  if (!merged) return err(409, 'conflict'); // client backs off and pushes its full progress again
  return json(200, { progress: merged, updatedAt: now });
}

export const onRequest = (context) => handle(context.request, context.env);
