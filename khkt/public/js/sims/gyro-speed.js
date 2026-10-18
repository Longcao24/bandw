// gyro-speed: the gyroscope measures rotation SPEED (°/s), not angle. Speedometer with "đứng yên" (40) and "ngưỡng lắc" (100).
import { frame, s, h, attr, wristCross, fmt, signed, clamp, ticker, slider, sectorPath, Timeline, timelineHandle, staticHandle, isReduced, DEG } from './_shared.js';
import { C } from './_model.js';

export const meta = {
  id: 'gyro-speed',
  title: 'Con quay đo tốc độ xoay',
  timeline: false,
  checkpoints: ['still', 'slow', 'fast', 'end'],
  hotspots: [{ id: 'needle', label: 'Kim tốc độ quay' }, { id: 'threshold-line', label: 'Ngưỡng lắc 100 °/s' }],
  defaults: { thresholdDps: 100, stillDps: 40, initialDps: 30, compareAccel: true, tour: false },
};

const AMP = 35; // wrist sweeps between ±35°
const tri = (x) => { const p = ((x % 4) + 4) % 4; return p < 1 ? p : p < 3 ? 2 - p : p - 4; }; // −1..1 triangle

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  const TH = P.thresholdDps, ST = P.stillDps;
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[290, 300], [350, 300]],
    alt: `Cổ tay quay qua lại với tốc độ chọn được. Đồng hồ tốc độ: dưới ${ST} °/s là "đứng yên", trên ${TH} °/s là ngưỡng lắc. Gia tốc kế gần như không đổi (|a| ≈ 1 g) trong khi con quay tăng vọt.`,
  });
  const [A, B] = f.svgs;
  A.append(s('text', { x: 145, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Cổ tay quay qua lại'));
  const wrist = wristCross(A, { cx: 145, cy: 170, r: 60 });
  const angTxt = s('text', { x: 145, y: 268, 'text-anchor': 'middle', 'font-size': 15, class: 'bw-mono', 'font-weight': 700 });
  const accTxt = s('text', { x: 145, y: 290, 'text-anchor': 'middle', 'font-size': 13.5, class: 't-muted' });
  A.append(angTxt, accTxt);

  const GX = 175, GY = 170, R = 120, MAX = 400, K = 90 / MAX;
  B.append(s('text', { x: GX, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Con quay: gy (°/s)'));
  const sec = (a0, a1, fill) => B.append(s('path', { d: sectorPath(GX, GY, R - 30, R, a0 * K, a1 * K), fill, stroke: 'var(--c-surface)', 'stroke-width': 1.5 }));
  sec(-MAX, -TH, 'var(--c-danger-bg)'); sec(-TH, -ST, 'var(--c-surface-2)'); sec(-ST, ST, 'var(--viz-neutral)'); sec(ST, TH, 'var(--c-surface-2)'); sec(TH, MAX, 'var(--c-danger-bg)');
  const tickAt = (v, len = 14) => { const a = v * K * DEG; return [GX + (R + 2) * Math.sin(a), GY - (R + 2) * Math.cos(a), GX + (R + len) * Math.sin(a), GY - (R + len) * Math.cos(a)]; };
  [-400, 0, 400].forEach((v) => { const [x1, y1, x2, y2] = tickAt(v, 8); B.append(s('line', { x1, y1, x2, y2, stroke: 'var(--c-muted)', 'stroke-width': 2 })); const a = v * K * DEG; B.append(s('text', { x: GX + (R + 24) * Math.sin(a), y: GY - (R + 24) * Math.cos(a) + 5, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')); });
  const thG = s('g', { 'data-hotspot': 'threshold-line', 'data-label': `Ngưỡng lắc ${TH} °/s` });
  [-TH, TH].forEach((v) => { const a = v * K * DEG; thG.append(s('line', { x1: GX + (R - 34) * Math.sin(a), y1: GY - (R - 34) * Math.cos(a), x2: GX + (R + 10) * Math.sin(a), y2: GY - (R + 10) * Math.cos(a), class: 'line-enter', 'stroke-dasharray': 'none', 'stroke-width': 4 })); });
  [-TH, TH].forEach((v) => { const a = v * K * DEG; thG.append(s('text', { x: GX + (R + 26) * Math.sin(a), y: GY - (R + 26) * Math.cos(a) + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--viz-enter)' }, v > 0 ? `+${TH}` : `−${TH}`)); });
  thG.append(s('text', { x: GX, y: GY + 56, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: 'var(--viz-enter)' }, `vạch đỏ: ngưỡng lắc ±${TH} °/s`));
  B.append(thG);
  B.append(s('text', { x: GX, y: GY - R + 46, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: 'var(--viz-y)' }, `đứng yên < ${ST}`));
  const needleG = s('g', { 'data-hotspot': 'needle', 'data-label': 'Kim tốc độ quay' });
  const needle = s('line', { x1: GX, y1: GY, stroke: 'var(--c-text)', 'stroke-width': 5, 'stroke-linecap': 'round' });
  needleG.append(needle, s('circle', { cx: GX, cy: GY, r: 9, fill: 'var(--c-text)' })); B.append(needleG);
  const big = s('text', { x: GX, y: GY + 38, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, class: 'bw-mono' });
  B.append(big);
  // mini gy trace
  const TX0 = 20, TX1 = 330, TY = 262, TH2 = 30;
  B.append(s('rect', { x: TX0, y: TY - TH2, width: TX1 - TX0, height: TH2 * 2, rx: 4, class: 'panel-bg' }));
  const ty = (v) => TY - clamp(v / MAX, -1, 1) * TH2;
  B.append(s('line', { x1: TX0, x2: TX1, y1: ty(TH), y2: ty(TH), class: 'line-enter', 'stroke-width': 1.5 }), s('line', { x1: TX0, x2: TX1, y1: ty(-TH), y2: ty(-TH), class: 'line-enter', 'stroke-width': 1.5 }));
  const trace = s('polyline', { fill: 'none', stroke: 'var(--viz-y)', 'stroke-width': 2 }); B.append(trace);
  B.append(s('text', { x: TX0, y: 296, 'font-size': 12, class: 't-muted' }, 'gy trong 2 giây gần nhất'));
  const verdict = h('div', { class: 'bw-card' }, h('span', { class: 'bw-card__k' }, 'Firmware hiểu là'), h('span', { class: 'bw-card__v' }));
  f.readout.append(verdict);

  const hist = [];
  const draw = (tMs, dps) => {
    const ph = dps ? (tMs / 1000) * dps / AMP : 0;
    const a = dps ? AMP * tri(ph) : 20;
    const p = ((ph % 4) + 4) % 4;
    const gy = dps ? (p < 1 || p >= 3 ? dps : -dps) : 0;
    wrist.set(a);
    angTxt.textContent = `góc ${signed(a)}° · gy = ${signed(gy)} °/s`;
    accTxt.textContent = P.compareAccel ? `gia tốc kế: |a| = ${fmt(1, 2)} g (không đổi)` : '';
    const ang = clamp(gy, -MAX, MAX) * K * DEG;
    attr(needle, { x2: GX + (R - 12) * Math.sin(ang), y2: GY - (R - 12) * Math.cos(ang) });
    big.textContent = `${signed(gy)} °/s`;
    hist.push([tMs, gy]); while (hist.length && hist[0][0] < tMs - 2000) hist.shift();
    if (hist.length && hist[hist.length - 1][0] < hist[0][0]) hist.splice(0, hist.length - 1);
    trace.setAttribute('points', hist.map(([t, v]) => `${(TX1 - ((tMs - t) / 2000) * (TX1 - TX0)).toFixed(1)},${ty(v).toFixed(1)}`).join(' '));
    const sp = Math.abs(gy);
    verdict.lastChild.textContent = sp < ST ? `Đứng yên (< ${ST} °/s): có thể là trung tính` : sp <= TH ? 'Đang cử động (chưa đủ để thành pha lắc)' : `Xoay nhanh > ${TH} °/s: có thể là một pha lắc`;
    verdict.className = `bw-card ${sp > TH ? 'is-bad' : sp < ST ? 'is-ok' : 'is-warn'}`;
  };

  if (P.tour) {
    const beats = [
      { id: 'still', dps: 0, dur: 2600, caption: 'Giữ yên tay nghiêng 20°: con quay báo ≈ 0 °/s. Nó đo tốc độ quay, không đo góc.' },
      { id: 'slow', dps: 30, dur: 3200, caption: 'Quay chậm 30 °/s: dưới 40 °/s vẫn được coi là "đứng yên".' },
      { id: 'fast', dps: 220, dur: 3200, caption: 'Quay nhanh 220 °/s: vượt ngưỡng lắc 100 °/s.' },
      { id: 'end', dps: 220, dur: 400, caption: 'Gia tốc kế cho biết đang nghiêng bao nhiêu; con quay cho biết đang xoay nhanh cỡ nào.' },
    ];
    const tl = new Timeline({ beats, ctx, render: ({ beat, T }) => { if (T < 1) hist.length = 0; draw(T - beat.start, beat.dps); } });
    return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('fast') - 300 });
  }
  let dps = clamp(P.initialDps, 0, 400), t = 0;
  const sl = slider({ label: 'Tốc độ quay', min: 0, max: 400, step: 10, value: dps, unit: ' °/s', onInput: (v) => { dps = v; if (reduced) draw(t += 300, dps); } });
  f.panel.append(sl.el);
  const clock = ticker((dt) => { t += dt; draw(t, dps); });
  f.setCaption('Kéo thanh tốc độ: kim vượt vạch đỏ 100 °/s là "xoay nhanh". Gia tốc kế gần như không đổi.');
  draw(reduced ? 300 : 0, dps);
  if (!reduced) clock.start();
  return staticHandle({ f, start: () => { if (!reduced) clock.start(); }, stop: () => clock.stop() });
}
