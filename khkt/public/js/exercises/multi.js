// Multi-select: checkboxes; correct when the selected set equals `answers`.
import { el, shuffle } from '../util.js';
import { inline } from '../render/markdown.js';

export function create(step, api) {
  const n = step.options.length;
  const order = step.shuffle === false ? [...Array(n).keys()] : shuffle([...Array(n).keys()], api.seed);
  const answers = new Set(step.answers);
  const inputs = [];
  const group = el('div.choices.multi', { role: 'group', 'aria-label': 'Chọn tất cả đáp án đúng' });
  for (const oi of order) {
    const input = el('input', { type: 'checkbox', value: String(oi), id: `${api.uid || `ex-${step.id}`}-${oi}` });
    input.addEventListener('change', () => api.onChange());
    inputs.push(input);
    group.append(el('label.choice', { for: input.id, 'data-index': oi }, input,
      el('span.choice-box', { 'aria-hidden': 'true' }), el('span.choice-text', { html: inline(step.options[oi]) }), el('span.choice-mark', { 'aria-hidden': 'true' })));
  }
  const selected = () => new Set(inputs.filter((i) => i.checked).map((i) => Number(i.value)));
  const mark = (reveal) => {
    const sel = selected();
    for (const lab of group.children) {
      const idx = Number(lab.dataset.index);
      const shouldBe = answers.has(idx), is = sel.has(idx);
      let cls = '';
      if (reveal) cls = shouldBe ? 'is-correct' : '';
      else if (is) cls = shouldBe ? 'is-correct' : 'is-wrong';
      lab.classList.remove('is-correct', 'is-wrong', 'is-missed');
      if (cls) lab.classList.add(cls);
      lab.querySelector('.choice-mark').textContent = cls === 'is-correct' ? '✓' : cls === 'is-wrong' ? '✕' : '';
    }
  };
  const lock = (b) => { inputs.forEach((i) => { i.disabled = b; }); group.classList.toggle('locked', b); };
  return {
    el: el('div', null, el('p.ex-sub', null, `Có thể có nhiều đáp án đúng.`), group),
    isReady: () => selected().size > 0,
    check() {
      const sel = selected();
      lock(true); mark(false);
      const correct = sel.size === answers.size && [...sel].every((i) => answers.has(i));
      return { correct };
    },
    reveal() { inputs.forEach((i) => { i.checked = answers.has(Number(i.value)); }); lock(true); mark(true); },
    getAnswer() { const s = [...selected()].sort((a, b) => a - b); return s.length ? s : null; },
    setAnswer(v) { const want = new Set(Array.isArray(v) ? v : []); inputs.forEach((i) => { i.checked = want.has(Number(i.value)); }); },
    reset() { lock(false); for (const lab of group.children) { lab.classList.remove('is-correct', 'is-wrong'); lab.querySelector('.choice-mark').textContent = ''; } },
    destroy() {},
  };
}
