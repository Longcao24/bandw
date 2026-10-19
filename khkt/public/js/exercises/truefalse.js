// True / false: two big buttons "Đúng" / "Sai" (radio semantics).
import { choiceList } from './_frame.js';

export function create(step, api) {
  const list = choiceList(api.uid || `ex-${step.id}`, ['Đúng', 'Sai'], [0, 1], () => api.onChange(), { cls: 'tf' });
  const answerIdx = step.answer ? 0 : 1;
  return {
    el: list.el,
    isReady: () => list.value !== null,
    check() { const v = list.value; list.lock(); list.mark(answerIdx, v); return { correct: v === answerIdx }; },
    reveal() { list.lock(); list.mark(answerIdx, 'reveal'); },
    reset() { list.lock(false); list.clearMarks(); list.clear(); },
    getAnswer: () => (list.value === null ? null : list.value === 0),
    setAnswer(v) { list.set(typeof v === 'boolean' ? (v ? 0 : 1) : null); },
    destroy() {},
  };
}
