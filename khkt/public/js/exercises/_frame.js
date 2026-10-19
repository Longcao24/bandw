// Shared exercise frame: prompt, optional visual, hint, attempts, feedback, points, store update.
import { el } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { diagramSvg } from '../render/diagram.js';
import { mountSim } from '../render/sim-host.js';
import { announce } from '../a11y.js';
import { iconSvg } from '../icons.js';

const LOADERS = {
  mcq: () => import('./mcq.js'), multi: () => import('./multi.js'), truefalse: () => import('./truefalse.js'),
  order: () => import('./order.js'), match: () => import('./match.js'), number: () => import('./number.js'),
  predict: () => import('./predict.js'), flashcard: () => import('./flashcard.js'), hotspot: () => import('./hotspot.js'),
  'sim-predict': () => import('./sim-predict.js'),
};
export const TYPE_LABEL = {
  mcq: 'Chọn một đáp án', multi: 'Chọn tất cả đáp án đúng', truefalse: 'Đúng hay sai?', order: 'Sắp xếp theo thứ tự',
  match: 'Ghép cặp', number: 'Điền số', predict: 'Đoán kết quả của mã', flashcard: 'Thẻ phản biện',
  hotspot: 'Chạm vào hình', 'sim-predict': 'Dự đoán mô phỏng',
};

/** A shared radio-choice list (mcq / predict / sim-predict / truefalse). */
export function choiceList(name, options, order, onChange, { inlineHtml = true, cls = '' } = {}) {
  const group = el('div.choices' + (cls ? '.' + cls : ''), { role: 'radiogroup' });
  const inputs = [];
  order.forEach((oi, pos) => {
    const input = el('input', { type: 'radio', name, value: String(oi), id: `${name}-${oi}` });
    input.addEventListener('change', onChange);
    inputs.push(input);
    const letter = String.fromCharCode(65 + pos);
    group.append(el('label.choice', { for: input.id, 'data-index': oi },
      input, el('span.choice-letter', { 'aria-hidden': 'true' }, letter),
      el('span.choice-text', { html: inlineHtml ? inline(options[oi]) : undefined }, inlineHtml ? null : options[oi]),
      el('span.choice-mark', { 'aria-hidden': 'true' })));
  });
  return {
    el: group,
    get value() { const c = inputs.find((i) => i.checked); return c ? Number(c.value) : null; },
    lock(b = true) { inputs.forEach((i) => { i.disabled = b; }); group.classList.toggle('locked', b); },
    mark(correctIndex, chosen) {
      for (const lab of group.children) {
        const idx = Number(lab.dataset.index);
        lab.classList.toggle('is-correct', idx === correctIndex && (chosen === undefined || chosen === idx || chosen === 'reveal'));
        lab.classList.toggle('is-wrong', chosen !== undefined && chosen !== 'reveal' && idx === chosen && idx !== correctIndex);
        lab.querySelector('.choice-mark').textContent = lab.classList.contains('is-correct') ? '✓' : lab.classList.contains('is-wrong') ? '✕' : '';
      }
    },
    clearMarks() { for (const lab of group.children) { lab.classList.remove('is-correct', 'is-wrong'); lab.querySelector('.choice-mark').textContent = ''; } },
    clear() { inputs.forEach((i) => { i.checked = false; }); },
    /** exam mode: restore a saved choice (original option index) */
    set(v) { inputs.forEach((i) => { i.checked = v !== null && v !== undefined && Number(i.value) === v; }); },
  };
}

function renderVisual(visual, cleanups) {
  if (!visual) return null;
  const box = el('div.ex-visual');
  if (visual.kind === 'sim') {
    const h = mountSim(box, { sim: visual.sim, props: visual.props }, {});
    cleanups.push(() => h.destroy());
  } else {
    const node = diagramSvg(visual);
    if (node.setAttribute) { node.setAttribute('role', 'img'); node.setAttribute('aria-label', visual.alt || ''); }
    box.append(el('figure.diagram', null, el('div.diagram-stage', null, node)));
  }
  return box;
}

/**
 * Creates an exercise card. Returns a controller used by the lesson player:
 * { el, ready:Promise, state, onUpdate(fn), check(), retry(), reveal(), showHint(), destroy() }
 * state = { phase:'answer'|'wrong'|'done', ready, correct, revealed, wrongCount, hintShown, canReveal, graded, feedback }
 *
 * Exam mode (`mode: 'exam'`, used by the mock exam): nothing is recorded in the store and no feedback is
 * shown. The controller additionally exposes getAnswer() / setAnswer(v) (a JSON value keyed by ORIGINAL
 * option indices, so it survives shuffling and refreshes), review(v) (restore + lock + mark + explanation)
 * and showCorrect() (lock + reveal the right answer). `onAnswer(v)` fires on every change. `uid` keeps DOM
 * ids unique when the same question is rendered twice on one page.
 */
export function createExercise(step, { store, reducedMotion = false, mode = 'lesson', uid, onAnswer } = {}) {
  const exam = mode === 'exam';
  if (exam) store = null;
  const cleanups = [];
  const listeners = new Set();
  const graded = step.type !== 'flashcard';
  const card = el('div.ex' + (exam ? '.ex-exam' : ''), { 'data-type': step.type, 'data-id': step.id });
  card.append(el('div.ex-type', null, TYPE_LABEL[step.type] || 'Bài tập'));
  const visual = renderVisual(step.visual, cleanups);
  if (visual) card.append(visual);
  card.append(el('div.ex-prompt', { html: inline(step.prompt) }));
  const body = el('div.ex-body');
  card.append(body);
  const hintBox = el('div.ex-hint', { hidden: true, role: 'note' });
  const explainBox = el('div.ex-explain', { hidden: true });
  card.append(hintBox, explainBox);

  const state = { phase: 'answer', ready: false, correct: false, revealed: false, wrongCount: 0, attempt: 0, hintShown: false,
    canReveal: false, graded, hasHint: !!step.hint, feedback: null, earned: 0 };
  let comp = null;
  const prev = store && store.progress.ex[step.id];
  const update = () => { for (const fn of listeners) fn(state); };

  const api = {
    reducedMotion, seed: step.id, store, uid: uid || `ex-${step.id}`, mode,
    onChange() {
      state.ready = !!(comp && comp.isReady());
      if (onAnswer && comp && comp.getAnswer) { try { onAnswer(comp.getAnswer()); } catch (e) { console.error(e); } }
      update();
    },
    /** components that grade themselves (flashcard) call this when finished */
    done(info = {}) { state.phase = 'done'; state.ready = true; Object.assign(state, info); update(); },
    /** the exercise cannot be answered (e.g. its sim failed to load): allow skipping */
    broken() { state.broken = true; update(); },
  };

  const ready = (async () => {
    try {
      const mod = await LOADERS[step.type]();
      comp = mod.create(step, api);
      body.append(comp.el);
      if (!graded) { state.ready = true; }
      update();
    } catch (e) {
      console.error(e);
      body.append(el('p.ex-error', null, 'Không tải được bài tập này. Em bấm Tiếp tục để đi tiếp.'));
      state.phase = 'done'; state.ready = true; update();
    }
  })();

  function showExplanation() {
    if (!step.explanation) return;
    explainBox.hidden = false;
    explainBox.innerHTML = `<div class="ex-explain-title">${iconSvg('info', 16)}Giải thích</div>${blocks(step.explanation)}`;
  }

  return {
    el: card, ready, state, step,
    onUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get alreadyCorrect() { return !!(prev && prev.c); },
    check() {
      if (!comp || state.phase !== 'answer' || !comp.isReady()) return;
      const { correct } = comp.check();
      state.attempt += 1;
      if (correct) {
        const r = store ? store.recordAttempt(step.id, { correct: true, attempt: state.attempt, hintUsed: state.hintShown }) : { earned: 0, pts: 10 };
        state.phase = 'done'; state.correct = true; state.earned = r.pts;
        state.feedback = { kind: 'success', title: 'Chính xác!', points: r.pts, earned: r.earned };
        showExplanation();
        if (comp.onFinal) comp.onFinal(true);
      } else {
        if (store) store.recordAttempt(step.id, { correct: false, attempt: state.attempt });
        state.phase = 'wrong'; state.wrongCount += 1;
        state.canReveal = state.wrongCount >= 2;
        state.feedback = { kind: 'error', title: 'Chưa đúng', text: 'Em xem lại rồi thử lần nữa nhé.' + (step.hint && !state.hintShown ? ' Có thể bấm Gợi ý ở thanh dưới.' : '') };
      }
      update();
    },
    retry() {
      if (state.phase !== 'wrong' || !comp) return;
      comp.reset();
      state.phase = 'answer'; state.ready = comp.isReady(); state.feedback = null;
      update();
    },
    reveal() {
      if (!comp || state.phase === 'done') return;
      comp.reveal();
      if (store) store.recordReveal(step.id);
      state.phase = 'done'; state.revealed = true; state.earned = 0;
      state.feedback = { kind: 'warn', title: 'Đáp án đúng đã được tô sáng', text: 'Đọc kỹ giải thích rồi tiếp tục nhé. Lần sau em sẽ làm được!' };
      showExplanation();
      if (comp.onFinal) comp.onFinal(false);
      update();
    },
    showHint() {
      if (!step.hint || state.hintShown) return;
      state.hintShown = true;
      hintBox.hidden = false;
      hintBox.innerHTML = `<span class="ex-hint-i">${iconSvg('lightbulb', 18)}</span><span><strong>Gợi ý: </strong>${inline(step.hint)}</span>`;
      announce(hintBox.textContent);
      update();
    },
    // ---- exam mode ----
    /** Human label for an answer token (hotspot region id → its data-label), once the regions are mounted. */
    async labeler() {
      await ready;
      if (!comp || typeof comp.labelOf !== 'function') return null;
      try { if (comp.regionsReady) await comp.regionsReady(); } catch { /* ignore */ }
      return (id) => comp.labelOf(id);
    },
    getAnswer() { return comp && comp.getAnswer ? comp.getAnswer() : null; },
    async setAnswer(v) {
      await ready;
      if (!comp || !comp.setAnswer || v === null || v === undefined) return;
      try { comp.setAnswer(v); } catch (e) { console.error(e); }
      state.ready = comp.isReady(); update();
    },
    /** Restores the learner's answer, locks the card and marks it (✓/✕) with the explanation shown. */
    async review(v) {
      await ready;
      if (!comp) return;
      if (comp.setAnswer && v !== null && v !== undefined) { try { comp.setAnswer(v); } catch (e) { console.error(e); } }
      if (v === null || v === undefined) comp.reveal();
      else { try { comp.check(); } catch (e) { console.error(e); comp.reveal(); } }
      state.phase = 'done'; showExplanation();
      if (comp.onFinal) comp.onFinal(false);
      update();
    },
    /** Locks the card and shows the correct answer (no store record in exam mode). */
    async showCorrect() {
      await ready;
      if (!comp) return;
      comp.reveal(); state.phase = 'done'; state.revealed = true;
      if (comp.onFinal) comp.onFinal(false);
      update();
    },
    destroy() { try { comp && comp.destroy && comp.destroy(); } catch (e) { console.error(e); } cleanups.forEach((f) => f()); },
  };
}
