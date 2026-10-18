// Pure exam grading. Answers use ORIGINAL indices (never the shuffled screen order), so a saved attempt
// grades the same after a refresh. Shared by the exam views and the node tests. No DOM access.

/** Question types the mock exam can draw and grade automatically. */
export const AUTO_TYPES = ['mcq', 'multi', 'truefalse', 'order', 'match', 'number', 'predict', 'hotspot', 'sim-predict'];
export const isAutoGradable = (step) => !!step && AUTO_TYPES.includes(step.type);

export function parseNumber(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

/** True when `ans` (as produced by a renderer's getAnswer()) is fully correct for `step`. */
export function gradeAnswer(step, ans) {
  if (!step || ans === null || ans === undefined) return false;
  switch (step.type) {
    case 'mcq': case 'predict': case 'sim-predict': return Number.isInteger(ans) && ans === step.answer;
    case 'truefalse': return typeof ans === 'boolean' && ans === step.answer;
    case 'multi': return Array.isArray(ans) && sameSet(new Set(ans), new Set(step.answers));
    case 'order': return Array.isArray(ans) && ans.length === step.items.length && ans.every((v, i) => v === i);
    case 'match': return Array.isArray(ans) && ans.length === step.pairs.length && ans.every((v, i) => v === i);
    case 'number': {
      const v = parseNumber(ans);
      return v !== null && Math.abs(v - step.answer) <= (step.tolerance || 0) + 1e-9;
    }
    case 'hotspot': {
      const want = new Set(Array.isArray(step.answer) ? step.answer : [step.answer]);
      return Array.isArray(ans) && sameSet(new Set(ans), want);
    }
    default: return false;
  }
}

/** Checks that a saved answer has the right SHAPE for the step (used before restoring from storage). */
export function isAnswerShape(step, ans) {
  if (ans === null || ans === undefined) return true;
  switch (step.type) {
    case 'mcq': case 'predict': case 'sim-predict': return Number.isInteger(ans) && ans >= 0 && ans < step.options.length;
    case 'truefalse': return typeof ans === 'boolean';
    case 'multi': return Array.isArray(ans) && ans.every((i) => Number.isInteger(i) && i >= 0 && i < step.options.length);
    case 'order': return Array.isArray(ans) && ans.length === step.items.length;
    case 'match': return Array.isArray(ans) && ans.length === step.pairs.length;
    case 'number': return typeof ans === 'string' && ans.length <= 40;
    case 'hotspot': return Array.isArray(ans) && ans.every((x) => typeof x === 'string' && x.length <= 60);
    default: return false;
  }
}

const fmtNum = (n) => String(n).replace('.', ',');
const plain = (s) => String(s ?? '').replace(/\*\*|`/g, '');

/** Short Vietnamese text of the correct answer (labels for hotspots come from `labelOf(id)` if given). */
export function correctText(step, labelOf = (id) => id) {
  switch (step.type) {
    case 'mcq': case 'predict': case 'sim-predict': return plain(step.options[step.answer]);
    case 'truefalse': return step.answer ? 'Đúng' : 'Sai';
    case 'multi': return step.answers.map((i) => plain(step.options[i])).join(' · ');
    case 'order': return step.items.map((t, i) => `${i + 1}. ${plain(t)}`).join('  →  ');
    case 'match': return step.pairs.map(([a, b]) => `${plain(a)} ↔ ${plain(b)}`).join(' · ');
    case 'number': return `${fmtNum(step.answer)}${step.unit ? ' ' + step.unit : ''}${step.tolerance ? ` (±${fmtNum(step.tolerance)})` : ''}`;
    case 'hotspot': return (Array.isArray(step.answer) ? step.answer : [step.answer]).map(labelOf).join(', ');
    default: return '';
  }
}

/** Short text of what the learner answered ('Chưa trả lời' when empty). */
export function answerText(step, ans, labelOf = (id) => id) {
  if (ans === null || ans === undefined) return 'Chưa trả lời';
  switch (step.type) {
    case 'mcq': case 'predict': case 'sim-predict': return Number.isInteger(ans) && step.options[ans] !== undefined ? plain(step.options[ans]) : 'Chưa trả lời';
    case 'truefalse': return ans ? 'Đúng' : 'Sai';
    case 'multi': return ans.map((i) => plain(step.options[i])).join(' · ');
    case 'order': return ans.map((i, p) => `${p + 1}. ${plain(step.items[i])}`).join('  →  ');
    case 'match': return ans.map((r, l) => `${plain(step.pairs[l][0])} ↔ ${r >= 0 ? plain(step.pairs[r][1]) : '…'}`).join(' · ');
    case 'number': return `${ans}${step.unit ? ' ' + step.unit : ''}`;
    case 'hotspot': return ans.map(labelOf).join(', ');
    default: return '';
  }
}

/**
 * Grades a whole attempt. attempt = { qs:[{id, unitId}], ans:{id: answer} }; qIndex: Map id → { step }.
 * A question whose content disappeared (renamed in a later release) is left out of the score.
 * → { ok: { id: bool }, c, n, perUnit: { uNN: [c, t] } }
 */
export function scoreAttempt(attempt, qIndex) {
  const ok = {};
  const perUnit = {};
  let c = 0, n = 0;
  for (const q of attempt.qs) {
    const item = qIndex.get(q.id);
    if (!item) continue;
    const right = gradeAnswer(item.step, attempt.ans ? attempt.ans[q.id] : null);
    ok[q.id] = right;
    n += 1; if (right) c += 1;
    const u = perUnit[q.unitId] || (perUnit[q.unitId] = [0, 0]);
    u[1] += 1; if (right) u[0] += 1;
  }
  return { ok, c, n, perUnit };
}

/** The answer value a renderer would report for a fully correct response (used by tests). */
export function idealAnswer(step) {
  switch (step.type) {
    case 'mcq': case 'predict': case 'sim-predict': case 'truefalse': return step.answer;
    case 'multi': return [...step.answers].sort((a, b) => a - b);
    case 'order': return step.items.map((_, i) => i);
    case 'match': return step.pairs.map((_, i) => i);
    case 'number': return String(step.answer).replace('.', ',');
    case 'hotspot': return (Array.isArray(step.answer) ? step.answer : [step.answer]).slice().sort();
    default: return null;
  }
}
