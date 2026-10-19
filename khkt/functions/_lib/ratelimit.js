// D1 fixed-window rate limiter. Two buckets per request:
//  - per IP:   600 requests / minute. A school lab often shares ONE public IP behind NAT, so this must
//              leave room for a whole class (30 students × ~20 sync requests/min) while still stopping floods.
//  - per code:  60 requests / minute for one learner code (the client debounces PUTs to ~1 per 3 s, so one
//              or two devices stay far below this).
// Bucket keys are SHA-256 hashes (raw IPs and codes are never stored). /api/progress fails open if D1
// errors (saving progress matters more); /api/grade passes { failOpen: false } so the AI is never unmetered.
import { sha256Hex } from '../../public/js/core/learnerCode.js';

export const LIMIT_PER_IP = 600;
export const LIMIT_PER_CODE = 60;
/** @deprecated kept for older imports: the per-learner-code limit */
export const LIMIT_PER_MIN = LIMIT_PER_CODE;

/**
 * Generic fixed-window counter. `windowMinutes` = 1 keeps the original bucket format. Longer windows (e.g. a
 * daily cap: 1440) store `window_start` = the LAST minute of the window, so the shared clean-up (rows older
 * than 60 minutes) only removes them one hour after their window has ended.
 * @returns {Promise<{ok:boolean, count:number, error?:true}>} on a D1 error: ok:true (fail open, default) or
 *          ok:false with error:true when opts.failOpen === false
 */
export async function hitWindow(db, bucketKey, limit, windowMinutes = 1, now = Date.now(), rand = Math.random, { failOpen = true } = {}) {
  try {
    const minute = Math.floor(now / 60000);
    const w = Math.max(1, Math.floor(windowMinutes));
    const index = Math.floor(minute / w);
    const windowStart = w === 1 ? minute : (index + 1) * w - 1;
    const bucket = w === 1 ? bucketKey + ':' + minute : bucketKey + ':w' + w + ':' + index;
    const row = await db
      .prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES(?1,?2,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count')
      .bind(bucket, windowStart)
      .first();
    if (rand() < 1 / 50) {
      await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(minute - 60).run();
    }
    const count = Number(row && row.count) || 1;
    return { ok: count <= limit, count };
  } catch {
    return failOpen ? { ok: true, count: 0 } : { ok: false, count: 0, error: true };
  }
}

const hit = (db, bucketKey, limit, now, rand) => hitWindow(db, bucketKey, limit, 1, now, rand);

/** SHA-256 of the client IP (raw IPs are never stored). null if hashing fails. */
export async function ipHash(request) {
  try { return await sha256Hex(request.headers.get('CF-Connecting-IP') || 'unknown'); } catch { return null; }
}

/** Per-IP limit. @returns {Promise<{ok:boolean, count:number}>} */
export async function rateLimit(db, request, now = Date.now(), rand = Math.random) {
  const h = await ipHash(request);
  if (!h) return { ok: true, count: 0 };
  return hit(db, 'ip:' + h, LIMIT_PER_IP, now, rand);
}

/** Per-learner-code limit; `codeHash` is already the SHA-256 of the code. */
export function rateLimitCode(db, codeHash, now = Date.now(), rand = Math.random) {
  return hit(db, 'c:' + codeHash, LIMIT_PER_CODE, now, rand);
}
