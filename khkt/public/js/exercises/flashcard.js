// Flashcard (judge question). Not graded: self-rated 'good' / 'again'. Also used by practice mode.
import { el } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { announce } from '../a11y.js';

/** Reusable card view. opts: { onRate(r), showPrompt:boolean, previous } */
export function flashcardView(step, { onRate, showPrompt = false, previous = null } = {}) {
  const root = el('div.flashcard');
  const front = el('div.fc-front', null,
    showPrompt ? el('div.fc-question', { html: inline(step.prompt) }) : null,
    el('p.fc-say', null, el('span', { 'aria-hidden': 'true' }, '🎤 '), 'Hãy tự trả lời thành tiếng trước, rồi mới lật thẻ.'));
  const flip = el('button.btn.primary.fc-flip', { type: 'button' }, '🔄 Lật thẻ');
  front.append(flip);
  const back = el('div.fc-back', { hidden: true });
  const checks = el('ul.fc-points', { 'aria-label': 'Ý chính cần có' },
    step.keyPoints.map((k, i) => {
      const id = `fc-${step.id}-${i}`.replace(/\./g, '-');
      return el('li', null, el('input', { type: 'checkbox', id }), el('label', { for: id, html: inline(k) }));
    }));
  const rated = el('p.fc-rated', { hidden: true, role: 'status' });
  const good = el('button.btn.success', { type: 'button' }, '👍 Đã trả lời tốt');
  const again = el('button.btn', { type: 'button' }, '🔁 Cần ôn lại');
  back.append(
    el('div.fc-answer', null, el('div.fc-label', null, 'Câu trả lời mẫu'), el('div', { html: blocks(step.modelAnswer) })),
    el('div.fc-label', null, 'Em đã nói được những ý nào? (tự đánh dấu)'), checks,
    el('div.fc-rate', null, good, again), rated);
  root.append(front, back);
  if (previous) root.append(el('p.ex-sub', null, previous.r === 'good' ? 'Lần trước: 👍 Đã trả lời tốt' : 'Lần trước: 🔁 Cần ôn lại'));
  flip.addEventListener('click', () => {
    back.hidden = false; flip.hidden = true; root.classList.add('flipped');
    announce('Đã lật thẻ');
    back.querySelector('.fc-answer').setAttribute('tabindex', '-1');
    back.querySelector('.fc-answer').focus();
  });
  const rate = (r) => {
    good.classList.toggle('chosen', r === 'good'); again.classList.toggle('chosen', r === 'again');
    good.setAttribute('aria-pressed', String(r === 'good')); again.setAttribute('aria-pressed', String(r === 'again'));
    const pts = onRate ? onRate(r) : 0;
    rated.hidden = false;
    rated.textContent = (r === 'good' ? 'Tuyệt! Thẻ này sẽ được ôn ít hơn.' : 'Không sao, thẻ này sẽ quay lại sớm.') + (pts ? ` +${pts} ⚡` : '');
  };
  good.addEventListener('click', () => rate('good'));
  again.addEventListener('click', () => rate('again'));
  return { el: root, flipped: () => !back.hidden };
}

export function create(step, api) {
  const prev = api.store && api.store.progress.cards[step.id];
  const view = flashcardView(step, {
    previous: prev,
    onRate: (r) => {
      const pts = api.store ? api.store.rateCard(step.id, r) : 0;
      api.done({ rated: r });
      return pts;
    },
  });
  return { el: view.el, isReady: () => true, check: () => ({ correct: true }), reveal() {}, reset() {}, destroy() {} };
}
