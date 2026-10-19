// public/content/defense-index.js — CHỈ MỘT danh sách câu hỏi phản biện, dùng chung cho trang /question,
// bộ chấm AI (functions/api/grade.js) và kiểm thử. Module thuần (không đụng DOM), chạy được trong
// trình duyệt, Node và Cloudflare Pages Functions.
//
// Câu hỏi phản biện được ĐẾM = mọi bước `flashcard` nằm trong bài học (lessons[].steps[]) + `bank.open`
// của đề thi. Thẻ `unit.defense` (không gắn với bài nào) không được đếm nhưng vẫn tra được bằng byId()
// để chấm AI ở chế độ Luyện phản biện.
//
// API:
//   list()          → [item]  (đúng thứ tự giáo trình: chương → bài → bước; câu của ngân hàng đề cuối chương)
//   byId(id)        → item | null   (gồm cả unit.defense)
//   count()         → số câu được đếm (= list().length)
//   topics()        → [{ id, label, icon, count }] các chủ đề đang có
//   fold(s)         → chuỗi thường, bỏ dấu tiếng Việt (đ → d) để tìm kiếm
//   matches(item,q) → true nếu item khớp từ khoá q (không phân biệt dấu)
//   gradingPayload(item) → { id, prompt, modelAnswer, keyPoints, topic } (dữ liệu bộ chấm cần)
// item = { id, n, step, prompt, question, modelAnswer, keyPoints, unitId, unitIndex, unitTitle, unitIcon,
//          lessonId, lessonTitle, stepIndex, src: 'lesson'|'bank'|'unit-defense', embedded, topic, tag, href }
//   topic = broad group from TOPICS; tag = the writer's free-form `topic` string ('' when absent).
import { course } from './index.js';
import bank from './exam/bank.js';
import { fold } from '../js/grading/text.js';

export { fold };

// Broad topic groups for filtering. Writers tag each card with a free-form `topic` (e.g. 'BLE', 'Pin',
// 'Hạn chế'); that tag is kept as item.tag and mapped to one of these groups.
export const TOPICS = [
  { id: 'y-tuong', label: 'Ý tưởng, người dùng & làm việc nhóm', icon: '💡' },
  { id: 'cam-bien', label: 'Cảm biến IMU & góc', icon: '🧭' },
  { id: 'cu-chi', label: 'Nhận diện cử chỉ', icon: '✋' },
  { id: 'firmware', label: 'Firmware, code & phần cứng', icon: '🔧' },
  { id: 'ble', label: 'Bluetooth & kết nối', icon: '📶' },
  { id: 'app', label: 'App Android & giọng nói', icon: '📱' },
  { id: 'thi-nghiem', label: 'Thử nghiệm, độ chính xác & hạn chế', icon: '🧪' },
  { id: 'an-toan', label: 'An toàn, riêng tư, đạo đức & chi phí', icon: '🛡️' },
  { id: 'khac', label: 'Khác', icon: '❓' },
];
const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

// Writer tags → group (checked first, order = priority).
const TAG_RULES = [
  ['an-toan', /an toan|bao mat|rieng tu|dao duc|chi phi|gia thanh|y te/],
  ['thi-nghiem', /thi nghiem|kiem thu|ma tran|nguoi thu|phuong phap|chinh xac|han che|do dac|so lieu|cau hoi bay/],
  ['y-tuong', /nguoi dung|nhu cau|tinh moi|so sanh|thuong mai|phat trien|y tuong|ung dung|run tay|yeu co|lam viec nhom/],
  ['ble', /\bble\b|bluetooth|ket noi|offline/],
  ['app', /android|\btts\b|giong noi|\bapp\b/],
  ['cam-bien', /gia toc|con quay|atan2|goc|hieu chuan|\bimu\b|cam bien|deo sai|truc (x|y|z)|bo loc|lam muot/],
  ['cu-chi', /cu chi|nguong|vung tre|hoc may|thuat toan|nhan dien|may trang thai|go doi|\byes\b|\bno\b|\bhelp\b|\blac\b|nghieng|\bgiu\b|cooldown|thoi gian nghi/],
  ['firmware', /firmware|watchdog|phan cung|go loi|\bpin\b|chip|kien truc|\bcode\b|\bham\b|hang so|bien|kieu du lieu|\bif\b|enum|millis|tran so/],
];
// Fallback on the question text when a card has no (recognisable) tag. Order = priority.
const RULES = [
  ['thi-nghiem', /thi nghiem|kiem thu|chinh xac|han che|do (bang|nhu|the nao|duoc)|nguoi that|ma tran nham|bao nhieu nguoi|ty le|ti le|chua do|gesture_test/],
  ['an-toan', /an toan|dao duc|rieng tu|chi phi|gia thanh|bao nhieu tien|y te|nguy hiem|thay the nguoi/],
  ['ble', /bluetooth|\bble\b|ket noi|noi lai|notify|gatt|characteristic|quang ba|ngat/],
  ['app', /\bapp\b|android|giong noi|\btts\b|dien thoai|man hinh|service|doc thanh tieng/],
  ['cu-chi', /water|food|\bhelp\b|\byes\b|\bno\b|lac|nghieng|go 2|go hai|go doi|cu chi|nguong|tre|hysteresis|cooldown|trung tinh|nhap/],
  ['cam-bien', /\bimu\b|gia toc|con quay|cam bien|atan2|arctan|goc|hieu chuan|lsm6|truc/],
  ['firmware', /firmware|loop|watchdog|chip|nrf|\bcode\b|ham |bien |hang so|arduino|\bpin\b|bo nho|\bram\b|\bflash\b/],
  ['y-tuong', /nguoi dung|benh nhan|y tuong|nguoi cham soc|giao tiep|khiem|lien he|ung dung/],
];
function classify(text, rules = RULES) {
  const f = fold(text);
  for (const [id, re] of rules) if (re.test(f)) return id;
  return null;
}

/** The card's own free-form tag (topic/category/tag/tags[0]) or ''. */
export function tagOf(step) {
  const raw = step && (step.topic || step.category || step.tag || (Array.isArray(step.tags) ? step.tags[0] : null));
  return typeof raw === 'string' ? raw.trim() : '';
}

/** Broad topic group { id, label, icon } from the tag, else from the question text. */
export function topicOf(step) {
  const raw = tagOf(step);
  if (raw) {
    const f = fold(raw);
    const known = TOPICS.find((t) => t.id === f || fold(t.label) === f);
    if (known) return known;
    const g = classify(raw, TAG_RULES);
    if (g) return TOPIC_BY_ID.get(g);
  }
  const id = classify(step ? step.prompt : '') || classify(step ? `${step.modelAnswer} ${(step.keyPoints || []).join(' ')}` : '') || 'khac';
  return TOPIC_BY_ID.get(id);
}

/** 'Giám khảo hỏi: "…"' → '…' */
export function questionText(prompt) {
  return String(prompt || '').replace(/^\s*Giám khảo hỏi\s*:\s*/i, '').replace(/^["“](.*)["”]\s*$/s, '$1').trim();
}

export const lessonHref = (unitId, lessonId, stepId) =>
  lessonId ? `#/unit/${unitId}/lesson/${lessonId}${stepId ? `/q/${stepId}` : ''}` : `#/unit/${unitId}`;

function build() {
  const listed = [];
  const extra = [];
  const unitIdx = new Map(course.units.map((u, i) => [u.id, i]));
  const bankByUnit = new Map();
  for (const q of (bank && bank.open) || []) {
    if (!q || q.type !== 'flashcard') continue;
    const k = unitIdx.has(q.unitId) ? q.unitId : '#none';
    if (!bankByUnit.has(k)) bankByUnit.set(k, []);
    bankByUnit.get(k).push(q);
  }
  const make = (step, u, lesson, stepIndex, src) => {
    const topic = topicOf(step);
    return {
      id: step.id, n: 0, step, prompt: step.prompt, question: questionText(step.prompt),
      modelAnswer: step.modelAnswer || '', keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints : [],
      unitId: u ? u.id : (step.unitId || null), unitIndex: u ? unitIdx.get(u.id) + 1 : 0,
      unitTitle: u ? u.title : '', unitIcon: u ? u.icon : '📘',
      lessonId: lesson ? lesson.id : null, lessonTitle: lesson ? lesson.title : '',
      stepIndex, src, embedded: src === 'lesson', topic, tag: tagOf(step),
      href: lessonHref(u ? u.id : step.unitId, lesson ? lesson.id : null, src === 'lesson' ? step.id : null),
    };
  };
  for (const u of course.units) {
    for (const l of u.lessons || []) {
      (l.steps || []).forEach((s, i) => { if (s && s.type === 'flashcard') listed.push(make(s, u, l, i, 'lesson')); });
    }
    for (const q of bankByUnit.get(u.id) || []) {
      const l = (u.lessons || []).find((x) => x.id === q.lessonId) || null;
      listed.push(make(q, u, l, null, 'bank'));
    }
    for (const s of u.defense || []) if (s && s.type === 'flashcard') extra.push(make(s, u, null, null, 'unit-defense'));
  }
  for (const q of bankByUnit.get('#none') || []) listed.push(make(q, null, null, null, 'bank'));
  listed.forEach((it, i) => { it.n = i + 1; it.search = fold(`${it.question} ${it.modelAnswer} ${it.keyPoints.join(' ')} ${it.topic.label} ${it.tag} ${it.unitTitle} ${it.lessonTitle} ${it.id}`); });
  const map = new Map();
  for (const it of [...listed, ...extra]) if (!map.has(it.id)) map.set(it.id, it);
  return { listed, map };
}

let cache = null;
const data = () => cache || (cache = build());

export const list = () => data().listed;
export const byId = (id) => data().map.get(id) || null;
export const count = () => data().listed.length;

export function topics() {
  const n = new Map();
  for (const it of list()) n.set(it.topic.id, { ...it.topic, count: (n.get(it.topic.id)?.count || 0) + 1 });
  const order = new Map(TOPICS.map((t, i) => [t.id, i]));
  return [...n.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.label.localeCompare(b.label, 'vi'));
}

/** Accent-insensitive: every word of q must appear in the item's text. */
export function matches(item, q) {
  const words = fold(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = item.search || fold(`${item.question} ${item.modelAnswer} ${item.keyPoints.join(' ')}`);
  return words.every((w) => hay.includes(w));
}

/** What the grader needs about one question (the server looks it up by id; never trust the client's copy). */
export function gradingPayload(item) {
  if (!item) return null;
  return { id: item.id, prompt: item.question, modelAnswer: item.modelAnswer, keyPoints: item.keyPoints.slice(), topic: item.tag || item.topic.label };
}

export default { list, byId, count, topics, fold, matches, topicOf, tagOf, questionText, gradingPayload, TOPICS };
