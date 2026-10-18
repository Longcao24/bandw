// Content schema validator over the REAL course (public/content/index.js). Spec §4 + §10.
// Errors fail the test of the unit that owns them; warnings are printed with console.warn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { course } from '../public/content/index.js';
import { SIM_IDS, SIM_LOADERS } from '../public/js/sims/registry.js';
import { NAMED_DIAGRAMS, inlineHotspots, svgProblems } from '../public/js/diagrams/index.js';
import { VIDEO_IDS } from '../public/js/videos.js';
import { UNIT_RE, LESSON_RE, EXERCISE_RE, DEFENSE_RE } from '../public/js/core/ids.js';
import { extractTerms, countSentences } from '../public/js/render/markdown.js';

const COLORS = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'purple', 'pink'];
const GRADED = ['mcq', 'multi', 'truefalse', 'order', 'match', 'number', 'predict', 'hotspot', 'sim-predict'];
const EXERCISES = [...GRADED, 'flashcard'];
const STEP_TYPES = ['text', 'code', 'diagram', 'video', 'sim', ...EXERCISES];
const LANGS = ['cpp', 'java', 'text'];
const VISUAL_EX = ['hotspot', 'sim-predict'];
const GENERATED_HOTSPOT = /^(diag|row-[A-Z]+|col-[A-Z]+|cell-[A-Z]+-[A-Z]+|col-NONE)$/;

// ---------- sim metas ----------
const simMeta = {};
const simLoadErrors = {};
for (const id of SIM_IDS) {
  const file = fileURLToPath(new URL(`../public/js/sims/${id}.js`, import.meta.url));
  if (!existsSync(file)) { simLoadErrors[id] = 'tệp chưa tồn tại'; continue; }
  try {
    const mod = await SIM_LOADERS[id]();
    if (!mod.meta || typeof mod.mount !== 'function') simLoadErrors[id] = 'thiếu export meta/mount';
    else simMeta[id] = mod.meta;
  } catch (e) { simLoadErrors[id] = 'lỗi import: ' + e.message; }
}

// ---------- glossary ----------
const glossary = new Set();
for (const u of course.units) for (const g of u.glossary || []) if (g && g.term) glossary.add(g.term.toLocaleLowerCase('vi'));

const allIds = new Map(); // exercise id → unit
const warnings = [];

function stepsOfCodeStepper(props) {
  return (props && Array.isArray(props.steps) ? props.steps : []).map((_, i) => `s${i + 1}`).concat('end');
}
function checkpointsFor(sim, props) {
  if (sim === 'code-stepper') return stepsOfCodeStepper(props);
  const m = simMeta[sim];
  if (!m) return null;
  const cps = typeof m.checkpointsFor === 'function' ? m.checkpointsFor(props || {}) : (m.checkpoints || []);
  return m.timeline || cps.length ? [...cps, 'end'] : cps;
}
function hotspotsFor(target) {
  if (!target) return null;
  if (target.kind === 'sim') { const m = simMeta[target.sim]; return m ? (m.hotspots || []).map((h) => h.id) : null; }
  if (target.name) return NAMED_DIAGRAMS[target.name] ? NAMED_DIAGRAMS[target.name].hotspots.map((h) => h.id) : [];
  if (target.svg) return inlineHotspots(target.svg).map((h) => h.id);
  return [];
}

function validateUnit(unit, fileIndex) {
  const E = [];
  const err = (where, msg) => E.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const expectId = `u${String(fileIndex).padStart(2, '0')}`;
  const U = unit && unit.id ? unit.id : expectId;
  if (!unit || typeof unit !== 'object') { err(expectId, 'unit file must export default an object'); return E; }
  if (!UNIT_RE.test(unit.id || '')) err(U, `id "${unit.id}" phải dạng uNN`);
  if (unit.id !== expectId) err(U, `id phải là "${expectId}" để khớp tên tệp unit${expectId.slice(1)}.js`);
  str(unit.title, 60, `${U}.title`, err);
  str(unit.description, 160, `${U}.description`, err);
  if (!COLORS.includes(unit.color)) err(U, `color "${unit.color}" không thuộc ${COLORS.join('/')}`);
  if (typeof unit.icon !== 'string' || !unit.icon.trim() || /[A-Za-z0-9]/.test(unit.icon) || [...unit.icon].length > 4) err(U, 'icon phải là một emoji');
  if (!Array.isArray(unit.lessons)) { err(U, 'lessons phải là mảng'); return E; }
  if (unit._placeholder) { warn(U, 'chương còn là PLACEHOLDER (chưa có nội dung)'); }
  else if (unit.lessons.length < 3 || unit.lessons.length > 8) err(U, `cần 3–8 bài, đang có ${unit.lessons.length}`);

  for (const [i, g] of (unit.glossary || []).entries()) {
    if (!g || typeof g.term !== 'string' || !g.term.trim()) err(`${U}.glossary[${i}]`, 'thiếu term');
    if (typeof g.def !== 'string' || !g.def.trim()) err(`${U}.glossary[${i}]`, 'thiếu def');
    else if (g.def.length > 200) err(`${U}.glossary[${i}]`, `def dài ${g.def.length} > 200`);
  }

  const lessonIds = new Set();
  for (const [li, lesson] of unit.lessons.entries()) {
    const L = `${U}.${lesson && lesson.id ? lesson.id : 'lesson[' + li + ']'}`;
    if (!lesson || typeof lesson !== 'object') { err(L, 'bài không hợp lệ'); continue; }
    if (!LESSON_RE.test(lesson.id || '')) err(L, `lesson id "${lesson.id}" phải dạng lN`);
    if (lessonIds.has(lesson.id)) err(L, 'lesson id bị trùng'); lessonIds.add(lesson.id);
    str(lesson.title, 70, `${L}.title`, err);
    if (typeof lesson.minutes !== 'number' || lesson.minutes < 3 || lesson.minutes > 15) err(L, `minutes ${lesson.minutes} phải 3–15`);
    if (lesson.goal !== undefined) str(lesson.goal, 140, `${L}.goal`, err);
    const steps = Array.isArray(lesson.steps) ? lesson.steps : [];
    if (!Array.isArray(lesson.steps)) err(L, 'steps phải là mảng');
    if (steps.length < 4 || steps.length > 16) err(L, `cần 4–16 bước, đang có ${steps.length}`);
    if (!steps.some((s) => s && (s.type === 'sim' || s.type === 'video'))) err(L, 'cần ít nhất 1 bước sim hoặc video (trực quan trước)');
    const graded = steps.filter((s) => s && GRADED.includes(s.type)).length;
    if (graded < 2) err(L, `cần ≥ 2 bài tập có chấm điểm, đang có ${graded}`);
    if (!steps.some((s) => s && (VISUAL_EX.includes(s.type) || (EXERCISES.includes(s.type) && s.visual)))) warn(L, 'nên có ≥ 1 bài tập trực quan (hotspot, sim-predict, hoặc visual)');
    if (!steps.some((s) => s && s.type === 'flashcard')) warn(L, 'nên kết thúc bằng ≥ 1 flashcard "Giám khảo hỏi: …"');
    steps.forEach((s, si) => {
      const W = `${L}.steps[${si}]${s && s.id ? ' (' + s.id + ')' : ''}`;
      if (si > 0 && s && s.type === 'text' && steps[si - 1] && steps[si - 1].type === 'text') err(W, 'hai bước text liền nhau (vi phạm nguyên tắc trực quan)');
      validateStep(s, W, `${U}.${lesson.id}`, err, warn, U);
    });
  }
  for (const [di, card] of (unit.defense || []).entries()) {
    const W = `${U}.defense[${di}]${card && card.id ? ' (' + card.id + ')' : ''}`;
    if (!card || card.type !== 'flashcard') { err(W, 'defense chỉ chứa flashcard'); continue; }
    if (!DEFENSE_RE.test(card.id || '') || !card.id.startsWith(`${U}.d.`)) err(W, `id phải dạng ${U}.d.qN`);
    validateStep(card, W, `${U}.d`, err, warn, U, true);
  }
  return E;
}

function str(v, max, where, err, required = true) {
  if (v === undefined || v === null) { if (required) err(where, 'bắt buộc'); return; }
  if (typeof v !== 'string' || !v.trim()) { err(where, 'phải là chuỗi khác rỗng'); return; }
  if (v.length > max) err(where, `dài ${v.length} > ${max} ký tự`);
}
function terms(text, where, err) {
  for (const t of extractTerms(text)) if (!glossary.has(t.toLocaleLowerCase('vi'))) err(where, `thuật ngữ [[${t}]] không có trong glossary của chương nào`);
}
function lineCount(code) { return String(code || '').split('\n').length; }
const isInt = (n) => Number.isInteger(n);

function validateStep(s, W, prefix, err, warn, U, isDefense = false) {
  if (!s || typeof s !== 'object') { err(W, 'bước không hợp lệ'); return; }
  if (!STEP_TYPES.includes(s.type)) { err(W, `type "${s.type}" không hỗ trợ`); return; }
  if (s.title !== undefined) str(s.title, 60, `${W}.title`, err);
  switch (s.type) {
    case 'text': {
      str(s.body, 400, `${W}.body`, err);
      if (typeof s.body === 'string') {
        const n = countSentences(s.body);
        if (n > 3) err(W, `text có ${n} câu > 3`);
        if (/</.test(s.body.replace(/`[^`]*`/g, ''))) warn(W, 'ký tự "<" ngoài backtick sẽ hiển thị như chữ');
        terms(s.body, W, err);
      }
      return;
    }
    case 'code': {
      if (!LANGS.includes(s.language)) err(W, `language "${s.language}" phải là cpp/java/text`);
      if (typeof s.code !== 'string' || !s.code.trim()) err(W, 'thiếu code');
      else if (lineCount(s.code) > 25) err(W, `code ${lineCount(s.code)} dòng > 25`);
      str(s.caption, 200, `${W}.caption`, err);
      for (const h of s.highlight || []) if (!isInt(h) || h < 1 || h > lineCount(s.code)) err(W, `highlight ${h} ngoài phạm vi`);
      for (const nt of s.notes || []) {
        if (!Array.isArray(nt.lines) || nt.lines.length !== 2 || nt.lines[0] < 1 || nt.lines[1] < nt.lines[0] || nt.lines[1] > lineCount(s.code)) err(W, `notes.lines ${JSON.stringify(nt.lines)} không hợp lệ`);
        str(nt.note, 160, `${W}.notes`, err);
      }
      terms(s.caption, W, err);
      return;
    }
    case 'diagram': {
      if (!!s.name === !!s.svg) err(W, 'dùng đúng một trong name hoặc svg');
      if (s.name && !NAMED_DIAGRAMS[s.name]) err(W, `diagram name "${s.name}" không tồn tại`);
      if (s.svg) for (const p of svgProblems(s.svg)) err(W, `svg ${p}`);
      str(s.caption, 300, `${W}.caption`, err);
      str(s.alt, 400, `${W}.alt`, err);
      terms(s.caption, W, err);
      return;
    }
    case 'video': {
      if (!VIDEO_IDS.includes(s.id)) err(W, `video id "${s.id}" không có trong danh mục`);
      str(s.caption, 300, `${W}.caption`, err);
      for (const c of s.chapters || []) if (typeof c.t !== 'number' || c.t < 0 || typeof c.label !== 'string') err(W, 'chapter cần {t:number, label:string}');
      if (s.fallbackSim && !SIM_IDS.includes(s.fallbackSim.sim)) err(W, `fallbackSim "${s.fallbackSim.sim}" không có trong registry`);
      terms(s.caption, W, err);
      return;
    }
    case 'sim': {
      validateSimRef(s.sim, s.props, W, err);
      str(s.caption, 300, `${W}.caption`, err);
      if (typeof s.caption === 'string' && countSentences(s.caption) > 3) err(W, `caption sim có ${countSentences(s.caption)} câu > 3`);
      terms(s.caption, W, err);
      return;
    }
    default: break;
  }
  // ---- exercises ----
  const idOk = isDefense ? DEFENSE_RE.test(s.id || '') : EXERCISE_RE.test(s.id || '');
  if (!idOk) err(W, `id "${s.id}" sai định dạng`);
  else if (!isDefense && !s.id.startsWith(prefix + '.')) err(W, `id "${s.id}" phải bắt đầu bằng "${prefix}."`);
  if (s.id) { if (allIds.has(s.id)) err(W, `id "${s.id}" bị trùng (đã dùng ở ${allIds.get(s.id)})`); else allIds.set(s.id, W); }
  str(s.prompt, 500, `${W}.prompt`, err);
  str(s.explanation, 400, `${W}.explanation`, err);
  if (s.hint !== undefined) str(s.hint, 200, `${W}.hint`, err);
  for (const t of [s.prompt, s.explanation, s.hint]) if (typeof t === 'string') terms(t, W, err);
  if (s.visual) {
    if (s.visual.kind === 'sim') validateSimRef(s.visual.sim, s.visual.props, `${W}.visual`, err);
    else if (s.visual.kind === 'diagram') {
      if (!!s.visual.name === !!s.visual.svg) err(W, 'visual: dùng đúng một trong name hoặc svg');
      if (s.visual.name && !NAMED_DIAGRAMS[s.visual.name]) err(W, `visual diagram "${s.visual.name}" không tồn tại`);
      if (s.visual.svg) for (const p of svgProblems(s.visual.svg)) err(W, `visual svg ${p}`);
      str(s.visual.alt, 400, `${W}.visual.alt`, err);
    } else err(W, 'visual.kind phải là diagram hoặc sim');
  }
  const opts = (min, max) => {
    if (!Array.isArray(s.options) || s.options.length < min || s.options.length > max) { err(W, `options cần ${min}–${max} mục`); return false; }
    s.options.forEach((o, i) => { if (typeof o !== 'string' || !o.trim()) err(W, `options[${i}] rỗng`); });
    if (new Set(s.options).size !== s.options.length) err(W, 'options bị trùng');
    return true;
  };
  const idx = (a, n) => isInt(a) && a >= 0 && a < n;
  switch (s.type) {
    case 'mcq': if (opts(2, 5) && !idx(s.answer, s.options.length)) err(W, `answer ${s.answer} ngoài phạm vi`); break;
    case 'multi':
      if (opts(3, 6)) {
        if (!Array.isArray(s.answers) || !s.answers.length) err(W, 'answers cần ≥ 1');
        else { if (s.answers.some((a) => !idx(a, s.options.length))) err(W, 'answers ngoài phạm vi'); if (new Set(s.answers).size !== s.answers.length) err(W, 'answers trùng'); }
      }
      break;
    case 'truefalse': if (typeof s.answer !== 'boolean') err(W, 'answer phải là true/false'); break;
    case 'order':
      if (!Array.isArray(s.items) || s.items.length < 3 || s.items.length > 6) err(W, 'items cần 3–6 mục');
      else if (new Set(s.items).size !== s.items.length) err(W, 'items bị trùng');
      break;
    case 'match':
      if (!Array.isArray(s.pairs) || s.pairs.length < 3 || s.pairs.length > 6) err(W, 'pairs cần 3–6 cặp');
      else {
        if (s.pairs.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((x) => typeof x !== 'string' || !x.trim()))) err(W, 'mỗi cặp phải là [chuỗi, chuỗi]');
        if (new Set(s.pairs.map((p) => p[1])).size !== s.pairs.length) err(W, 'vế phải bị trùng (đáp án mơ hồ)');
        if (new Set(s.pairs.map((p) => p[0])).size !== s.pairs.length) err(W, 'vế trái bị trùng');
      }
      break;
    case 'number':
      if (typeof s.answer !== 'number' || !Number.isFinite(s.answer)) err(W, 'answer phải là số');
      if (typeof s.tolerance !== 'number' || s.tolerance < 0) err(W, 'tolerance phải là số ≥ 0');
      if (s.unit !== undefined && typeof s.unit !== 'string') err(W, 'unit phải là chuỗi');
      break;
    case 'predict':
      if (!LANGS.includes(s.language)) err(W, 'language phải là cpp/java/text');
      if (typeof s.code !== 'string' || !s.code.trim()) err(W, 'thiếu code');
      else if (lineCount(s.code) > 25) err(W, 'code > 25 dòng');
      for (const h of s.highlight || []) if (!isInt(h) || h < 1 || h > lineCount(s.code)) err(W, `highlight ${h} ngoài phạm vi`);
      if (opts(2, 5) && !idx(s.answer, s.options.length)) err(W, `answer ${s.answer} ngoài phạm vi`);
      break;
    case 'flashcard':
      str(s.modelAnswer, 600, `${W}.modelAnswer`, err);
      if (!Array.isArray(s.keyPoints) || s.keyPoints.length < 2 || s.keyPoints.length > 5) err(W, 'keyPoints cần 2–5 ý');
      if (typeof s.modelAnswer === 'string') terms(s.modelAnswer, W, err);
      break;
    case 'hotspot': {
      const t = s.target;
      if (!t || (t.kind !== 'diagram' && t.kind !== 'sim')) { err(W, 'target.kind phải là diagram hoặc sim'); break; }
      if (t.kind === 'sim') validateSimRef(t.sim, t.props, `${W}.target`, err);
      else {
        if (!!t.name === !!t.svg) err(W, 'target: dùng đúng một trong name hoặc svg');
        if (t.name && !NAMED_DIAGRAMS[t.name]) err(W, `target diagram "${t.name}" không tồn tại`);
        if (t.svg) for (const p of svgProblems(t.svg)) err(W, `target svg ${p}`);
      }
      const ans = Array.isArray(s.answer) ? s.answer : [s.answer];
      if (!ans.length || ans.some((a) => typeof a !== 'string')) { err(W, 'answer phải là id hoặc mảng id'); break; }
      const hs = hotspotsFor(t);
      if (hs === null) { warn(W, `chưa kiểm được hotspot vì sim "${t.sim}" chưa tải được`); break; }
      for (const a of ans) {
        if (hs.includes(a)) continue;
        if (t.kind === 'sim' && t.sim === 'confusion-matrix' && GENERATED_HOTSPOT.test(a)) continue;
        err(W, `answer "${a}" không phải hotspot của target (có: ${hs.join(', ') || 'không có'})`);
      }
      break;
    }
    case 'sim-predict': {
      validateSimRef(s.sim, s.props, W, err);
      if (opts(2, 5) && !idx(s.answer, s.options.length)) err(W, `answer ${s.answer} ngoài phạm vi`);
      const cps = checkpointsFor(s.sim, s.props);
      if (cps === null) { warn(W, `chưa kiểm được checkpoint vì sim "${s.sim}" chưa tải được`); break; }
      if (!cps.includes(s.pauseAt)) err(W, `pauseAt "${s.pauseAt}" không có trong checkpoints (${cps.join(', ')})`);
      if (s.revealTo !== undefined && !cps.includes(s.revealTo)) err(W, `revealTo "${s.revealTo}" không có trong checkpoints`);
      if (s.revealTo && cps.indexOf(s.revealTo) !== -1 && cps.indexOf(s.pauseAt) > cps.indexOf(s.revealTo) && s.revealTo !== 'end') warn(W, 'revealTo đứng trước pauseAt');
      break;
    }
    default: break;
  }
}

function validateSimRef(sim, props, W, err) {
  if (!SIM_IDS.includes(sim)) { err(W, `sim "${sim}" không có trong registry`); return; }
  if (props !== undefined && (typeof props !== 'object' || props === null || Array.isArray(props))) err(W, 'props phải là object');
  if (sim === 'code-stepper') {
    const p = props || {};
    if (typeof p.code !== 'string' || !p.code.trim()) { err(W, 'code-stepper cần props.code'); return; }
    if (!Array.isArray(p.steps) || !p.steps.length) { err(W, 'code-stepper cần props.steps'); return; }
    if (p.steps.length > 30) err(W, `code-stepper có ${p.steps.length} bước > 30`);
    const n = lineCount(p.code);
    p.steps.forEach((st, i) => {
      if (!isInt(st.line) || st.line < 1 || st.line > n) err(W, `code-stepper steps[${i}].line ${st.line} ngoài 1..${n}`);
      if (st.note !== undefined && (typeof st.note !== 'string' || st.note.length > 120)) err(W, `code-stepper steps[${i}].note dài > 120`);
      if (st.cond && typeof st.cond.value !== 'boolean') err(W, `code-stepper steps[${i}].cond.value phải là boolean`);
    });
    if (p.language && !['cpp', 'java'].includes(p.language)) err(W, 'code-stepper language phải là cpp/java');
  }
}

// ---------- tests ----------
test('course manifest: units in file order, ids unique', () => {
  assert.ok(Array.isArray(course.units) && course.units.length >= 1);
  course.units.forEach((u, i) => assert.equal(u && u.id, `u${String(i + 1).padStart(2, '0')}`, `units[${i}] phải là u${String(i + 1).padStart(2, '0')}`));
  assert.equal(new Set(course.units.map((u) => u.id)).size, course.units.length);
});

const results = course.units.map((u, i) => ({ u, errors: validateUnit(u, i + 1) }));
for (const { u, errors } of results) {
  test(`unit ${u && u.id}: schema, ids, answers, visual-first rules`, () => {
    assert.deepEqual(errors, [], `\n${errors.length} lỗi trong ${u && u.id}:\n  - ${errors.join('\n  - ')}\n`);
  });
}

test('every sim in the registry has a module exporting meta + mount', () => {
  const missing = Object.entries(simLoadErrors).map(([id, why]) => `${id}: ${why}`);
  for (const [id, m] of Object.entries(simMeta)) {
    if (m.id && m.id !== id) missing.push(`${id}: meta.id = "${m.id}"`);
    if (!Array.isArray(m.hotspots)) missing.push(`${id}: meta.hotspots phải là mảng`);
    if (!Array.isArray(m.checkpoints)) missing.push(`${id}: meta.checkpoints phải là mảng`);
  }
  assert.deepEqual(missing, [], `\nSim chưa sẵn sàng:\n  - ${missing.join('\n  - ')}\n`);
});

test('named diagrams expose their declared hotspots and are safe', () => {
  for (const [name, d] of Object.entries(NAMED_DIAGRAMS)) {
    const svg = d.svg();
    assert.deepEqual(svgProblems(svg), [], name);
    const ids = inlineHotspots(svg).map((h) => h.id);
    for (const h of d.hotspots) assert.ok(ids.includes(h.id), `${name}: hotspot ${h.id}`);
    assert.ok(d.alt && d.alt.length > 10, `${name}: alt`);
  }
});

test('report warnings (non-fatal)', () => {
  if (warnings.length) console.warn(`\n[content] ${warnings.length} cảnh báo:\n  - ${warnings.join('\n  - ')}\n`);
  assert.ok(true);
});
