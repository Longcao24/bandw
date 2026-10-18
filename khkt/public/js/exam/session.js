// Mock-exam state that stays on THIS device: the in-progress attempt (so a refresh resumes it, timer
// included) and the full answers of recent finished attempts (for the review page). Only the summary
// goes into the synced progress model (store.recordExam). Pure apart from the storage passed in.
import { KEYS } from '../progress/store.js';
import { EXAM_ID_RE } from '../core/merge.js';

export const MAX_DETAILS = 8;

function read(storage, key) {
  try { const raw = storage.get(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** The attempt in progress, or null. Shape-checked so a corrupt entry never breaks the page. */
export function loadCurrent(storage) {
  const a = read(storage, KEYS.examCurrent);
  if (!a || a.v !== 1 || !EXAM_ID_RE.test(a.id || '') || !Array.isArray(a.qs) || !a.qs.length) return null;
  a.ans = a.ans && typeof a.ans === 'object' ? a.ans : {};
  a.flags = Array.isArray(a.flags) ? a.flags : [];
  a.cur = Number.isInteger(a.cur) && a.cur >= 0 && a.cur < a.qs.length ? a.cur : 0;
  return a;
}
export function saveCurrent(storage, attempt) { storage.set(KEYS.examCurrent, JSON.stringify(attempt)); }
export function clearCurrent(storage) { storage.remove(KEYS.examCurrent); }

/** Seconds left (can be negative) for a timed attempt; Infinity when untimed. */
export function secondsLeft(attempt, now = Date.now()) {
  if (!attempt || !attempt.deadline) return Infinity;
  return Math.ceil((attempt.deadline - now) / 1000);
}

export function loadDetails(storage) {
  const d = read(storage, KEYS.examDetails);
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}
export function loadDetail(storage, id) { return loadDetails(storage)[id] || null; }
/** Keeps the newest MAX_DETAILS finished attempts with their answers. */
export function saveDetail(storage, detail) {
  const all = loadDetails(storage);
  all[detail.id] = detail;
  const keep = Object.values(all).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, MAX_DETAILS);
  storage.set(KEYS.examDetails, JSON.stringify(Object.fromEntries(keep.map((x) => [x.id, x]))));
}

export function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s} giây`;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}
export function fmtDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Khan-style encouragement by percentage. */
export function cheer(pct) {
  if (pct >= 90) return { icon: '🏆', title: 'Xuất sắc!', text: 'Em nắm rất chắc dự án. Hãy thử Phản biện thử để luyện nói thành lời nhé.' };
  if (pct >= 70) return { icon: '🌟', title: 'Rất tốt!', text: 'Em đã vững phần lớn kiến thức. Ôn lại vài chỗ còn sai là sẵn sàng đối mặt giám khảo.' };
  if (pct >= 50) return { icon: '💪', title: 'Đang tiến bộ!', text: 'Nửa chặng đường rồi. Xem lại các chương được gợi ý bên dưới, rồi làm lại đề nhé.' };
  return { icon: '🌱', title: 'Khởi đầu tốt!', text: 'Ai cũng bắt đầu từ đây. Mỗi câu sai là một chỗ em biết cần ôn. Xem lại bài học được gợi ý rồi thử lại nhé.' };
}
