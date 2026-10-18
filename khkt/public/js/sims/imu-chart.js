// imu-chart: scrolling multi-trace (roll, pitch, gy, |a|) from the detector port, with thresholds and event markers.
import { frame, s, h, attr, fmt, signed, clamp, lerp, svgPoint, Timeline, timelineHandle, isReduced } from './_shared.js';
import { presetTrace, rowAt, COMMANDS } from './_model.js';

export const meta = {
  id: 'imu-chart',
  title: 'Biểu đồ cảm biến theo thời gian',
  timeline: true,
  checkpoints: ['before', 'event', 'after', 'event-water', 'event-food', 'event-no', 'event-yes', 'event-help', 'end'],
  hotspots: [{ id: 'trace-roll', label: 'Đường góc nghiêng' }, { id: 'trace-pitch', label: 'Đường góc gập' }, { id: 'trace-gy', label: 'Đường tốc độ quay gy' }, { id: 'trace-mag', label: 'Đường độ lớn gia tốc' }, { id: 'marker', label: 'Dấu lệnh được phát' }],
  defaults: { signals: ['roll', 'pitch', 'gy', 'mag'], preset: 'all', thresholds: true, windowMs: 4000, readout: true },
};

const LANES = {
  roll: { label: 'Góc nghiêng (đã lọc)', unit: '°', get: (r) => r.filtered, lo: -50, hi: 50, color: 'var(--viz-x)', lines: [[22, 'enter'], [-22, 'enter'], [12, 'exit'], [-12, 'exit']], band: [-12, 12], d: 1 },
  pitch: { label: 'Góc gập (đã lọc)', unit: '°', get: (r) => r.filteredPitch, lo: -15, hi: 50, color: 'var(--viz-y)', lines: [[25, 'enter'], [12, 'exit']], band: [-12, 12], d: 1 },
  gy: { label: 'Tốc độ quay gy', unit: ' °/s', get: (r) => r.gy, lo: -260, hi: 260, color: 'var(--viz-z)', lines: [[100, 'enter'], [-100, 'enter']], band: [-40, 40], d: 0 },
  mag: { label: 'Độ lớn gia tốc |a|', unit: ' g', get: (r) => r.mag, lo: 0.6, hi: 1.45, color: 'var(--viz-g)', lines: [[0.85, 'exit'], [1.15, 'exit']], band: [0.85, 1.15], d: 2 },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  const keys = (Array.isArray(P.signals) ? P.signals : meta.defaults.signals).filter((k) => LANES[k]);
  const preset = ['water', 'food', 'no', 'yes', 'help', 'help-short', 'walk', 'rest', 'all'].includes(P.preset) ? P.preset : 'all';
  const tr = presetTrace(preset);
  const rows = tr.rows;
  // Phones get a narrower viewBox (≈ 1:1 with CSS pixels) so lane titles and ticks stay ≥ 12px.
  const narrow = (el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)) < 520;
  const FS = narrow ? { lbl: 14, tick: 12, t: 13, badge: 13 } : { lbl: 12.5, tick: 11, t: 12, badge: 12 };
  const VW = narrow ? 320 : 480, X0 = narrow ? 40 : 64, X1 = VW - 8, LH = narrow ? 84 : 76;
  const TOP = 30; // top gutter: command badges live here, above the lanes, so they never cover a lane title
  const H = TOP + keys.length * (LH + 12) + 26;
  const f = frame(el, {
    id: meta.id, title: meta.title, viewBox: [VW, H],
    alt: `Biểu đồ ${keys.map((k) => LANES[k].label).join(', ')} theo thời gian, có đường ngưỡng. Dấu màu đánh dấu lúc vòng tay phát lệnh.`,
  });
  const { svg, defs } = f;
  const clipId = `clip-${Math.random().toString(36).slice(2, 8)}`;
  defs.append(s('clipPath', { id: clipId }, s('rect', { x: X0, y: 0, width: X1 - X0, height: H })));
  const win = reduced ? (tr.t1 - tr.t0) : clamp(P.windowMs, 1000, 20000);
  const titles = []; // lane titles are drawn above the event markers (with a halo) so a marker line never hides them
  const lanes = keys.map((k, n) => {
    const L = LANES[k], y0 = TOP + n * (LH + 12), y1 = y0 + LH;
    const yv = (v) => y1 - ((clamp(v, L.lo, L.hi) - L.lo) / (L.hi - L.lo)) * LH;
    svg.append(s('rect', { x: X0, y: y0, width: X1 - X0, height: LH, class: 'panel-bg' }));
    if (P.thresholds) {
      svg.append(s('rect', { x: X0, y: yv(L.band[1]), width: X1 - X0, height: yv(L.band[0]) - yv(L.band[1]), class: 'band-neutral' }));
      L.lines.forEach(([v, c]) => svg.append(s('line', { x1: X0, x2: X1, y1: yv(v), y2: yv(v), class: c === 'enter' ? 'line-enter' : 'line-exit', 'stroke-width': 1.6 })));
    }
    titles.push(s('text', { x: X0 + 6, y: y0 + 15, 'font-size': FS.lbl, 'font-weight': 700, fill: L.color, stroke: 'var(--c-surface, #fff)', 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, L.label));
    const tk = [L.lines[0]?.[0], L.lines.find((x) => x[0] < 0 || x[0] < L.lines[0][0])?.[0]].filter((v) => v != null);
    tk.forEach((v) => svg.append(s('text', { x: X0 - 4, y: yv(v) + 4, 'text-anchor': 'end', 'font-size': FS.tick, class: 't-muted' }, `${fmt(v, L.d === 2 ? 2 : 0)}`)));
    const g = s('g', { 'data-hotspot': `trace-${k}`, 'data-label': meta.hotspots.find((x) => x.id === `trace-${k}`).label, 'clip-path': `url(#${clipId})` });
    const hit = s('polyline', { fill: 'none', stroke: 'transparent', 'stroke-width': 16 });
    const line = s('polyline', { fill: 'none', stroke: L.color, 'stroke-width': 2.4, 'stroke-linejoin': 'round' });
    g.append(hit, line); svg.append(g);
    return { k, L, y0, y1, yv, hit, line };
  });
  const markG = s('g', { 'data-hotspot': 'marker', 'data-label': 'Dấu lệnh được phát', 'clip-path': `url(#${clipId})` }); svg.append(markG);
  svg.append(...titles);
  const cursor = s('line', { y1: TOP, y2: H - 26, stroke: 'var(--c-text)', 'stroke-width': 1.5 });
  const now = s('line', { y1: TOP, y2: H - 26, stroke: 'var(--c-primary)', 'stroke-width': 2, 'stroke-dasharray': '4 3' });
  const tLbl = s('text', { y: H - 8, 'text-anchor': 'middle', 'font-size': FS.t, class: 't-muted' });
  svg.append(now, cursor, tLbl, s('text', { x: X1, y: H - 8, 'text-anchor': 'end', 'font-size': FS.t, class: 't-muted' }, 'thời gian →'));
  const card = h('div', { class: 'bw-card bw-card--formula' }, h('span', { class: 'bw-card__k' }, 'Đọc giá trị (chạm/di chuột lên biểu đồ)'), h('span', { class: 'bw-card__v' }, '—'));
  if (P.readout) f.readout.append(card);

  // beats
  const ev = tr.events;
  const beats = [];
  if (preset === 'all') {
    let t0 = tr.t0;
    ev.forEach((e) => { beats.push({ id: `event-${e.command.toLowerCase()}`, t0, t1: e.t + 500, caption: `${COMMANDS[e.command].gesture} → vòng tay phát ${e.command}. Xem đường nào thay đổi rõ nhất.` }); t0 = e.t + 500; });
    beats.push({ id: 'end', t0, t1: tr.t1, caption: 'Mỗi cử chỉ để lại "dấu vân tay" riêng trên các đường.' });
  } else if (ev.length) {
    const e = ev[0];
    beats.push({ id: 'before', t0: tr.t0, t1: e.t - 300, caption: 'Trước cử chỉ: các đường nằm trong vùng trung tính.' });
    beats.push({ id: 'event', t0: e.t - 300, t1: e.t + 200, caption: `Đúng lúc này vòng tay phát ${e.command}.` });
    beats.push({ id: 'after', t0: e.t + 200, t1: tr.t1 - 100, caption: 'Sau đó vòng tay nghỉ 650 ms và chờ tay về trung tính.' });
    beats.push({ id: 'end', t0: tr.t1 - 100, t1: tr.t1, caption: 'Dừng lại và chạm lên biểu đồ để đọc giá trị.' });
  } else {
    const short = preset === 'help-short';
    const mid = short ? (rows[rows.findIndex((r, i) => i > 60 && r.tag === 'move' && r.pitch > 5)] || rows[rows.length >> 1]).t - 200 : (tr.t0 + tr.t1) / 2;
    beats.push({ id: 'before', t0: tr.t0, t1: mid, caption: short ? 'Nhấp cẳng tay 1 lần: góc gập vượt 25° rồi về dưới 12° ngay… nhưng chỉ 1 lần, hết 2 giây thì bộ đếm về 0.' : preset === 'walk' ? 'Đi bộ: |a| dao động mạnh và tay lắc nhẹ…' : 'Tay nghỉ, rung nhẹ…' });
    beats.push({ id: 'after', t0: mid, t1: tr.t1 - 100, caption: short ? 'Đặt cẳng tay lên đùi: góc gập vượt 25° rồi nằm yên đó, quá 700 ms nên không phải "nhấp". Không phát HELP.' : '…nhưng không đường nào giữ vượt ngưỡng đủ lâu, nên không phát lệnh.' });
    beats.push({ id: 'end', t0: tr.t1 - 100, t1: tr.t1, caption: 'Không có lệnh nhầm trong đoạn này.' });
  }
  beats.forEach((b) => { b.dur = clamp((b.t1 - b.t0) * 1.6, 900, 7000); });

  let simNow = tr.t0, hover = null;
  const base = () => (reduced ? tr.t0 : simNow - win);
  const xOf = (t) => X0 + ((t - base()) / win) * (X1 - X0);
  const draw = () => {
    const iNow = rowAt(rows, simNow);
    const from = rowAt(rows, simNow - win - 40);
    const vis = rows.slice(from, iNow + 1);
    lanes.forEach((ln) => { const p = vis.map((r) => `${xOf(r.t).toFixed(1)},${ln.yv(ln.L.get(r)).toFixed(1)}`).join(' '); ln.line.setAttribute('points', p); ln.hit.setAttribute('points', p); });
    markG.innerHTML = '';
    ev.filter((e) => e.t <= simNow && e.t >= base()).forEach((e) => {
      const x = xOf(e.t);
      markG.append(s('line', { x1: x, x2: x, y1: TOP - 6, y2: H - 26, stroke: 'var(--c-success)', 'stroke-width': 2 }));
      const w = e.command.length * FS.badge * 0.68 + 16;
      const bx = clamp(x, X0 + w / 2 + 1, X1 - w / 2 - 1); // keep the whole badge inside the plot (no 'FO' clipping)
      markG.append(s('rect', { x: bx - w / 2, y: 4, width: w, height: 20, rx: 10, fill: COMMANDS[e.command].color, stroke: 'rgba(0,0,0,.2)' }), s('text', { x: bx, y: 18, 'text-anchor': 'middle', 'font-size': FS.badge, 'font-weight': 700, class: 't-on-light bw-mono' }, e.command));
    });
    attr(now, { x1: xOf(simNow), x2: xOf(simNow) });
    const tq = hover ?? simNow;
    const r = rows[rowAt(rows, tq)];
    attr(cursor, { x1: xOf(r.t), x2: xOf(r.t), opacity: hover != null ? 1 : 0 });
    attr(tLbl, { x: clamp(xOf(r.t), X0 + 30, X1 - (narrow ? 110 : 130)) }); tLbl.textContent = `t = ${fmt((r.t - tr.t0) / 1000, 2)} s`;
    card.lastChild.textContent = `t = ${fmt((r.t - tr.t0) / 1000, 2)} s · ` + keys.map((k) => `${k === 'mag' ? '|a|' : k} ${fmt(LANES[k].get(r), LANES[k].d)}${LANES[k].unit}`).join(' · ');
  };
  const onMove = (e) => { const p = svgPoint(svg, e); if (p.x < X0 || p.x > X1) return; hover = clamp(base() + ((p.x - X0) / (X1 - X0)) * win, tr.t0, simNow); draw(); };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointerleave', () => { hover = null; draw(); });
  const render = ({ beat, t01 }) => { simNow = Math.max(tr.t0 + 20, lerp(beat.t0, beat.t1, t01)); hover = null; draw(); };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf(beats[0].id) });
}
