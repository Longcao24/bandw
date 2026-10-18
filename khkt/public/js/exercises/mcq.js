// Multiple choice (one answer). Shuffled with a seeded RNG unless shuffle:false.
import { shuffle } from '../util.js';
import { choiceList } from './_frame.js';

export function create(step, api) {
  const n = step.options.length;
  const order = step.shuffle === false ? [...Array(n).keys()] : shuffle([...Array(n).keys()], api.seed);
  const list = choiceList(api.uid || `ex-${step.id}`, step.options, order, () => api.onChange());
  return {
    el: list.el,
    isReady: () => list.value !== null,
    check() { const v = list.value; list.lock(); list.mark(step.answer, v); return { correct: v === step.answer }; },
    reveal() { list.lock(); list.mark(step.answer, 'reveal'); },
    reset() { list.lock(false); list.clearMarks(); list.clear(); },
    getAnswer: () => list.value,
    setAnswer(v) { list.set(Number.isInteger(v) ? v : null); },
    destroy() {},
  };
}
