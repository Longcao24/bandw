// tinyml-classifier: one 1.5 s window of IMU data → 9 features → a 5-neuron model → probabilities → decision.
// Pick a gesture, try another take, move the confidence threshold, switch the weights to int8.
// Synthetic data from _tinyml.js (people the model never saw in training); not a BandW measurement.
import { frame, s, h, fmt, clamp, slider, toggle, chipButtons, staticHandle } from './_shared.js';
import { COMMANDS } from './_model.js';
import { standardLab, predict, decide, size, FEATURES, CLASSES, CLASS_LABEL, WINDOW, RATE_HZ } from './_tinyml.js';

export const meta = {
  id: 'tinyml-classifier',
  title: 'Mô hình TinyML đoán cử chỉ',
  timeline: false,
  checkpoints: [],
  hotspots: [
    { id: 'window', label: 'Cửa sổ dữ liệu 1,5 giây' },
    { id: 'features', label: 'Các đặc trưng' },
    { id: 'probs', label: 'Xác suất cho từng lớp' },
    { id: 'threshold', label: 'Ngưỡng tự tin' },
  ],
  defaults: { label: 'WATER', take: 0, threshold: 0.8, int8: false, showInt8: true },
};

const NONE_NAME = { rest: 'tay nghỉ, hơi run', walk: 'đi bộ', flick: 'nghiêng nhẹ thoáng qua', 'one-dip': 'chúc cẳng tay 1 lần', raise: 'nâng tay rồi giữ' };

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const lab = standardLab();
  const st = { label: CLASSES.includes(P.label) ? P.label : 'WATER', take: Math.max(0, P.take | 0), th: clamp(+P.threshold || 0.8, 0.5, 0.99), int8: !!P.int8 };
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[320, 340], [320, 340]],
    alt: `Bên trái: ${WINDOW} mẫu (1,5 giây) của ax, ay và gy. Bên phải: 9 đặc trưng tính từ cửa sổ, đi qua mô hình 5 nơ-ron để ra xác suất cho 5 lớp. Vòng tay chỉ phát lệnh khi xác suất cao nhất vượt ngưỡng tự tin. Dữ liệu tổng hợp, không phải số đo thật.`,
  });
  const [A, B] = f.svgs;

  // ---- pane A: the window ----
  A.append(s('text', { x: 160, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, `Cửa sổ 1,5 s = ${WINDOW} mẫu`));
  const winG = s('g', { 'data-hotspot': 'window', 'data-label': 'Cửa sổ dữ liệu 1,5 giây' }); A.append(winG);
  const X0 = 46, X1 = 310, LH = 72;
  const lanes = [
    { key: 'x', label: 'ax (g)', lo: -1, hi: 1, color: 'var(--viz-x)' },
    { key: 'y', label: 'ay (g)', lo: -0.3, hi: 1, color: 'var(--viz-y)' },
    { key: 'gy', label: 'gy (°/s)', lo: -300, hi: 300, color: 'var(--viz-z)' },
  ].map((L, n) => {
    const y0 = 40 + n * (LH + 14);
    const yv = (v) => y0 + LH - ((clamp(v, L.lo, L.hi) - L.lo) / (L.hi - L.lo)) * LH;
    winG.append(s('rect', { x: X0, y: y0, width: X1 - X0, height: LH, class: 'panel-bg' }));
    winG.append(s('line', { x1: X0, x2: X1, y1: yv(0), y2: yv(0), stroke: 'var(--c-border)', 'stroke-width': 1 }));
    winG.append(s('text', { x: X0 - 4, y: y0 + LH / 2 + 4, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, fill: L.color }, L.label.split(' ')[0]));
    const line = s('polyline', { fill: 'none', stroke: L.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round' });
    winG.append(line);
    return { ...L, yv, line };
  });
  A.append(s('text', { x: 160, y: 310, 'text-anchor': 'middle', 'font-size': 12.5, class: 't-muted' }, `${RATE_HZ} mẫu/giây × 1,5 s × 6 trục = ${WINDOW * 6} con số`));
  const kindTxt = s('text', { x: 160, y: 330, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }); A.append(kindTxt);

  // ---- pane B: features → probabilities ----
  B.append(s('text', { x: 160, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, '9 đặc trưng → 5 nơ-ron → xác suất'));
  const featG = s('g', { 'data-hotspot': 'features', 'data-label': 'Các đặc trưng' }); B.append(featG);
  const FX = 112, FW = 168, FMID = FX + FW / 2;
  featG.append(s('line', { x1: FMID, x2: FMID, y1: 36, y2: 36 + FEATURES.length * 15, stroke: 'var(--c-border)', 'stroke-width': 1 }));
  const fBars = FEATURES.map((ft, i) => {
    const y = 38 + i * 15;
    featG.append(s('text', { x: FX - 6, y: y + 10, 'text-anchor': 'end', 'font-size': 11.5, class: 't-muted' }, ft.label));
    const bar = s('rect', { y, height: 11, rx: 2, fill: 'var(--c-primary)' }); featG.append(bar);
    return bar;
  });
  const PY = 194, PH = 22;
  const probG = s('g', { 'data-hotspot': 'probs', 'data-label': 'Xác suất cho từng lớp' }); B.append(probG);
  const pRows = CLASSES.map((c, i) => {
    const y = PY + i * PH;
    probG.append(s('rect', { x: FX, y, width: FW, height: PH - 6, rx: 3, class: 'panel-bg' }));
    probG.append(s('text', { x: FX - 6, y: y + 12, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700 }, CLASS_LABEL[c]));
    const bar = s('rect', { x: FX, y, height: PH - 6, rx: 3 });
    const val = s('text', { x: FX + FW + 4, y: y + 12, 'font-size': 11.5, class: 'bw-mono' });
    probG.append(bar, val);
    return { bar, val };
  });
  const thG = s('g', { 'data-hotspot': 'threshold', 'data-label': 'Ngưỡng tự tin' }); B.append(thG);
  const thLine = s('line', { y1: PY - 6, y2: PY + CLASSES.length * PH, stroke: 'var(--viz-enter)', 'stroke-width': 3, 'stroke-dasharray': '6 4' });
  const thTxt = s('text', { y: PY - 9, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700, fill: 'var(--viz-enter)' });
  thG.append(s('rect', { x: FX, y: PY - 22, width: FW, height: 16, class: 'bw-hs-hit' }), thLine, thTxt);
  const sizeTxt = s('text', { x: 160, y: 330, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }); B.append(sizeTxt);

  const verdict = h('div', { class: 'bw-card' }, h('span', { class: 'bw-card__k' }, 'Vòng tay sẽ'), h('span', { class: 'bw-card__v' }));
  f.readout.append(verdict);

  const pool = (label) => lab.testSet.filter((d) => d.label === label);
  const render = () => {
    const list = pool(st.label), d = list[st.take % list.length];
    const model = st.int8 ? lab.int8 : lab.model;
    lanes.forEach((L) => L.line.setAttribute('points', d.win.map((p, k) => `${(X0 + (k / (WINDOW - 1)) * (X1 - X0)).toFixed(1)},${L.yv(p[L.key]).toFixed(1)}`).join(' ')));
    kindTxt.textContent = `Mẫu thật là: ${st.label === 'NONE' ? `không làm gì (${NONE_NAME[d.kind]})` : st.label} · người #${d.person}`;
    d.x.forEach((v, i) => {
      const z = clamp((v - model.mu[i]) / model.sd[i], -3, 3), w = Math.abs(z) / 3 * (FW / 2);
      fBars[i].setAttribute('x', (z < 0 ? FMID - w : FMID).toFixed(1)); fBars[i].setAttribute('width', w.toFixed(1));
    });
    const probs = predict(model, d.x), dec = decide(probs, st.th);
    probs.forEach((p, i) => {
      pRows[i].bar.setAttribute('width', (p * FW).toFixed(1));
      pRows[i].bar.setAttribute('fill', i === dec.index ? 'var(--c-primary)' : 'var(--c-muted)');
      pRows[i].val.textContent = `${fmt(p * 100)}%`;
    });
    const tx = FX + st.th * FW;
    thLine.setAttribute('x1', tx); thLine.setAttribute('x2', tx); thTxt.setAttribute('x', tx); thTxt.textContent = `ngưỡng ${fmt(st.th * 100)}%`;
    const sz = size(model);
    sizeTxt.textContent = `${sz.params} tham số · ${st.int8 ? `int8 ≈ ${sz.int8}` : `float32 = ${sz.float32}`} byte`;
    const pct = `${fmt(dec.confidence * 100)}%`;
    let msg, cls;
    if (dec.fire) { msg = `Phát ${dec.label} (tự tin ${pct})`; cls = dec.label === st.label ? 'is-ok' : 'is-bad'; }
    else if (dec.index === 0) { msg = `Im lặng: đoán “không làm gì” (${pct})`; cls = st.label === 'NONE' ? 'is-ok' : 'is-bad'; }
    else { msg = `Im lặng: nghiêng về ${dec.label} nhưng chỉ ${pct}, dưới ngưỡng`; cls = 'is-warn'; }
    if (cls === 'is-bad') msg += st.label === 'NONE' ? ' · lệnh nhầm!' : ' · sai!';
    verdict.lastChild.textContent = msg; verdict.className = `bw-card ${cls}`;
  };

  const chips = chipButtons(CLASSES.map((c) => ({ value: c, label: CLASS_LABEL[c], color: COMMANDS[c] ? COMMANDS[c].color : null })),
    { value: st.label, label: 'Chọn cử chỉ', onPick: (v) => { st.label = v; st.take = 0; render(); } });
  const next = h('button', { type: 'button', class: 'btn sm', onclick: () => { st.take++; render(); } }, 'Mẫu khác ↻');
  const sl = slider({ label: 'Ngưỡng tự tin', min: 0.5, max: 0.99, step: 0.01, value: st.th, fmtFn: (v) => `${fmt(v * 100)}%`, onInput: (v) => { st.th = v; render(); } });
  f.panel.append(chips.el, next, sl.el);
  if (P.showInt8) f.panel.append(toggle({ label: 'Trọng số int8 (lượng tử hoá)', checked: st.int8, onChange: (v) => { st.int8 = v; render(); } }).el);
  f.setCaption('Chọn một cử chỉ rồi bấm “Mẫu khác” để thử người khác, lần làm khác. Dữ liệu là tổng hợp, chỉ để minh hoạ cách mô hình làm việc.');
  render();
  return staticHandle({ f });
}
