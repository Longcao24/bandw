// Flashcard (judge question). Not graded: self-rated 'good' / 'again'. Also used by practice mode.
// Optional "Tự trả lời & chấm bằng AI" (grading/panel.js): the learner types or dictates an answer and
// /api/grade scores it; the best AI score is saved in progress.ai (synced). Self-rating is unchanged.
import { el } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { announce } from '../a11y.js';
import { createGrader } from '../grading/panel.js';

/**
 * Reusable card view. opts: { onRate(r), showPrompt:boolean, previous, store, ai:boolean }
 * `store` defaults to the app store (window.__bw.store) so every caller gets AI grading; ai:false hides it.
 */
export function flashcardView(step, { onRate, showPrompt = false, previous = null, store, ai = true } = {}) {
  if (store === undefined) store = (typeof window !== 'undefined' && window.__bw && window.__bw.store) || null;
  const root = el('div.flashcard');
  const front = el('div.fc-front', null,
    showPrompt ? el('div.fc-question', { html: inline(step.prompt) }) : null,
    el('p.fc-say', null, el('span', { 'aria-hidden': 'true' }, '🎤 '), 'Hãy tự trả lời thành tiếng trước, rồi mới lật thẻ.'));
  const flip = el('button.btn.primary.fc-flip', { type: 'button' }, '🔄 Lật thẻ');
  front.append(flip);
  let grader = null;
  const aiBox = el('div.fc-ai', { hidden: true });
  const aiBtn = ai ? el('button.btn.fc-ai-btn', { type: 'button', 'aria-expanded': 'false', 'aria-controls': `fc-ai-${step.id}`.replace(/\./g, '-') },
    el('span', { 'aria-hidden': 'true' }, '✍️ '), 'Tự trả lời & chấm bằng AI') : null;
  if (aiBtn) {
    aiBox.id = aiBtn.getAttribute('aria-controls');
    front.append(aiBtn);
    aiBtn.addEventListener('click', () => {
      const open = aiBox.hidden;
      aiBox.hidden = !open;
      aiBtn.setAttribute('aria-expanded', String(open));
      if (open && !grader) {
        grader = createGrader(step, { store, compact: true,
          onResult: () => { if (back.hidden) aiBox.append(hint); } });
        aiBox.append(grader.el);
      }
      if (open) grader.focus();
    });
  }
  const hint = el('p.fc-ai-hint', null, '👉 Bấm ', el('strong', null, '🔄 Lật thẻ'), ' để so với câu trả lời mẫu và tự đánh giá.');
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
    // Coaching note for the team (not part of the model answer, never sent to the AI grader).
    ...(step.explanation ? [el('p.ex-sub.fc-tip', null, '💡 ', el('span', { html: inline(step.explanation) }))] : []),
    el('div.fc-label', null, 'Em đã nói được những ý nào? (tự đánh dấu)'), checks,
    el('div.fc-rate', null, good, again), rated);
  root.append(front, aiBox, back);
  if (previous) root.append(el('p.ex-sub', null, previous.r === 'good' ? 'Lần trước: 👍 Đã trả lời tốt' : 'Lần trước: 🔁 Cần ôn lại'));
  flip.addEventListener('click', () => {
    back.hidden = false; flip.hidden = true; root.classList.add('flipped'); hint.remove();
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
  return { el: root, flipped: () => !back.hidden, destroy() { if (grader) grader.destroy(); } };
}

export function create(step, api) {
  const prev = api.store && api.store.progress.cards[step.id];
  const view = flashcardView(step, {
    previous: prev, store: api.store || null, ai: api.mode !== 'exam',
    onRate: (r) => {
      const pts = api.store ? api.store.rateCard(step.id, r) : 0;
      api.done({ rated: r });
      return pts;
    },
  });
  return { el: view.el, isReady: () => true, check: () => ({ correct: true }), reveal() {}, reset() {}, destroy() { view.destroy(); } };
}
