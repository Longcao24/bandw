// In-memory D1 mock: prepare(sql).bind(...).first()/run()/all(), pattern-matching the SQL used.
export function createMockD1({ failRateLimit = false } = {}) {
  const progress = new Map(); // code_hash → {data, version, created_at, updated_at}
  const rateLimits = new Map(); // bucket → {window_start, count}
  const log = [];
  function exec(sql, args, mode) {
    const s = sql.replace(/\s+/g, ' ').trim();
    log.push({ sql: s, args });
    if (/^INSERT INTO rate_limits/i.test(s)) {
      if (failRateLimit) throw new Error('D1 down');
      const [bucket, windowStart] = args;
      const row = rateLimits.get(bucket) || { window_start: windowStart, count: 0 };
      row.count += 1;
      rateLimits.set(bucket, row);
      return { count: row.count };
    }
    if (/^DELETE FROM rate_limits/i.test(s)) {
      for (const [k, v] of rateLimits) if (v.window_start < args[0]) rateLimits.delete(k);
      return null;
    }
    if (/^SELECT data, updated_at, version FROM progress WHERE code_hash/i.test(s)) {
      const r = progress.get(args[0]);
      return r ? { data: r.data, updated_at: r.updated_at, version: r.version } : null;
    }
    if (/^INSERT INTO progress .* ON CONFLICT\(code_hash\) DO NOTHING$/i.test(s)) {
      const [hash, data, now] = args;
      if (typeof hash !== 'string' || hash.length !== 64) throw new Error('CHECK constraint failed: code_hash');
      if (data.length > 65536) throw new Error('CHECK constraint failed: data');
      if (progress.has(hash)) return { changes: 0 };
      progress.set(hash, { data, version: 1, created_at: now, updated_at: now });
      return { changes: 1 };
    }
    if (/^UPDATE progress SET data = \?2, updated_at = \?3, version = version \+ 1 WHERE code_hash = \?1 AND version = \?4$/i.test(s)) {
      const [hash, data, now, version] = args;
      if (data.length > 65536) throw new Error('CHECK constraint failed: data');
      const prev = progress.get(hash);
      if (!prev || prev.version !== version) return { changes: 0 };
      progress.set(hash, { ...prev, data, updated_at: now, version: prev.version + 1 });
      return { changes: 1 };
    }
    throw new Error('Mock D1: unexpected SQL ' + s);
  }
  return {
    progress, rateLimits, log,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async first() { return exec(sql, args, 'first'); },
        async run() { const r = exec(sql, args, 'run'); return { success: true, meta: { changes: (r && r.changes) || 0 } }; },
        async all() { const r = exec(sql, args, 'all'); return { results: r ? [r] : [] }; },
      };
      return stmt;
    },
  };
}
