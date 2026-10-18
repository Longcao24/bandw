// hold-timer: a ring fills while the pose is held beyond the threshold; a short flick fails, a real hold emits.
// Only WATER/FOOD use the 250 ms hold. HELP is two quick forearm dips (see forward-flex), so the legacy prop
// value gesture: 'help' is accepted but shows the same tilt hold, with a note that HELP does not use a hold.
import { frame, s, h, attr, wristCross, fmt, signed, clamp, lerp, easeOut, ring, Timeline, timelineHandle } from './_shared.js';
import { makeSignal, runTrace, rowAt, findRow, C, COMMANDS } from './_model.js';

export const meta = {
  id: 'hold-timer',
  title: 'Thời gian giữ tư thế',
  timeline: true,
  checkpoints: ['start', 'too-short', 'start2', 'emit', 'end'],
  hotspots: [{ id: 'ring', label: 'Vòng đếm giờ giữ' }, { id: 'timer-label', label: 'Số mili giây đã giữ' }],
  defaults: { holdMs: 250, gesture: 'tilt', preset: 'both' },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const HOLD = C.HOLD_MS; // the detector port uses the firmware constant
  const flick = [{ move: 360, roll: -32 }, { hold: 300 }, { move: 360, roll: 0 }, { hold: 700 }];
  const real = [{ move: 500, roll: -40 }, { hold: 900 }, { move: 500, roll: 0 }, { hold: 500 }];
  const segs = [{ hold: 500 }, ...(P.preset !== 'hold' ? flick : []), ...(P.preset !== 'flick' ? real : [])];
  const tr = runTrace(makeSignal(segs, { seed: 17 }));
  const rows = tr.rows, cmd = 'WATER';

  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[300, 340], [300, 340]],
    alt: `Nghiêng trái vượt ngưỡng thì vòng tròn bắt đầu đầy dần. Phải giữ đủ ${HOLD} ms thì mới phát lệnh ${cmd}; cử động thoáng qua thì vòng tròn chưa đầy đã về 0. Thời gian giữ chỉ dùng cho WATER và FOOD; HELP là 2 lần nhấp cẳng tay nhanh, không dùng giữ.`,
  });
  const [A, B] = f.svgs;
  A.append(s('text', { x: 150, y: 28, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Nghiêng trái (nhìn từ sau)'));
  A.append(s('text', { x: 150, y: 50, 'text-anchor': 'middle', 'font-size': 12.5, class: 't-muted' }, 'Giữ chỉ dùng cho WATER, FOOD. HELP: nhấp 2 lần.'));
  const pose = wristCross(A, { cx: 150, cy: 190, r: 62 });
  const angTxt = s('text', { x: 150, y: 312, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, class: 'bw-mono' });
  const ruleTxt = s('text', { x: 150, y: 334, 'text-anchor': 'middle', 'font-size': 13, class: 't-muted' }, `ngưỡng vào ${C.TILT_ENTER_DEG}° (góc đã lọc)`);
  A.append(angTxt, ruleTxt);

  B.append(s('text', { x: 150, y: 28, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, `Đồng hồ giữ: cần ${HOLD} ms`));
  const ringG = s('g', { 'data-hotspot': 'ring', 'data-label': 'Vòng đếm giờ giữ' }); B.append(ringG);
  const rg = ring(ringG, { cx: 150, cy: 170, r: 92, width: 22 });
  const ticks = s('g');
  for (let k = 0; k < 10; k++) { const a = (k / 10) * 2 * Math.PI; ticks.append(s('line', { x1: 150 + 106 * Math.sin(a), y1: 170 - 106 * Math.cos(a), x2: 150 + 112 * Math.sin(a), y2: 170 - 112 * Math.cos(a), stroke: 'var(--c-muted)', 'stroke-width': 2 })); }
  B.append(ticks);
  const tl1 = s('text', { x: 150, y: 172, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 700, class: 'bw-mono' });
  const tl2 = s('text', { x: 150, y: 200, 'text-anchor': 'middle', 'font-size': 15, class: 't-muted' }, `/ ${HOLD} ms`);
  B.append(s('g', { 'data-hotspot': 'timer-label', 'data-label': 'Số mili giây đã giữ' }, s('rect', { x: 90, y: 136, width: 120, height: 72, class: 'bw-hs-hit' }), tl1, tl2));
  const verdict = s('g', { opacity: 0 });
  const vRect = s('rect', { x: 40, y: 290, width: 220, height: 38, rx: 19, stroke: 'rgba(0,0,0,.15)' });
  const vTxt = s('text', { x: 150, y: 315, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 't-on-light' });
  verdict.append(vRect, vTxt); B.append(verdict);
  const spark = s('g', { opacity: 0 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI; spark.append(s('line', { x1: 150 + 120 * Math.sin(a), y1: 170 - 120 * Math.cos(a), x2: 150 + 138 * Math.sin(a), y2: 170 - 138 * Math.cos(a), stroke: 'var(--c-success)', 'stroke-width': 5, 'stroke-linecap': 'round' })); }
  B.append(spark);

  // beats from the trace
  const c1 = findRow(rows, (r) => r.candidate);
  const e = findRow(rows, (r) => r.event);
  const beats = [];
  const T = (i) => rows[Math.max(0, Math.min(rows.length - 1, i))].t;
  const slow = 2.6;
  const add = (id, t0, t1, caption, extra = {}) => beats.push({ id, t0, t1, caption, dur: clamp((t1 - t0) * slow, 1200, 5000), ...extra });
  if (P.preset !== 'hold') {
    const c1end = findRow(rows, (r) => !r.candidate, c1);
    add('start', T(0), T(c1), `Nghiêng nhanh một cái: góc đã lọc vượt ngưỡng…`);
    add('too-short', T(c1), T(c1end) + 300, `…nhưng chỉ giữ ${T(c1end) - T(c1)} ms (< ${HOLD} ms) rồi thả: đồng hồ về 0, không phát lệnh.`, { fail: [c1, c1end] });
    if (P.preset === 'both') {
      const c2 = findRow(rows, (r) => r.candidate, c1end);
      add('start2', T(c1end) + 300, T(c2), 'Lần này nghiêng và giữ yên…');
      add('emit', T(c2), T(e) + 360, `Giữ đủ ${HOLD} ms → phát ${cmd}!`, { emitAt: e });
    }
  } else {
    const c2 = findRow(rows, (r) => r.candidate);
    add('start', T(0), T(c2), 'Nghiêng cổ tay và giữ yên…');
    add('emit', T(c2), T(e) + 360, `Giữ đủ ${HOLD} ms → phát ${cmd}!`, { emitAt: e });
  }
  const last = beats[beats.length - 1];
  beats.push({ id: 'end', t0: last.t1, t1: last.t1, dur: 500, caption: P.preset === 'flick' ? 'Cử động thoáng qua bị bỏ qua: đó là mục đích của thời gian giữ.' : `Chỉ tư thế được giữ đủ ${HOLD} ms mới thành lệnh.` });

  let peak = 0;
  const render = ({ beat, t01 }) => {
    const simT = lerp(beat.t0, beat.t1, t01);
    const r = rows[rowAt(rows, simT)];
    pose.set(r.roll);
    angTxt.textContent = `góc nghiêng ${signed(r.filtered)}°`;
    const held = r.candidate ? r.t - r.candidateAt : 0;
    let p = held / HOLD, col = 'var(--c-primary)', label = `${Math.min(held, HOLD)}`;
    if (beat.fail && !r.candidate && simT > rows[beat.fail[0]].t) {
      peak = rows[beat.fail[1] - 1].t - rows[beat.fail[0]].t;
      p = peak / HOLD; col = 'var(--c-danger)'; label = `${peak}`;
    }
    const emitted = beat.emitAt != null && simT >= rows[beat.emitAt].t;
    if (emitted || beat.id === 'end' && P.preset !== 'flick') { p = 1; col = 'var(--c-success)'; label = `${HOLD}`; }
    rg.set(p); rg.color(col);
    tl1.textContent = label;
    tl1.setAttribute('fill', col === 'var(--c-primary)' ? 'var(--c-text)' : col);
    const showFail = beat.fail && col === 'var(--c-danger)';
    verdict.setAttribute('opacity', showFail || emitted || (beat.id === 'end') ? 1 : 0);
    if (showFail || (beat.id === 'end' && P.preset === 'flick')) { vRect.setAttribute('fill', 'var(--c-danger-bg)'); vTxt.textContent = '✗ Quá ngắn: không phát'; vTxt.setAttribute('fill', 'var(--c-danger)'); }
    else { vRect.setAttribute('fill', COMMANDS[cmd].color); vTxt.textContent = `✓ Phát ${cmd}`; vTxt.setAttribute('fill', 'var(--c-text-on-light, #21242c)'); }
    const sp = emitted ? clamp((simT - rows[beat.emitAt].t) / 300, 0, 1) : 0;
    attr(spark, { opacity: emitted ? 1 - sp * 0.6 : 0, transform: `translate(150,170) scale(${0.8 + 0.3 * easeOut(sp)}) translate(-150,-170)` });
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf(beats[beats.length - 2].id) - 1 });
}
