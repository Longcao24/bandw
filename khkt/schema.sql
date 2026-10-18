-- BandW KHKT: chỉ lưu tiến độ học, khoá bằng SHA-256 của mã học tập (không lưu mã gốc).
CREATE TABLE IF NOT EXISTS progress (
  code_hash  TEXT PRIMARY KEY CHECK (length(code_hash) = 64),
  data       TEXT NOT NULL CHECK (length(data) <= 65536),
  version    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
