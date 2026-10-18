// Sim-predict: play the sim to `pauseAt`, ask, then (after the final answer) resume to `revealTo`.
import { el, shuffle } from '../util.js';
import { mountSim } from '../render/sim-host.js';
import { choiceList } from './_frame.js';

export function create(step, api) {
  const n = step.options.length;
  const order = step.shuffle === false ? [...Array(n).keys()] : shuffle([...Array(n).keys()], api.seed);
  const stage = el('div.sp-stage');
  const overlay = el('div.sp-overlay', { hidden: true, role: 'status' }, el('strong', null, '⏸ Dừng lại! Em đoán xem…'));
  const list = choiceList(api.uid || `ex-${step.id}`, step.options, order, () => api.onChange());
  const question = el('div.sp-question', { hidden: true }, list.el);
  const startBtn = el('button.btn.primary.sp-start', { type: 'button' }, '▶ Xem');
  const status = el('p.ex-sub.sp-status', { 'aria-live': 'polite' }, 'Đang phát mô phỏng…');
  const wrap = el('div.sim-predict', null, el('div.sp-frame', null, stage, overlay), status, question);
  let paused = false;
  let destroyed = false;
  // Set once the answer is final (lesson: after check/reveal; exam review: immediately). From then on the
  // pause-and-ask flow must not run: it would stop the reveal playback and ask the student to "choose" again.
  let finalized = false;
  const host = mountSim(stage, { sim: step.sim, props: step.props }, {});
  host.setControlsDisabled(true);

  async function playToPause() {
    if (finalized) return;
    startBtn.remove();
    status.textContent = 'Đang phát mô phỏng…';
    const inst = await host.ready;
    if (destroyed || finalized) return;
    // Safety net: if pauseAt is never reached (sim stuck, tab throttled…), show the question anyway
    // and let the student skip, instead of leaving the step hanging on "Đang phát mô phỏng…".
    let timer = 0;
    const timedOut = await Promise.race([
      Promise.resolve(inst.runTo(step.pauseAt)).then(() => false, (e) => { console.warn(e); return false; }),
      new Promise((r) => { timer = setTimeout(() => r(true), 90000); }),
    ]);
    clearTimeout(timer);
    if (finalized) return; // onFinal took over the timeline (exam review)
    if (timedOut && api.broken) api.broken();
    try { inst.pause(); } catch { /* ignore */ }
    if (destroyed) return;
    host.setPlaying(false);
    paused = true;
    overlay.hidden = false;
    question.hidden = false;
    status.textContent = 'Mô phỏng đã dừng. Chọn điều em nghĩ sẽ xảy ra tiếp theo.';
    api.onChange();
  }
  if (api.reducedMotion) {
    status.textContent = 'Bấm ▶ Xem để chạy mô phỏng tới điểm dừng.';
    wrap.insertBefore(startBtn, status);
    startBtn.addEventListener('click', playToPause);
  } else {
    host.ready.then(() => playToPause());
  }

  return {
    el: wrap,
    isReady: () => paused && list.value !== null,
    check() { const v = list.value; list.lock(); list.mark(step.answer, v); question.hidden = false; return { correct: v === step.answer }; },
    reveal() { list.lock(); list.mark(step.answer, 'reveal'); question.hidden = false; },
    reset() { list.lock(false); list.clearMarks(); list.clear(); },
    getAnswer: () => list.value,
    setAnswer(v) { list.set(Number.isInteger(v) ? v : null); },
    async onFinal() {
      const wasPaused = paused;
      finalized = true;
      overlay.hidden = true;
      question.hidden = false;
      startBtn.remove();
      status.textContent = 'Xem điều thực sự xảy ra…';
      try {
        const inst = await host.ready;
        if (destroyed) return;
        // Exam review: the sim never stopped at pauseAt, so jump there first and play only the reveal.
        if (!wasPaused && inst.timeline && typeof inst.seek === 'function') {
          try { inst.pause(); } catch { /* ignore */ }
          inst.seek(inst.timeline.targetOf(step.pauseAt));
        }
        await inst.runTo(step.revealTo || 'end');
      } catch (e) { console.warn(e); }
      if (destroyed) return;
      host.setControlsDisabled(false);
      host.setPlaying(false);
      status.textContent = 'Đó là kết quả thật của thuật toán. Em có thể phát lại để xem kỹ hơn.';
    },
    destroy() { destroyed = true; host.destroy(); },
  };
}
