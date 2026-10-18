// Validates EVERY exam-bank question (public/content/exam/bank.js) the same way the course validator does,
// plus exam-only rules: unit/lesson links exist, ids unique (also vs the course), answers self-consistent,
// visuals and sims resolvable, and facts consistent with HEAD 4a0285a (no stale HELP "hold" rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { course } from '../public/content/index.js';
import bank, { FOLLOW_UPS, GENERIC_FOLLOW_UP } from '../public/content/exam/bank.js';
import { SIM_IDS, SIM_LOADERS } from '../public/js/sims/registry.js';
import { NAMED_DIAGRAMS, inlineHotspots, svgProblems } from '../public/js/diagrams/index.js';
import { extractTerms } from '../public/js/render/markdown.js';
import { AUTO_TYPES, gradeAnswer, idealAnswer, isAnswerShape } from '../public/js/exam/grade.js';

const QID = /^x\.q\d{2}$/;
const DID = /^x\.d\.q\d{2}$/;
const LANGS = ['cpp', 'java', 'text'];
const simMeta = {};
for (const id of SIM_IDS) { try { simMeta[id] = (await SIM_LOADERS[id]()).meta; } catch { /* reported by sims tests */ } }
const glossary = new Set(course.units.flatMap((u) => (u.glossary || []).map((g) => g.term.toLocaleLowerCase('vi'))));
const courseIds = new Set(course.units.flatMap((u) => [...u.lessons.flatMap((l) => l.steps.map((s) => s.id)), ...(u.defense || []).map((d) => d.id)]).filter(Boolean));

function checkpointsFor(sim, props) {
  const m = simMeta[sim];
  if (!m) return null;
  const cps = typeof m.checkpointsFor === 'function' ? m.checkpointsFor(props || {}) : (m.checkpoints || []);
  return [...cps, 'end'];
}
function hotspotsFor(t) {
  if (t.kind === 'sim') return simMeta[t.sim] ? simMeta[t.sim].hotspots.map((h) => h.id) : null;
  if (t.name) return NAMED_DIAGRAMS[t.name] ? NAMED_DIAGRAMS[t.name].hotspots.map((h) => h.id) : [];
  return inlineHotspots(t.svg).map((h) => h.id);
}

function validate(q, open) {
  const E = [];
  const err = (m) => E.push(`${q && q.id}: ${m}`);
  if (!(open ? DID : QID).test(q.id || '')) err('id sai định dạng');
  const unit = course.units.find((u) => u.id === q.unitId);
  if (!unit) err(`unitId "${q.unitId}" không tồn tại`);
  else if (!unit.lessons.some((l) => l.id === q.lessonId)) err(`lessonId "${q.lessonId}" không có trong ${q.unitId}`);
  if (q.type === 'number' && q.unit !== undefined && typeof q.unit !== 'string') err('unit (đơn vị đo) phải là chuỗi');
  if (typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 500) err('prompt rỗng hoặc > 500');
  for (const t of [q.prompt, q.explanation, q.hint, q.modelAnswer]) if (typeof t === 'string') for (const term of extractTerms(t)) if (!glossary.has(term.toLocaleLowerCase('vi'))) err(`[[${term}]] không có trong glossary`);
  if (open) {
    if (q.type !== 'flashcard') err('câu mở phải là flashcard');
    if (!/^Giám khảo hỏi: “/.test(q.prompt || '')) err('prompt câu mở phải bắt đầu "Giám khảo hỏi: “"');
    if (typeof q.modelAnswer !== 'string' || !q.modelAnswer.trim() || q.modelAnswer.length > 600) err('modelAnswer rỗng hoặc > 600');
    if (!Array.isArray(q.keyPoints) || q.keyPoints.length < 2 || q.keyPoints.length > 5) err('keyPoints cần 2–5 ý');
    if (q.followUp && (!q.followUp.prompt || !q.followUp.answer)) err('followUp cần prompt + answer');
    return E;
  }
  if (!AUTO_TYPES.includes(q.type)) { err(`type "${q.type}" không tự chấm được`); return E; }
  if (typeof q.explanation !== 'string' || !q.explanation.trim() || q.explanation.length > 400) err('explanation rỗng hoặc > 400');
  if (q.hint !== undefined && (typeof q.hint !== 'string' || q.hint.length > 200)) err('hint > 200');
  if (q.visual) {
    if (q.visual.kind !== 'diagram' && q.visual.kind !== 'sim') err('visual.kind');
    if (q.visual.kind === 'diagram') {
      if (!!q.visual.name === !!q.visual.svg) err('visual: dùng đúng một trong name/svg');
      if (q.visual.name && !NAMED_DIAGRAMS[q.visual.name]) err(`visual diagram ${q.visual.name} không tồn tại`);
      if (q.visual.svg) for (const p of svgProblems(q.visual.svg)) err(`visual svg ${p}`);
      if (!q.visual.alt || q.visual.alt.length < 10) err('visual cần alt');
    }
    if (q.visual.kind === 'sim' && !SIM_IDS.includes(q.visual.sim)) err('visual sim không có');
  }
  const opts = (min, max) => {
    if (!Array.isArray(q.options) || q.options.length < min || q.options.length > max) { err(`options cần ${min}–${max}`); return false; }
    if (new Set(q.options).size !== q.options.length) err('options trùng');
    return true;
  };
  const idx = (a, n) => Number.isInteger(a) && a >= 0 && a < n;
  switch (q.type) {
    case 'mcq': if (opts(2, 5) && !idx(q.answer, q.options.length)) err('answer ngoài phạm vi'); break;
    case 'multi': if (opts(3, 6) && (!Array.isArray(q.answers) || !q.answers.length || q.answers.some((a) => !idx(a, q.options.length)) || new Set(q.answers).size !== q.answers.length)) err('answers sai'); break;
    case 'truefalse': if (typeof q.answer !== 'boolean') err('answer phải là boolean'); break;
    case 'order': if (!Array.isArray(q.items) || q.items.length < 3 || q.items.length > 6 || new Set(q.items).size !== q.items.length) err('items cần 3–6 mục khác nhau'); break;
    case 'match':
      if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 6) err('pairs cần 3–6');
      else if (new Set(q.pairs.map((p) => p[1])).size !== q.pairs.length || new Set(q.pairs.map((p) => p[0])).size !== q.pairs.length) err('pairs trùng');
      break;
    case 'number': if (typeof q.answer !== 'number' || typeof q.tolerance !== 'number' || q.tolerance < 0) err('number cần answer + tolerance'); break;
    case 'predict':
      if (!LANGS.includes(q.language) || typeof q.code !== 'string' || q.code.split('\n').length > 25) err('predict cần language + code ≤ 25 dòng');
      for (const h of q.highlight || []) if (!Number.isInteger(h) || h < 1 || h > q.code.split('\n').length) err(`highlight ${h}`);
      if (opts(2, 5) && !idx(q.answer, q.options.length)) err('answer ngoài phạm vi');
      break;
    case 'hotspot': {
      const t = q.target;
      if (!t || (t.kind !== 'diagram' && t.kind !== 'sim')) { err('target.kind'); break; }
      if (t.kind === 'diagram' && t.name && !NAMED_DIAGRAMS[t.name]) err(`diagram ${t.name} không tồn tại`);
      if (t.kind === 'diagram' && t.svg) for (const p of svgProblems(t.svg)) err(`target svg ${p}`);
      const hs = hotspotsFor(t);
      if (hs) for (const a of (Array.isArray(q.answer) ? q.answer : [q.answer])) if (!hs.includes(a)) err(`hotspot "${a}" không có (có: ${hs.join(', ')})`);
      break;
    }
    case 'sim-predict': {
      if (!SIM_IDS.includes(q.sim)) { err(`sim ${q.sim} không có`); break; }
      if (opts(2, 5) && !idx(q.answer, q.options.length)) err('answer ngoài phạm vi');
      const cps = checkpointsFor(q.sim, q.props);
      if (cps && !cps.includes(q.pauseAt)) err(`pauseAt ${q.pauseAt} không có (${cps.join(', ')})`);
      if (cps && q.revealTo && !cps.includes(q.revealTo)) err(`revealTo ${q.revealTo} không có`);
      break;
    }
    default: break;
  }
  if (!E.length) {
    const ideal = idealAnswer(q);
    if (!isAnswerShape(q, ideal) || !gradeAnswer(q, ideal)) err('đáp án đúng không tự chấm được');
  }
  return E;
}

test('exam bank: ≥ 40 auto-gradable questions, every one valid', () => {
  assert.ok(bank.questions.length >= 40, `chỉ có ${bank.questions.length} câu`);
  const errors = bank.questions.flatMap((q) => validate(q, false));
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
});

test('exam bank: open questions for the mock defense are valid', () => {
  assert.ok(bank.open.length >= 8);
  const errors = bank.open.flatMap((q) => validate(q, true));
  assert.deepEqual(errors, [], `\n${errors.join('\n')}`);
});

test('exam bank: ids unique and never collide with course ids', () => {
  const ids = [...bank.questions, ...bank.open].map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(!courseIds.has(id), id);
});

test('exam bank: covers every unit and mixes question types, many visual', () => {
  const units = new Set(bank.questions.map((q) => q.unitId));
  for (const u of course.units.filter((x) => x.id !== 'u10')) assert.ok(units.has(u.id), `bank thiếu câu cho ${u.id}`);
  const types = new Set(bank.questions.map((q) => q.type));
  for (const t of AUTO_TYPES) assert.ok(types.has(t), `bank thiếu dạng ${t}`);
  const visual = bank.questions.filter((q) => q.visual || q.type === 'hotspot' || q.type === 'sim-predict').length;
  assert.ok(visual >= 12, `chỉ ${visual} câu trực quan`);
});

test('exam bank: facts match HEAD 4a0285a (HELP = two dips; reconnect never gives up)', () => {
  const all = JSON.stringify(bank);
  assert.ok(!/PITCH_SIGN|HELP_HOLD_MS/.test(all), 'hằng số đã bị xoá khỏi firmware');
  // "giữ 400 ms" may only appear when describing the OLD rule.
  for (const q of [...bank.questions, ...bank.open]) {
    const text = JSON.stringify(q);
    if (/400 ms/.test(text)) assert.match(text, /bản (cũ|đầu|nháp)|bỏ/i, `${q.id}: nhắc 400 ms mà không nói là bản cũ`);
    assert.ok(!/(tối đa|chỉ) 6 lần/.test(text), `${q.id}: app không còn giới hạn 6 lần nối lại`);
  }
  assert.ok(all.includes('Hạ cẳng tay rồi nâng lại, 2 lần'));
});

test('exam bank: follow-up pool is usable', () => {
  for (const f of FOLLOW_UPS) { assert.doesNotThrow(() => new RegExp(f.match, 'i')); assert.ok(f.prompt && f.answer); }
  assert.ok(GENERIC_FOLLOW_UP.prompt && GENERIC_FOLLOW_UP.answer);
});

test('exam bank: debugging-story / screen-off questions link to a lesson that teaches them', () => {
  // The results page sends a learner who missed a question to q.unitId/q.lessonId ("Ôn bài"), so that
  // lesson must actually explain onStop(), the screen turning off and BandLinkService.
  const rules = [
    [/onStop|_pendingPkt|3 lần đọc/, /onStop/, 'câu chuyện gỡ lỗi (onStop)'],
    [/BandLinkService|tắt màn hình/, /BandLinkService|dịch vụ nền/, 'dịch vụ nền khi tắt màn hình'],
  ];
  for (const q of [...bank.questions, ...bank.open]) {
    const qt = JSON.stringify(q);
    const lesson = course.units.find((u) => u.id === q.unitId)?.lessons.find((l) => l.id === q.lessonId);
    const text = JSON.stringify(lesson || {});
    for (const [asks, teaches, what] of rules) {
      if (asks.test(qt)) assert.ok(teaches.test(text), `${q.id} → ${q.unitId}.${q.lessonId} không dạy ${what}`);
    }
  }
});
