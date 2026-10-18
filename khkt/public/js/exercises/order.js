// Order: drag (pointer events, works on touch) AND ▲/▼ buttons on every item.
import { el, shuffledIndices } from '../util.js';
import { inline } from '../render/markdown.js';
import { announce } from '../a11y.js';

export function create(step, api) {
  const n = step.items.length;
  let order = shuffledIndices(n, api.seed); // order[pos] = item index
  let touched = false;
  let locked = false;
  const list = el('ol.order-list', { 'aria-label': 'Danh sách cần sắp xếp' });

  function render(focusIdx, focusDir) {
    list.replaceChildren();
    order.forEach((itemIdx, pos) => {
      const up = el('button.icon-btn', { type: 'button', 'aria-label': `Đưa "${step.items[itemIdx]}" lên`, disabled: locked || pos === 0, onclick: () => move(pos, -1) }, '▲');
      const down = el('button.icon-btn', { type: 'button', 'aria-label': `Đưa "${step.items[itemIdx]}" xuống`, disabled: locked || pos === n - 1, onclick: () => move(pos, 1) }, '▼');
      const li = el('li.order-item', { 'data-item': itemIdx },
        el('span.order-handle', { 'aria-hidden': 'true', title: 'Kéo để sắp xếp' }, '⋮⋮'),
        el('span.order-num', { 'aria-hidden': 'true' }, String(pos + 1)),
        el('span.order-text', { html: inline(step.items[itemIdx]) }),
        el('span.order-mark', { 'aria-hidden': 'true' }),
        el('span.order-btns', null, up, down));
      li.addEventListener('pointerdown', (e) => startDrag(e, li, pos));
      list.append(li);
      if (focusIdx === itemIdx) requestAnimationFrame(() => {
        const b = focusDir < 0 ? (pos === 0 ? down : up) : (pos === n - 1 ? up : down);
        b.focus();
      });
    });
  }
  function move(pos, dir) {
    const to = pos + dir;
    if (locked || to < 0 || to >= n) return;
    const item = order[pos];
    order.splice(pos, 1); order.splice(to, 0, item);
    touched = true;
    render(item, dir);
    announce(`Đã chuyển tới vị trí ${to + 1}`);
    api.onChange();
  }

  let drag = null;
  function startDrag(e, li, pos) {
    if (locked || e.target.closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // On touch, only the handle starts a drag so the page can still scroll.
    if (e.pointerType !== 'mouse' && !e.target.closest('.order-handle')) return;
    e.preventDefault();
    const rects = [...list.children].map((c) => c.getBoundingClientRect());
    drag = { li, from: pos, startY: e.clientY, rects, to: pos };
    li.classList.add('dragging');
    li.setPointerCapture(e.pointerId);
    li.addEventListener('pointermove', onMove);
    li.addEventListener('pointerup', onUp, { once: true });
    li.addEventListener('pointercancel', onUp, { once: true });
  }
  function onMove(e) {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    drag.li.style.transform = `translateY(${dy}px)`;
    const y = drag.rects[drag.from].top + drag.rects[drag.from].height / 2 + dy;
    let to = drag.rects.findIndex((r) => y < r.top + r.height / 2);
    if (to === -1) to = n - 1;
    else if (to > drag.from) to -= 1;
    drag.to = Math.max(0, Math.min(n - 1, to));
    [...list.children].forEach((c, i) => c.classList.toggle('drop-target', i === drag.to && i !== drag.from));
  }
  function onUp() {
    if (!drag) return;
    const { from, to, li } = drag;
    li.removeEventListener('pointermove', onMove);
    drag = null;
    if (to !== from) {
      const item = order[from];
      order.splice(from, 1); order.splice(to, 0, item);
      touched = true;
      api.onChange();
    }
    render();
  }

  function mark(final) {
    [...list.children].forEach((li, pos) => {
      const ok = Number(li.dataset.item) === pos;
      li.classList.toggle('is-correct', ok);
      li.classList.toggle('is-wrong', !ok && !final);
      li.querySelector('.order-mark').textContent = ok ? '✓' : final ? '' : '✕';
    });
  }
  render();
  return {
    el: el('div.order', null, el('p.ex-sub', null, 'Kéo thả hoặc dùng nút ▲ ▼ để đổi chỗ.'), list),
    isReady: () => touched,
    check() { locked = true; render(); mark(false); return { correct: order.every((v, i) => v === i) }; },
    reveal() { locked = true; order = [...Array(n).keys()]; render(); mark(true); },
    reset() { locked = false; render(); },
    getAnswer: () => (touched ? order.slice() : null),
    setAnswer(v) {
      if (!Array.isArray(v) || v.length !== n || new Set(v).size !== n || v.some((x) => !Number.isInteger(x) || x < 0 || x >= n)) return;
      order = v.slice(); touched = true; render();
    },
    destroy() {},
  };
}
