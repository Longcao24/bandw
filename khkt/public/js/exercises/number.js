// Number input: accepts "," or "." as decimal mark; correct when |input − answer| ≤ tolerance.
import { el } from '../util.js';

export function parseNumber(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  return Number(t);
}
const fmt = (n) => String(n).replace('.', ',');

export function create(step, api) {
  const input = el('input.num-input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Câu trả lời của em', placeholder: 'Nhập số' });
  const status = el('span.num-mark', { 'aria-hidden': 'true' });
  const err = el('p.num-error', { hidden: true }, 'Em nhập một số nhé (ví dụ 12 hoặc 0,5).');
  input.addEventListener('input', () => { err.hidden = input.value.trim() === '' || parseNumber(input.value) !== null; api.onChange(); });
  const wrap = el('div.num', null, el('div.num-row', null, input, step.unit ? el('span.num-unit', null, step.unit) : null, status), err);
  return {
    el: wrap,
    isReady: () => parseNumber(input.value) !== null,
    check() {
      const v = parseNumber(input.value);
      const correct = v !== null && Math.abs(v - step.answer) <= (step.tolerance || 0) + 1e-9;
      input.readOnly = true;
      wrap.classList.toggle('is-correct', correct); wrap.classList.toggle('is-wrong', !correct);
      status.textContent = correct ? '✓' : '✕';
      return { correct };
    },
    reveal() {
      input.value = fmt(step.answer); input.readOnly = true;
      wrap.classList.remove('is-wrong'); wrap.classList.add('is-correct'); status.textContent = '✓';
      if (step.tolerance) wrap.append(el('p.ex-sub', null, `Chấp nhận sai số ±${fmt(step.tolerance)}${step.unit ? ' ' + step.unit : ''}.`));
    },
    getAnswer: () => (input.value.trim() ? input.value.trim().slice(0, 40) : null),
    setAnswer(v) { input.value = typeof v === 'string' ? v : ''; },
    reset() { input.readOnly = false; wrap.classList.remove('is-correct', 'is-wrong'); status.textContent = ''; input.select(); },
    destroy() {},
  };
}
