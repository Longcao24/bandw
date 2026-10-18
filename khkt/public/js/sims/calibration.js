// calibration: 100 steady samples (2 s at 50 Hz) through the real Calibrator port; tremor injects rejects.
import { frame, s, h, attr, fmt, signed, clamp, lerp, slider, Timeline, timelineHandle, DEG } from './_shared.js';
import { Calibrator, rng, C } from './_model.js';

export const meta = {
  id: 'calibration',
  title: 'Hiệu chuẩn tư thế trung tính',
  timeline: true,
  checkpoints: ['collecting', 'rejected', 'reset', 'done', 'end'],
  hotspots: [{ id: 'ring', label: 'Vòng 100 mẫu' }, { id: 'reject-counter', label: 'Bộ đếm mẫu rung' }, { id: 'led', label: 'Đèn LED' }, { id: 'mean', label: 'Trung bình đang tính' }],
  defaults: { samples: 100, sampleMs: 20, maxRejects: 10, tremor: 0, showFormula: true },
};

const BASE = { x: 0.05, y: 0.1, z: 0.99 };

function build(tremor, seed = 9) {
  const rand = rng(seed + Math.round(tremor * 100));
  const cal = new Calibrator();
  const out = [];
  let t = 0, injected = 0, burstDone = false;
  const strong = tremor > 0.5;
  for (let k = 0; k < 400; k++) {
    const n = cal.count();
    let jitter = false;
    if (strong && !burstDone && n >= 40) { jitter = true; if (cal.rejects >= 10) burstDone = true; }
    else if (tremor > 0 && rand() < tremor * 0.12 && cal.rejects < 8) jitter = true;
    const nz = () => (rand() * 2 - 1) * (0.006 + tremor * 0.012);
    const big = jitter ? (rand() < 0.5 ? -1 : 1) * (0.11 + rand() * 0.05) : 0;
    const smp = { x: BASE.x + nz() + big, y: BASE.y + nz() + (jitter ? (rand() - 0.5) * 0.08 : 0), z: BASE.z + nz() * 0.3, gx: (rand() - 0.5) * 4, gy: (rand() - 0.5) * 4 + (jitter ? 25 : 0), gz: (rand() - 0.5) * 3 };
    const ok = cal.add(smp.x, smp.y, smp.z, smp.gx, smp.gy, smp.gz);
    out.push({ t, ...smp, res: cal.lastResult, n: cal.lastResult === 'done' ? 100 : cal.count(), rejects: cal.rejects, meanX: cal.n ? cal.sx / cal.n : null, meanY: cal.n ? cal.sy / cal.n : null });
    if (jitter) injected++;
    t += 20;
    if (ok) { out[out.length - 1].mean = { x: cal.meanX, y: cal.meanY, z: cal.meanZ }; break; }
  }
  return out;
}

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[330, 320], [310, 320]],
    alt: 'Vòng tròn 100 chấm lấp đầy dần khi vòng tay nhận mẫu đứng yên (50 mẫu mỗi giây, 2 giây). Mẫu rung hiện màu đỏ và tăng bộ đếm; quá 10 mẫu rung thì đếm lại từ đầu. Khi xong, mốc trung tính = atan2(meanX, meanZ) và đèn LED chuyển sang chớp ngắn.',
  });
  const [A, B] = f.svgs;
  const CX = 150, CY = 172, R = 110;
  const ringG = s('g', { 'data-hotspot': 'ring', 'data-label': 'Vòng 100 mẫu' });
  ringG.append(s('circle', { cx: CX, cy: CY, r: R + 14, class: 'bw-hs-hit' }));
  const dots = Array.from({ length: 100 }, (_, k) => {
    const a = (k / 100) * 2 * Math.PI;
    return ringG.appendChild(s('circle', { cx: CX + R * Math.sin(a), cy: CY - R * Math.cos(a), r: 4.2, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)' }));
  });
  A.append(ringG);
  A.append(s('text', { x: CX, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Giữ yên cổ tay 2 giây'));
  const cnt = s('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', 'font-size': 36, 'font-weight': 700, class: 'bw-mono' });
  const cntSub = s('text', { x: CX, y: CY + 28, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted' }, '/ 100 mẫu');
  A.append(cnt, cntSub);
  const flyer = s('circle', { r: 5, opacity: 0 }); A.append(flyer);
  const rejG = s('g', { 'data-hotspot': 'reject-counter', 'data-label': 'Bộ đếm mẫu rung' });
  rejG.append(s('rect', { x: 196, y: 286, width: 128, height: 30, rx: 8, class: 'panel-bg' }));
  const rejTxt = s('text', { x: 260, y: 306, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 });
  rejG.append(rejTxt); A.append(rejG);
  const ledG = s('g', { 'data-hotspot': 'led', 'data-label': 'Đèn LED' });
  ledG.append(s('rect', { x: 6, y: 286, width: 150, height: 30, rx: 8, class: 'panel-bg' }));
  const led = s('circle', { cx: 24, cy: 301, r: 8, stroke: 'var(--c-border)' });
  const ledTxt = s('text', { x: 38, y: 306, 'font-size': 13, 'font-weight': 600 });
  ledG.append(led, ledTxt); A.append(ledG);

  // scatter of deviations around the running mean
  const SX = 155, SY = 160, SS = 1000; // 0.1 g = 100 px
  B.append(s('text', { x: 155, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Mẫu mới so với trung bình'));
  B.append(s('rect', { x: SX - 80, y: SY - 80, width: 160, height: 160, fill: 'var(--viz-neutral)', stroke: 'var(--viz-y)', 'stroke-width': 2, rx: 4 }));
  B.append(s('text', { x: SX, y: SY - 86, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--viz-y)', 'font-weight': 700 }, 'cho phép ±0,08 g'));
  B.append(s('line', { x1: SX - 130, x2: SX + 130, y1: SY, y2: SY, class: 'grid-line' }), s('line', { x1: SX, x2: SX, y1: SY - 120, y2: SY + 120, class: 'grid-line' }));
  B.append(s('text', { x: SX + 128, y: SY - 6, 'text-anchor': 'end', 'font-size': 13, fill: 'var(--viz-x)', 'font-weight': 700 }, 'x'), s('text', { x: SX + 8, y: SY - 108, 'font-size': 13, fill: 'var(--viz-y)', 'font-weight': 700 }, 'y'));
  const scat = s('g'); B.append(scat);
  const meanG = s('g', { 'data-hotspot': 'mean', 'data-label': 'Trung bình đang tính' },
    s('circle', { cx: SX, cy: SY, r: 16, class: 'bw-hs-hit' }),
    s('line', { x1: SX - 14, x2: SX + 14, y1: SY, y2: SY, stroke: 'var(--c-text)', 'stroke-width': 3 }),
    s('line', { x1: SX, x2: SX, y1: SY - 14, y2: SY + 14, stroke: 'var(--c-text)', 'stroke-width': 3 }));
  B.append(meanG);
  const meanTxt = s('text', { x: 155, y: 298, 'text-anchor': 'middle', 'font-size': 13.5, class: 'bw-mono' });
  B.append(meanTxt);

  const fCard = h('div', { class: 'bw-card bw-card--formula' }, h('span', { class: 'bw-card__k' }, 'Kết quả hiệu chuẩn'), h('span', { class: 'bw-card__v' }, '…'));
  if (P.showFormula) f.readout.append(fCard);
  const tSlider = slider({ label: 'Run tay', min: 0, max: 1, step: 0.1, value: P.tremor, fmtFn: (v) => (v < 0.05 ? 'không' : v <= 0.5 ? `nhẹ ${fmt(v, 1)}` : `mạnh ${fmt(v, 1)}`), onInput: (v) => rebuild(v) });
  f.panel.append(tSlider.el);

  let data, beats;
  const SLOW = 3;
  const makeBeats = () => {
    const firstRej = data.findIndex((d) => d.res === 'reject');
    const resetI = data.findIndex((d) => d.res === 'reset');
    const end = data.length - 1;
    const bt = [];
    const add = (id, i0, i1, caption, dur) => bt.push({ id, i0, i1, caption, dur: dur || clamp((i1 - i0 + 1) * 20 * SLOW, 900, 6000) });
    if (resetI > 0) {
      add('collecting', 0, firstRej - 1, 'Mỗi 20 ms một mẫu. Mẫu yên (|a| 0,85–1,15 g, con quay < 20 °/s, gần trung bình) được giữ lại.');
      add('rejected', firstRej, resetI - 1, 'Tay run mạnh: mẫu lệch quá 0,08 g bị loại (chấm đỏ). Bộ đếm mẫu rung tăng dần…');
      add('reset', resetI, resetI, 'Mẫu rung thứ 11 (> 10): xoá hết, đếm lại từ 0.', 1500);
      add('done', resetI + 1, end, 'Tay yên lại: lấy đủ 100 mẫu, tính trung bình làm mốc trung tính.');
    } else {
      add('collecting', 0, Math.max(0, end - 25), 'Mỗi 20 ms một mẫu. Mẫu yên được giữ lại; mẫu rung (nếu có) bị loại nhưng không làm hỏng cả lượt.');
      add('done', Math.max(0, end - 24), end, 'Đủ 100 mẫu (2 giây): tính trung bình làm mốc trung tính.');
    }
    bt.push({ id: 'end', i0: end, i1: end, dur: 1800, caption: 'Đèn chuyển sang chớp ngắn: vòng tay sẵn sàng. Mọi góc sau này đều trừ đi mốc này.' });
    return bt;
  };

  const render = ({ beat, t01 }) => {
    const idx = Math.round(lerp(beat.i0, beat.i1, t01));
    const d = data[idx];
    const tSim = d.t + (beat.id === 'end' ? t01 * 2400 : 0);
    // ring: accepted count; latest few rejects flash red near the ring
    for (let k = 0; k < 100; k++) attr(dots[k], { fill: k < d.n ? 'var(--viz-y)' : 'var(--c-surface-2)', stroke: k < d.n ? 'var(--viz-y)' : 'var(--c-border)' });
    if (d.res === 'reject' || d.res === 'reset') {
      const a = (d.n / 100) * 2 * Math.PI;
      attr(flyer, { cx: CX + (R + 20) * Math.sin(a), cy: CY - (R + 20) * Math.cos(a), fill: 'var(--c-danger)', opacity: 1 });
    } else flyer.setAttribute('opacity', 0);
    cnt.textContent = String(d.n);
    cnt.setAttribute('fill', d.res === 'reset' ? 'var(--c-danger)' : 'var(--c-text)');
    rejTxt.textContent = d.res === 'reset' ? 'rung 11 > 10 → lại!' : `mẫu rung ${d.rejects}/10`;
    rejTxt.setAttribute('fill', d.res === 'reset' ? 'var(--c-danger)' : d.rejects > 6 ? 'var(--c-warn)' : 'var(--c-text)');
    const done = !!data[data.length - 1].mean && (beat.id === 'end' || idx === data.length - 1);
    // LED: fast blink 150 ms while calibrating; ready pulse 60 ms every 2 s
    const ledOn = done ? (tSim % 2000) < 60 || beat.id !== 'end' : Math.floor(d.t / 150) % 2 === 0;
    attr(led, { fill: ledOn ? '#2f9e44' : 'var(--c-surface-2)' });
    ledTxt.textContent = done ? 'chớp ngắn: sẵn sàng' : 'nháy nhanh 150 ms';
    // scatter: last 30 samples relative to the running mean
    scat.innerHTML = '';
    const from = Math.max(0, idx - 30);
    for (let k = from; k <= idx; k++) {
      const q = data[k]; if (q.meanX == null) continue;
      const dx = clamp((q.x - (q.meanX)) * SS, -125, 125), dy = clamp((q.y - q.meanY) * SS, -115, 115);
      const bad = q.res === 'reject' || q.res === 'reset';
      scat.append(s('circle', { cx: SX + dx, cy: SY - dy, r: k === idx ? 6 : 4, fill: bad ? 'var(--c-danger)' : 'var(--viz-y)', opacity: 0.25 + 0.75 * ((k - from) / 30), stroke: k === idx ? 'var(--c-text)' : 'none' }));
    }
    meanTxt.textContent = d.meanX == null ? 'chưa có mẫu' : `trung bình x = ${fmt(d.meanX, 3)}, y = ${fmt(d.meanY, 3)}`;
    const m = data[data.length - 1].mean;
    fCard.lastChild.textContent = done && m ? `baseline = atan2(meanX, meanZ) = atan2(${fmt(m.x, 2)}; ${fmt(m.z, 2)}) = ${signed(Math.atan2(m.x, m.z) / DEG, 1)}°` : 'đang lấy mẫu… (baseline = atan2(meanX, meanZ))';
  };

  let tl = null, hd = null;
  const rebuild = (tremor) => {
    data = build(tremor); beats = makeBeats();
    if (!tl) return;
    tl.pause(); tl.setBeats(beats); tl.T = 0; tl._emit('rebuild'); tl.render(); f.setCaption(beats[0].caption);
  };
  rebuild(P.tremor);
  tl = new Timeline({ beats, render, ctx });
  hd = timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('collecting') });
  return hd;
}
