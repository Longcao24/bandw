// threshold-hysteresis: one threshold chatters around its mark; two thresholds (enter 22°, exit 12°) stay stable.
import { frame, s, h, attr, fmt, signed, clamp, lerp, ticker, slider, toggle, Timeline, timelineHandle, staticHandle, isReduced } from './_shared.js';
import { rng } from './_model.js';

export const meta = {
  id: 'threshold-hysteresis',
  title: 'Ngưỡng vào – ngưỡng ra (độ trễ)',
  timeline: true,
  checkpoints: ['rise', 'cross-enter', 'wobble', 'cross-exit', 'end'],
  hotspots: [{ id: 'enter-line', label: 'Ngưỡng vào' }, { id: 'exit-line', label: 'Ngưỡng ra' }, { id: 'state-strip', label: 'Dải trạng thái Bật/Tắt' }],
  defaults: { enterDeg: 22, exitDeg: 12, singleDeg: 17, signal: 'noisy', compareSingle: true },
};

function noisySignal(seed = 3) {
  const r = rng(seed), out = [];
  const key = [[0, 0], [1200, 17.5], [2000, 18], [2600, 30], [3000, 21], [3800, 19], [4600, 3], [5600, 3]];
  let n = 0;
  for (let t = 0; t <= 5600; t += 20) {
    let k = 0; while (k < key.length - 2 && key[k + 1][0] <= t) k++;
    const [t0, v0] = key[k], [t1, v1] = key[k + 1];
    const u = clamp((t - t0) / (t1 - t0), 0, 1), base = v0 + (v1 - v0) * (u * u * (3 - 2 * u));
    const amp = t > 900 && t < 2050 ? 3 : t > 2900 && t < 3900 ? 4 : 0.8;
    n = n * 0.55 + (r() * 2 - 1) * 0.9;
    out.push({ t, v: base + amp * (Math.sin(t / 61) * 0.7 + Math.sin(t / 23 + 1) * 0.3) + n });
  }
  return out;
}
function runStates(data, enter, exit, single) {
  let dual = false, one = false, nd = 0, no = 0;
  return data.map((d) => {
    const a = Math.abs(d.v);
    if (!dual && a > enter) { dual = true; nd++; } else if (dual && a < exit) { dual = false; nd++; }
    const o = a > single; if (o !== one) { one = o; no++; }
    return { ...d, dual, one, nd, no };
  });
}

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const EN = P.enterDeg, EX = P.exitDeg, SG = P.singleDeg;
  const reduced = isReduced(ctx);
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[440, 320], [200, 320]],
    alt: `Đồ thị góc nghiêng theo thời gian với ngưỡng vào ${EN}° (đỏ, nét gạch), ngưỡng ra ${EX}° (cam, chấm) và một ngưỡng duy nhất ${SG}° để so sánh. Dải bên dưới cho thấy trạng thái Bật/Tắt: một ngưỡng bật tắt liên tục khi góc rung quanh mốc, hai ngưỡng thì ổn định.`,
  });
  const [A, B] = f.svgs;
  const X0 = 40, X1 = 430, Y0 = 20, Y1 = 220, VMAX = 36;
  const yv = (v) => Y1 - (clamp(v, 0, VMAX) / VMAX) * (Y1 - Y0);
  A.append(s('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'panel-bg' }));
  A.append(s('rect', { x: X0, y: yv(EX), width: X1 - X0, height: Y1 - yv(EX), class: 'band-neutral' }));
  [0, 12, 17, 22, 30].forEach((v) => A.append(s('text', { x: X0 - 5, y: yv(v) + 5, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, `${v}°`)));
  const lineG = (id, label, v, cls, txt) => {
    const g = s('g', { 'data-hotspot': id, 'data-label': label }, s('rect', { x: X0, y: yv(v) - 7, width: X1 - X0, height: 14, class: 'bw-hs-hit' }), s('line', { x1: X0, x2: X1, y1: yv(v), y2: yv(v), class: cls }), s('text', { x: X1 - 4, y: yv(v) - 5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, fill: cls === 'line-enter' ? 'var(--viz-enter)' : 'var(--viz-exit)' }, txt));
    A.append(g); return g;
  };
  lineG('enter-line', 'Ngưỡng vào', EN, 'line-enter', `vào ${EN}°`);
  lineG('exit-line', 'Ngưỡng ra', EX, 'line-exit', `ra ${EX}°`);
  const singleLine = s('g', {}, s('line', { x1: X0, x2: X1, y1: yv(SG), y2: yv(SG), stroke: 'var(--c-muted)', 'stroke-width': 2, 'stroke-dasharray': '2 3' }), s('text', { x: X0 + 4, y: yv(SG) - 5, 'font-size': 12, class: 't-muted', 'font-weight': 700 }, `một ngưỡng ${SG}°`));
  A.append(singleLine);
  const trace = s('polyline', { fill: 'none', stroke: 'var(--viz-x)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  const cursor = s('line', { y1: Y0, y2: 300, stroke: 'var(--c-text)', 'stroke-width': 1.5 });
  A.append(trace);
  // strips
  const strip = s('g', { 'data-hotspot': 'state-strip', 'data-label': 'Dải trạng thái Bật/Tắt' });
  strip.append(s('rect', { x: X0, y: 236, width: X1 - X0, height: 70, class: 'bw-hs-hit' }));
  strip.append(s('text', { x: X0, y: 250, 'font-size': 12.5, 'font-weight': 700 }, `Hai ngưỡng (${EN}°/${EX}°)`));
  const dualStrip = s('g'); strip.append(s('rect', { x: X0, y: 255, width: X1 - X0, height: 14, fill: 'var(--c-surface-2)' }), dualStrip);
  const singleTitle = s('text', { x: X0, y: 288, 'font-size': 12.5, 'font-weight': 700, class: 't-muted' }, `Một ngưỡng (${SG}°)`);
  const singleBg = s('rect', { x: X0, y: 293, width: X1 - X0, height: 14, fill: 'var(--c-surface-2)' });
  const singleStrip = s('g');
  strip.append(singleTitle, singleBg, singleStrip);
  A.append(strip, cursor);
  // right: lamps
  const lamp = (y, title) => {
    const g = s('g');
    const c = s('circle', { cx: 46, cy: y + 30, r: 22, stroke: 'var(--c-border)', 'stroke-width': 3 });
    const st = s('text', { x: 78, y: y + 28, 'font-size': 16, 'font-weight': 700 });
    const ct = s('text', { x: 78, y: y + 48, 'font-size': 13, class: 't-muted' });
    g.append(s('text', { x: 16, y: y, 'font-size': 14, 'font-weight': 700 }, title), c, st, ct); B.append(g);
    return { g, c, st, ct };
  };
  const L2 = lamp(40, 'Hai ngưỡng');
  const L1 = lamp(150, `Một ngưỡng ${SG}°`);
  const valTxt = s('text', { x: 100, y: 290, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, class: 'bw-mono' });
  B.append(valTxt);
  let compare = P.compareSingle;
  const applyCompare = () => [singleLine, singleTitle, singleBg, singleStrip, L1.g].forEach((n) => n.setAttribute('opacity', compare ? 1 : 0));
  f.panel.append(toggle({ label: `So sánh với một ngưỡng (${SG}°)`, checked: compare, onChange: (v) => { compare = v; applyCompare(); } }).el);
  applyCompare();

  const setLamp = (L, on, count) => {
    attr(L.c, { fill: on ? 'var(--viz-enter)' : 'var(--c-surface-2)' });
    L.st.textContent = on ? 'BẬT (nghiêng)' : 'TẮT';
    L.ct.textContent = `đổi trạng thái: ${count} lần`;
  };
  const drawStrips = (rows, xOf) => {
    const seg = (g, key, color) => {
      g.innerHTML = '';
      let start = null;
      rows.forEach((r, k) => {
        if (r[key] && start == null) start = k;
        if ((!r[key] || k === rows.length - 1) && start != null) { g.append(s('rect', { x: xOf(rows[start]), y: g === dualStrip ? 255 : 293, width: Math.max(1.5, xOf(rows[k]) - xOf(rows[start])), height: 14, fill: color })); start = null; }
      });
    };
    seg(dualStrip, 'dual', 'var(--viz-enter)');
    seg(singleStrip, 'one', 'var(--c-muted)');
  };

  if (P.signal === 'slider') {
    // live mode: drag the angle, optional ±3° tremor; chart scrolls (last 5 s)
    const hist = []; let t = 0, ang = 0, tremor = false, acc = 0, dual = false, one = false, nd = 0, no = 0;
    const r = rng(11);
    const sl = slider({ label: 'Góc nghiêng', min: 0, max: 35, value: 0, unit: '°', onInput: (v) => { ang = v; } });
    f.panel.prepend(sl.el);
    f.panel.append(toggle({ label: 'Rung tay ±3°', onChange: (v) => { tremor = v; } }).el);
    const step = () => {
      const v = Math.max(0, ang + (tremor ? 3 * Math.sin(t / 47) + (r() * 2 - 1) * 1.2 : 0));
      if (!dual && v > EN) { dual = true; nd++; } else if (dual && v < EX) { dual = false; nd++; }
      if ((v > SG) !== one) { one = v > SG; no++; }
      hist.push({ t, v, dual, one }); if (hist.length > 250) hist.shift(); t += 20;
    };
    const draw = () => {
      const tA = hist.length ? hist[0].t : 0;
      const xOf = (q) => X0 + ((q.t - tA) / 5000) * (X1 - X0);
      trace.setAttribute('points', hist.map((q) => `${xOf(q).toFixed(1)},${yv(q.v).toFixed(1)}`).join(' '));
      drawStrips(hist, xOf);
      const last = hist[hist.length - 1] || { v: 0, dual: false, one: false };
      attr(cursor, { x1: xOf(last), x2: xOf(last) });
      setLamp(L2, last.dual, nd); setLamp(L1, last.one, no);
      valTxt.textContent = `${fmt(last.v)}°`;
    };
    for (let k = 0; k < 30; k++) step();
    const clock = ticker((dt) => { acc += dt; while (acc >= 20) { acc -= 20; step(); } draw(); });
    f.setCaption('Kéo góc lên gần 17°–22° rồi bật "Rung tay": đèn một ngưỡng nhấp nháy, đèn hai ngưỡng thì không.');
    if (reduced) { for (let k = 0; k < 100; k++) step(); draw(); sl.input.addEventListener('input', () => { for (let k = 0; k < 60; k++) step(); draw(); }); }
    else clock.start();
    draw();
    return staticHandle({ f, start: () => { if (!reduced) clock.start(); }, stop: () => clock.stop() });
  }

  const rows = runStates(noisySignal(), EN, EX, SG);
  const xOf = (q) => X0 + (q.t / 5600) * (X1 - X0);
  const tEnter = rows.find((q) => q.dual).t;
  const tExit = rows.find((q) => q.t > tEnter && !q.dual).t;
  const beats = [
    { id: 'rise', t0: 0, t1: 2000, caption: `Tay nghiêng dần và rung quanh ${SG}°: một ngưỡng bật/tắt liên tục, hai ngưỡng vẫn TẮT vì chưa tới ${EN}°.` },
    { id: 'cross-enter', t0: 2000, t1: tEnter + 120, caption: `Góc vượt ${EN}° (ngưỡng vào): hai ngưỡng chuyển sang BẬT.` },
    { id: 'wobble', t0: tEnter + 120, t1: 3900, caption: `Góc rung xuống 15°–20°: vẫn trên ${EX}° nên hai ngưỡng giữ BẬT, không nhấp nháy.` },
    { id: 'cross-exit', t0: 3900, t1: tExit + 120, caption: `Chỉ khi xuống dưới ${EX}° (ngưỡng ra) mới TẮT: tay đã thật sự về trung tính.` },
    { id: 'end', t0: tExit + 120, t1: 5600, caption: 'Vùng giữa 12° và 22° là vùng đệm: nhờ nó, rung tay nhỏ không gây bật/tắt loạn.' },
  ].map((b) => ({ ...b, dur: clamp((b.t1 - b.t0) * 2.2, 1300, 5000) }));
  const render = ({ beat, t01 }) => {
    const tS = lerp(beat.t0, beat.t1, t01);
    const upto = rows.filter((q) => q.t <= tS);
    trace.setAttribute('points', upto.map((q) => `${xOf(q).toFixed(1)},${yv(q.v).toFixed(1)}`).join(' '));
    drawStrips(upto, xOf);
    const last = upto[upto.length - 1] || rows[0];
    attr(cursor, { x1: xOf(last), x2: xOf(last) });
    setLamp(L2, last.dual, last.nd); setLamp(L1, last.one, last.no);
    valTxt.textContent = `${fmt(last.v)}°`;
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('wobble') });
}
