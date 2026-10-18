// D1 fixed-window rate limiter. Two buckets per request:
//  - per IP:   600 requests / minute. A school lab often shares ONE public IP behind NAT, so this must
//              leave room for a whole class (30 students × ~20 sync requests/min) while still stopping floods.
//  - per code:  60 requests / minute for one learner code (the client debounces PUTs to ~1 per 3 s, so one
//              or two devices stay far below this).
// Bucket keys are SHA-256 hashes (raw IPs and codes are never stored). Fails open if D1 errors.
import { sha256Hex } from '../../public/js/core/learnerCode.js';

export const LIMIT_PER_IP = 600;
export const LIMIT_PER_CODE = 60;
/** @deprecated kept for older imports: the per-learner-code limit */
export const LIMIT_PER_MIN = LIMIT_PER_CODE;

async function hit(db, bucketKey, limit, now, rand) {
  try {
    const windowStart = Math.floor(now / 60000);
    const bucket = bucketKey + ':' + windowStart;
    const row = await db
      .prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES(?1,?2,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count')
      .bind(bucket, windowStart)
      .first();
    if (rand() < 1 / 50) {
      await db.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(windowStart - 60).run();
    }
    const count = Number(row && row.count) || 1;
    return { ok: count <= limit, count };
  } catch {
    return { ok: true, count: 0 };
  }
}

/** Per-IP limit. @returns {Promise<{ok:boolean, count:number}>} */
export async function rateLimit(db, request, now = Date.now(), rand = Math.random) {
  let ipHash;
  try { ipHash = await sha256Hex(request.headers.get('CF-Connecting-IP') || 'unknown'); } catch { return { ok: true, count: 0 }; }
  return hit(db, 'ip:' + ipHash, LIMIT_PER_IP, now, rand);
}

/** Per-learner-code limit; `codeHash` is already the SHA-256 of the code. */
export function rateLimitCode(db, codeHash, now = Date.now(), rand = Math.random) {
  return hit(db, 'c:' + codeHash, LIMIT_PER_CODE, now, rand);
}
