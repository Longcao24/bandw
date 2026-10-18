-- Nâng giới hạn cột progress.data từ 32 768 lên 65 536 ký tự (khớp MAX_BYTES = 64 KB trong functions/api/progress.js).
-- SQLite không ALTER được ràng buộc CHECK, nên tạo bảng mới, chép dữ liệu, xoá bảng cũ rồi đổi tên.
-- Chạy MỘT lần trên D1 đã tạo bằng schema.sql cũ (trước khi triển khai bản này): npm run db:migrate:remote
-- Chạy lại trên bảng đã nâng cấp cũng an toàn (chỉ chép lại cùng dữ liệu).
CREATE TABLE IF NOT EXISTS progress_new (
  code_hash  TEXT PRIMARY KEY CHECK (length(code_hash) = 64),
  data       TEXT NOT NULL CHECK (length(data) <= 65536),
  version    INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT OR REPLACE INTO progress_new (code_hash, data, version, created_at, updated_at)
  SELECT code_hash, data, version, created_at, updated_at FROM progress;
DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;
