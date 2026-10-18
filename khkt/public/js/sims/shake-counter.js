// shake-counter: gy trace with ±100 °/s bands, pulse counting (2 samples, alternating, ≥80 ms), 900 ms window.
import { frame, s, h, attr, fmt, signed, clamp, lerp, easeOut, Timeline, timelineHandle } from './_shared.js';
import { makeSignal, runTrace, rowAt, C, COMMANDS } from './_model.js';

export const meta = {
  id: 'shake-counter',
  title: 'Đếm pha lắc cổ tay',
  timeline: true,
  checkpoints: ['pulse1', 'pulse2', 'pulse3', 'emit', 'expired', 'ignored', 'end'],
  hotspots: [{ id: 'window-bar', label: 'Cửa sổ 900 ms' }, { id: 'counter', label: 'Bộ đếm pha' }, { id: 'threshold-band', label: 'Ngưỡng ±100 °/s' }],
  defaults: { thresholdDps: 100, windowMs: 900, pulsesNeeded: 3, minGapMs: 80, preset: 'good-shake' },
};

const PRESET = {
  'good-shake': { segs: [{ hold: 500 }, { shake: { amp: 220, n: 5, phases: 3 } }, { hold: 900 }], name: 'Lắc đúng: 3 lần đổi chiều nhanh' },
  'single-jolt': { segs: [{ hold: 500 }, { gy: 250, n: 1 }, { hold: 400 }, { gy: -240, n: 1 }, { hold: 700 }], name: 'Giật một cái (mỗi lần chỉ 1 mẫu)' },
  'too-slow': { segs: [{ hold: 400 }, { gy: 220, n: 2 }, { hold: 1000 }, { gy: -220, n: 2 }, { hold: 1000 }, { gy: 220, n: 2 }, { hold: 500 }], name: 'Lắc quá chậm: mỗi pha cách 1 giây' },
  'same-direction': { segs: [{ hold: 500 }, { gy: 200, n: 15 }, { hold: 1100 }], name: 'Xoay nhanh một chiều 300 ms' },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const pr = PRESET[P.preset] || PRESET['good-shake'];
  const tr = runTrace(makeSignal(pr.segs, { seed: 23 }));
  const rows = tr.rows;
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[420, 300], [220, 300]],
    alt: `Đồ thị tốc độ quay gy theo thời gian, có dải ngưỡng ±100 °/s. ${pr.name}. Mỗi pha hợp lệ được đánh số; đủ 3 pha trong cửa sổ 900 ms thì phát NO.`,
  });
  const [A, B] = f.svgs;
  const X0 = 46, X1 = 408, Y0 = 40, Y1 = 270;
  const tx = (t) => X0 + ((t - tr.t0) / (tr.t1 - tr.t0)) * (X1 - X0);
  const ty = (v) => Y0 + (1 - (clamp(v, -280, 280) + 280) / 560) * (Y1 - Y0);
  A.append(s('text', { x: X0, y: 24, 'font-size': 15, 'font-weight': 700 }, pr.name));
  A.append(s('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'panel-bg' }));
  const band = s('g', { 'data-hotspot': 'threshold-band', 'data-label': 'Ngưỡng ±100 °/s' },
    s('rect', { x: X0, y: ty(100), width: X1 - X0, height: ty(-100) - ty(100), fill: 'var(--viz-neutral)' }),
    s('line', { x1: X0, x2: X1, y1: ty(100), y2: ty(100), class: 'line-enter' }),
    s('line', { x1: X0, x2: X1, y1: ty(-100), y2: ty(-100), class: 'line-enter' }));
  A.append(band);
  [[200, '+200'], [100, '+100'], [0, '0'], [-100, '−100'], [-200, '−200']].forEach(([v, l]) => A.append(s('text', { x: X0 - 6, y: ty(v) + 5, 'text-anchor': 'end', 'font-size': 13, class: 't-muted' }, l)));
  A.append(s('text', { x: X1, y: Y1 + 22, 'text-anchor': 'end', 'font-size': 13, class: 't-muted' }, 'thời gian →   gy (°/s)'));
  const ghost = s('polyline', { points: rows.map((r) => `${tx(r.t).toFixed(1)},${ty(r.gy).toFixed(1)}`).join(' '), fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 2 });
  const live = s('polyline', { fill: 'none', stroke: 'var(--viz-y)', 'stroke-width': 3, 'stroke-linejoin': 'round' });
  const dots = s('g');
  const markers = s('g');
  const winRect = s('rect', { y: Y0 + 2, height: Y1 - Y0 - 4, fill: 'var(--c-primary)', opacity: 0.08 });
  const cursor = s('line', { y1: Y0, y2: Y1, stroke: 'var(--c-text)', 'stroke-width': 1.5 });
  A.append(winRect, ghost, live, dots, markers, cursor);
  const dotEls = rows.map((r) => dots.appendChild(s('circle', { cx: tx(r.t), cy: ty(r.gy), r: 2.6, fill: Math.abs(r.gy) > C.SHAKE_DPS ? 'var(--viz-enter)' : 'var(--viz-y)', opacity: 0 })));

  // events: pulses, emission, expiry
  const ev = [];
  let prevP = 0, firstExpire = true;
  rows.forEach((r, i) => {
    if (r.event) { ev.push({ kind: 'pulse', n: 3, i, t: r.t, sign: r.gy > 0 ? 1 : -1 }); ev.push({ kind: 'emit', i, t: r.t }); }
    else if (r.shakePulses > prevP) ev.push({ kind: 'pulse', n: r.shakePulses, i, t: r.t, sign: r.shakeSign });
    else if (prevP && !r.shakePulses && firstExpire) { ev.push({ kind: 'expire', i, t: r.t }); firstExpire = false; }
    prevP = r.shakePulses;
  });
  ev.forEach((e) => {
    if (e.kind !== 'pulse') return;
    const x = tx(e.t), y = e.sign > 0 ? ty(250) : ty(-250);
    e.el = s('g', { opacity: 0 }, s('circle', { cx: x, cy: y, r: 13, fill: 'var(--c-primary)' }), s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--c-primary-ink, #fff)' }, String(e.n)));
    markers.append(e.el);
  });

  // right pane: counter + window bar + verdict
  const ctr = s('g', { 'data-hotspot': 'counter', 'data-label': 'Bộ đếm pha' });
  ctr.append(s('rect', { x: 14, y: 24, width: 192, height: 110, class: 'bw-hs-hit' }));
  ctr.append(s('text', { x: 110, y: 40, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted', 'font-weight': 600 }, 'shakePulses'));
  const big = s('text', { x: 110, y: 90, 'text-anchor': 'middle', 'font-size': 40, 'font-weight': 700, class: 'bw-mono' });
  ctr.append(big);
  const pips = [0, 1, 2].map((k) => ctr.appendChild(s('circle', { cx: 70 + k * 40, cy: 118, r: 11, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 2 })));
  B.append(ctr);
  const wb = s('g', { 'data-hotspot': 'window-bar', 'data-label': 'Cửa sổ 900 ms' });
  wb.append(s('text', { x: 110, y: 168, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted', 'font-weight': 600 }, 'Cửa sổ 900 ms'));
  wb.append(s('rect', { x: 20, y: 178, width: 180, height: 20, rx: 6, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)' }));
  const wfill = s('rect', { x: 20, y: 178, height: 20, rx: 6, fill: 'var(--c-primary)' });
  const wtxt = s('text', { x: 110, y: 218, 'text-anchor': 'middle', 'font-size': 14, class: 'bw-mono' });
  wb.append(wfill, wtxt); B.append(wb);
  const vG = s('g', { opacity: 0 });
  const vR = s('rect', { x: 20, y: 240, width: 180, height: 40, rx: 20, stroke: 'rgba(0,0,0,.15)' });
  const vT = s('text', { x: 110, y: 266, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 });
  vG.append(vR, vT); B.append(vG);

  // beats
  const capPulse = (e) => e.n === 1 ? `Pha 1: gy vượt ${e.sign > 0 ? '+' : '−'}100 °/s hai mẫu liền → đếm 1/3, mở cửa sổ 900 ms.` : e.n === 2 ? 'Pha 2: đổi chiều, cách pha trước ≥ 80 ms → 2/3.' : 'Pha 3 trong 900 ms → đủ 3/3!';
  const marks = [];
  const seen = new Set();
  ev.forEach((e) => {
    if (e.kind === 'pulse' && !seen.has(e.n)) { seen.add(e.n); marks.push({ id: `pulse${e.n}`, t: e.t, caption: capPulse(e) }); }
    if (e.kind === 'emit') marks.push({ id: 'emit', t: e.t + 200, caption: 'emit(Gesture::No): vòng tay gửi "NO" → điện thoại nói "Không."' });
    if (e.kind === 'expire' && !rows.some((r) => r.event)) marks.push({ id: P.preset === 'too-slow' ? 'expired' : 'ignored', t: e.t, caption: P.preset === 'too-slow' ? 'Hết 900 ms mà chưa đủ 3 pha: bộ đếm về 0. Lắc chậm không thành "Không".' : 'Chỉ có 1 pha (không đổi chiều) rồi hết 900 ms: bị bỏ qua.' });
  });
  if (!marks.length || (P.preset === 'single-jolt')) marks.push({ id: 'ignored', t: tr.t1 - 300, caption: 'Mỗi cú giật chỉ vượt ngưỡng 1 mẫu, không đủ 2 mẫu liền nên không thành pha nào.' });
  marks.sort((a, b) => a.t - b.t);
  const beats = [];
  let t0 = tr.t0;
  const intro = { 'pulse1': 'Theo dõi tốc độ quay gy. Dải xanh là ±100 °/s.' };
  marks.forEach((m) => { beats.push({ id: m.id, t0, t1: m.t, caption: m.caption, intro: intro[m.id], dur: clamp((m.t - t0) * 2.6, 1200, 5000) }); t0 = m.t; });
  beats.push({ id: 'end', t0, t1: tr.t1, dur: clamp((tr.t1 - t0) * 1.5, 500, 2500), caption: rows.some((r) => r.event) ? 'Lắc = 3 pha đổi chiều nhanh trong 900 ms.' : 'Không phát lệnh nào: chỉ lắc thật mới thành "Không".' });

  const render = ({ beat, t01 }) => {
    const simT = lerp(beat.t0, beat.t1, t01);
    const i = rowAt(rows, simT), r = rows[i];
    live.setAttribute('points', rows.slice(0, i + 1).map((q) => `${tx(q.t).toFixed(1)},${ty(q.gy).toFixed(1)}`).join(' '));
    dotEls.forEach((d, k) => d.setAttribute('opacity', k <= i ? 1 : 0));
    attr(cursor, { x1: tx(simT), x2: tx(simT) });
    ev.forEach((e) => e.el && e.el.setAttribute('opacity', e.t <= simT && (r.shakePulses >= e.n || rows.slice(e.i, i + 1).some((q) => q.event)) ? 1 : e.t <= simT ? 0.25 : 0));
    const emitted = rows.slice(0, i + 1).find((q) => q.event);
    const n = emitted ? 3 : r.shakePulses;
    big.textContent = `${n}/3`;
    pips.forEach((p, k) => attr(p, { fill: k < n ? 'var(--c-primary)' : 'var(--c-surface-2)', stroke: k < n ? 'var(--c-primary)' : 'var(--c-border)' }));
    if (r.shakePulses && !emitted) {
      const left = clamp(C.SHAKE_WINDOW_MS - (r.t - r.shakeStart), 0, 900);
      attr(wfill, { width: 180 * left / 900, fill: left < 250 ? 'var(--viz-exit)' : 'var(--c-primary)' });
      wtxt.textContent = `còn ${left} ms`;
      attr(winRect, { x: tx(r.shakeStart), width: tx(r.shakeStart + 900) - tx(r.shakeStart), opacity: 0.1 });
    } else {
      attr(wfill, { width: emitted ? 0 : 0 });
      wtxt.textContent = emitted ? 'đã dùng xong' : 'chưa mở';
      attr(winRect, { opacity: 0 });
    }
    const failed = beat.id === 'expired' || beat.id === 'ignored' || (beat.id === 'end' && !rows.some((q) => q.event));
    const show = emitted || (failed && t01 > 0.85) || beat.id === 'end';
    vG.setAttribute('opacity', show ? 1 : 0);
    if (emitted) { vR.setAttribute('fill', COMMANDS.NO.color); vT.textContent = '📡 NO'; vT.setAttribute('fill', 'var(--c-text-on-light, #21242c)'); }
    else { vR.setAttribute('fill', 'var(--c-danger-bg)'); vT.textContent = '✗ Không phát'; vT.setAttribute('fill', 'var(--c-danger)'); }
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => (tl.has('pulse2') ? tl.targetOf('pulse2') : tl.targetOf('end')) });
}
