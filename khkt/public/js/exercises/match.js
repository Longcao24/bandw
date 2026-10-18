// Match pairs: tap a left item, then a right item. Left stays fixed, right is shuffled.
import { el, shuffledIndices } from '../util.js';
import { inline } from '../render/markdown.js';
import { announce } from '../a11y.js';

const PAIR_COLORS = 6;

export function create(step, api) {
  const n = step.pairs.length;
  const rightOrder = shuffledIndices(n, api.seed);
  const pairOf = new Map(); // left index → right index
  let activeLeft = null;
  let locked = false;
  const leftCol = el('div.match-col', { role: 'group', 'aria-label': 'Cột trái' });
  const rightCol = el('div.match-col', { role: 'group', 'aria-label': 'Cột phải' });
  const lefts = [], rights = [];

  for (let i = 0; i < n; i++) {
    const b = el('button.match-item.left', { type: 'button', 'aria-pressed': 'false', onclick: () => pickLeft(i) },
      el('span.pair-badge', { 'aria-hidden': 'true' }), el('span.match-text', { html: inline(step.pairs[i][0]) }), el('span.match-mark', { 'aria-hidden': 'true' }));
    const unpair = el('button.link-btn.unpair', { type: 'button', hidden: true, onclick: () => { pairOf.delete(i); render(); api.onChange(); announce('Đã bỏ ghép'); } }, 'Bỏ ghép');
    lefts.push({ b, unpair });
    leftCol.append(el('div.match-cell', null, b, unpair));
  }
  for (const ri of rightOrder) {
    const b = el('button.match-item.right', { type: 'button', 'data-r': ri, onclick: () => pickRight(ri) },
      el('span.pair-badge', { 'aria-hidden': 'true' }), el('span.match-text', { html: inline(step.pairs[ri][1]) }));
    rights[ri] = b;
    rightCol.append(el('div.match-cell', null, b));
  }

  function numberOf(li) { return [...pairOf.keys()].sort((a, b) => a - b).indexOf(li) + 1; }
  function render() {
    const rightTaken = new Map([...pairOf.entries()].map(([l, r]) => [r, l]));
    lefts.forEach(({ b, unpair }, i) => {
      const paired = pairOf.has(i);
      const k = paired ? numberOf(i) : 0;
      b.className = 'match-item left' + (activeLeft === i ? ' active' : '') + (paired ? ` paired pc${(k - 1) % PAIR_COLORS}` : '');
      b.setAttribute('aria-pressed', String(activeLeft === i));
      b.querySelector('.pair-badge').textContent = paired ? String(k) : '';
      b.setAttribute('aria-label', `${b.querySelector('.match-text').textContent}${paired ? `, đã ghép cặp số ${k}` : ''}`);
      unpair.hidden = !paired || locked;
      b.disabled = locked;
    });
    rights.forEach((b, ri) => {
      if (!b) return;
      const l = rightTaken.get(ri);
      const paired = l !== undefined;
      const k = paired ? numberOf(l) : 0;
      b.className = 'match-item right' + (paired ? ` paired pc${(k - 1) % PAIR_COLORS}` : '') + (activeLeft !== null && !locked ? ' targetable' : '');
      b.querySelector('.pair-badge').textContent = paired ? String(k) : '';
      b.setAttribute('aria-label', `${b.querySelector('.match-text').textContent}${paired ? `, đã ghép cặp số ${k}` : ''}`);
      b.disabled = locked;
    });
  }
  function pickLeft(i) {
    if (locked) return;
    activeLeft = activeLeft === i ? null : i;
    render();
    if (activeLeft !== null) announce('Giờ chọn một mục ở cột phải để ghép');
  }
  function pickRight(ri) {
    if (locked) return;
    if (activeLeft === null) {
      // Tap right first: pick the first unpaired left automatically is confusing; nudge instead.
      announce('Chọn một mục ở cột trái trước nhé');
      leftCol.classList.add('nudge'); setTimeout(() => leftCol.classList.remove('nudge'), 500);
      return;
    }
    for (const [l, r] of pairOf) if (r === ri) pairOf.delete(l);
    pairOf.set(activeLeft, ri);
    activeLeft = null;
    render();
    api.onChange();
  }
  function mark(reveal) {
    lefts.forEach(({ b }, i) => {
      const ok = pairOf.get(i) === i;
      b.classList.toggle('is-correct', ok);
      b.classList.toggle('is-wrong', !ok && !reveal);
      b.querySelector('.match-mark').textContent = ok ? '✓' : reveal ? '' : '✕';
    });
  }
  render();
  return {
    el: el('div.match', null, el('p.ex-sub', null, 'Chạm một mục bên trái, rồi chạm mục tương ứng bên phải.'), el('div.match-grid', null, leftCol, rightCol)),
    isReady: () => pairOf.size === n,
    check() {
      locked = true; activeLeft = null; render(); mark(false);
      return { correct: [...Array(n).keys()].every((i) => pairOf.get(i) === i) };
    },
    getAnswer() { return pairOf.size ? [...Array(n).keys()].map((i) => (pairOf.has(i) ? pairOf.get(i) : -1)) : null; },
    setAnswer(v) {
      pairOf.clear();
      if (Array.isArray(v)) v.forEach((r, l) => { if (l < n && Number.isInteger(r) && r >= 0 && r < n && ![...pairOf.values()].includes(r)) pairOf.set(l, r); });
      render();
    },
    reveal() { pairOf.clear(); for (let i = 0; i < n; i++) pairOf.set(i, i); locked = true; render(); mark(true); },
    reset() {
      locked = false;
      for (const [l, r] of [...pairOf]) if (l !== r) pairOf.delete(l);
      render();
      lefts.forEach(({ b }) => { b.querySelector('.match-mark').textContent = ''; });
    },
    destroy() {},
  };
}
