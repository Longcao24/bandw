// gesture-state-machine: the simplified 5-state model, driven sample-by-sample by the detector port.
import { frame, s, h, attr, arm3d, fmt, signed, clamp, lerp, easeOut, arrowMarker, Timeline, timelineHandle, codeView, isReduced } from './_shared.js';
import { presetTrace, segments, uniqueIds, rowAt, C, COMMANDS } from './_model.js';

export const meta = {
  id: 'gesture-state-machine',
  title: 'Máy trạng thái nhận dạng cử chỉ',
  timeline: true,
  checkpoints: ['neutral', 'armed', 'candidate', 'emit', 'cooldown', 'wait-neutral', 'neutral2', 'armed2', 'end'],
  hotspots: [
    { id: 'neutral', label: 'Chờ trung tính' }, { id: 'armed', label: 'Sẵn sàng' }, { id: 'candidate', label: 'Đang giữ' },
    { id: 'emit', label: 'Phát lệnh' }, { id: 'cooldown', label: 'Nghỉ 650 ms' },
  ],
  defaults: { scenario: 'water', showCode: true, showTimers: true },
};

const SCEN = {
  water: { preset: 'water', name: 'Nghiêng trái giữ 0,9 giây', chart: 'roll', cmd: 'WATER' },
  food: { preset: 'food', name: 'Nghiêng phải giữ 0,9 giây', chart: 'roll', cmd: 'FOOD' },
  help: { preset: 'help', name: 'Nhấp cẳng tay 2 lần', chart: 'pitch', cmd: 'HELP' },
  shake: { preset: 'no', name: 'Lắc cổ tay 3 pha', chart: 'gy', cmd: 'NO' },
  tap: { preset: 'yes', name: 'Gõ 2 lần lên vòng tay', chart: 'mag', cmd: 'YES' },
  'held-no-repeat': { preset: 'held-no-repeat', name: 'Nghiêng trái, giữ 2,4 giây', chart: 'roll', cmd: 'WATER' },
  flick: { preset: 'flick', name: 'Nghiêng trái quá ngắn', chart: 'roll', cmd: 'WATER' },
};

// "Mã rút gọn từ GestureDetector.h" (simplified, same names as the firmware)
const CODE = `stirRun = speed > TAP_STILL_DPS ? stirRun + 1 : 0; // 50 °/s
if (stirRun >= 2) lastStir = now;          // 2 mẫu liền = tay cử động
if (cooling && now - lastEmission >= COOLDOWN_MS) cooling = false;
if (!armed) {
  bool neutral = !cooling && rest && speed < 40;
  if (neutral && now - neutralAt >= NEUTRAL_MS) armed = true;
  return Gesture::None;
}
if (sustained && sign != shakeSign) ++shakePulses; // |gy| > 100, 2 mẫu
if (shakePulses >= 3) return emit(Gesture::No, now);
if (doubleTap && rest && now - lastStir >= TAP_QUIET_BEFORE_MS) tapPending = true;
if (tapPending && now - tapAt >= TAP_CONFIRM_MS && rest)
  return emit(Gesture::Yes, now);
if (dipDir && pitch < PITCH_EXIT_DEG && now - dipStart <= DIP_MAX_MS) ++dips;
if (dips >= 2) return emit(Gesture::Help, now);  // trong HELP_WINDOW_MS
if (now - lastMotion < 150) { candidate = 0; return Gesture::None; }
int direction = roll > TILT_ENTER_DEG ? (filtered < 0 ? -1 : 1) : 0;
if (!direction) { candidate = 0; return Gesture::None; }
if (candidate != direction) { candidate = direction; candidateAt = now; }
if (now - candidateAt >= HOLD_MS) return emit(...);
return Gesture::None;`;
const linesFor = (r) => {
  if (r.state === 'EMIT') return r.path === 'shake' ? [9, 10] : r.path === 'tap' ? [11, 12, 13] : r.path === 'help' ? [14, 15] : [20];
  if (r.state === 'COOLDOWN') return [3, 4, 5, 7];
  if (r.state === 'NEUTRAL') return r.neutralTiming ? [4, 5, 6, 7] : [4, 5, 7];
  if (r.tap) return [1, 2, 11];
  if (r.path === 'settle') return r.tapPending ? [12, 16] : r.dipDir || r.dips ? [14, 15, 16] : [16];
  if (r.state === 'CANDIDATE') return [17, 19, 20, 21];
  if (r.dipDir || r.dips) return [14, 15, 17, 18];
  return r.shakePulses ? [9, 10, 17, 18] : [17, 18];
};

const NODES = {
  NEUTRAL: { id: 'neutral', x: 14, y: 20, label: 'Chờ trung tính', sub: '!armed' },
  ARMED: { id: 'armed', x: 246, y: 20, label: 'Sẵn sàng', sub: 'armed' },
  CANDIDATE: { id: 'candidate', x: 246, y: 171, label: 'Đang giữ', sub: 'candidate ≠ 0' },
  EMIT: { id: 'emit', x: 246, y: 322, label: 'Phát lệnh', sub: 'emit()' },
  COOLDOWN: { id: 'cooldown', x: 14, y: 322, label: 'Nghỉ 650 ms', sub: 'cooling' },
};
const NW = 140, NH = 58;

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const sc = SCEN[P.scenario] || SCEN.water;
  const tr = presetTrace(sc.preset);
  const rows = tr.rows;
  const isHelp = sc.cmd === 'HELP';
  // Phones: the two panes stack and each is scaled to ~300px, so use larger SVG fonts to stay ≥ 12px on screen.
  const narrow = (el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)) < 520;
  const FS = narrow ? { title: 17, edge: 16, lh: 18, node: 17, sub: 14, chart: 15, read: 17, time: 15, tick: 13 }
    : { title: 15, edge: 13, lh: 15, node: 16, sub: 12.5, chart: 13, read: 15, time: 14, tick: 11 };
  const HOLD = C.HOLD_MS; // WATER/FOOD hold; HELP counts two quick dips instead (DIP_MAX_MS / HELP_WINDOW_MS)

  const f = frame(el, {
    id: meta.id, title: meta.title, side: P.showCode, panes: [[250, 400], [400, 400]],
    alt: `Kịch bản: ${sc.name}. Năm trạng thái nối thành vòng: Chờ trung tính → Sẵn sàng → Đang giữ → Phát lệnh → Nghỉ 650 ms → quay lại Chờ trung tính. Đây là mô hình đơn giản hoá của mã thật (dùng các cờ armed, candidate, cooling).`,
  });
  const [svgA, svgB] = f.svgs;
  const defsB = f.defsAll[1];

  // ---------- wrist pane ----------
  svgA.append(s('text', { x: 125, y: 26, 'text-anchor': 'middle', 'font-size': FS.title, 'font-weight': 700 }, sc.name));
  const armG = s('g'); svgA.append(armG);
  const arm = arm3d(armG, f.defsAll[0], { yaw: -24, elev: 34, scale: 40, cx: 132, cy: 142, persp: 16 });
  const ripples = s('g'); svgA.append(ripples);
  const rp = [0, 1].map(() => ripples.appendChild(s('circle', { r: 10, fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 3, opacity: 0 })));
  const shakeArrows = s('text', { x: 125, y: 60, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: 'var(--c-primary)', opacity: 0 }, '↶  ↷');
  svgA.append(shakeArrows);
  // mini chart
  const CH = { x: 16, y: 226, w: 218, h: 96 };
  const chartKey = sc.chart;
  const val = (r) => chartKey === 'roll' ? r.filtered : chartKey === 'pitch' ? r.filteredPitch : chartKey === 'gy' ? r.gy : r.mag;
  const range = chartKey === 'gy' ? [-260, 260] : chartKey === 'mag' ? [0.6, 1.4] : chartKey === 'pitch' ? [-10, 50] : [-50, 50];
  const yOf = (v) => CH.y + CH.h - ((clamp(v, range[0], range[1]) - range[0]) / (range[1] - range[0])) * CH.h;
  const xOf = (t) => CH.x + ((t - tr.t0) / (tr.t1 - tr.t0)) * CH.w;
  const chart = s('g');
  chart.append(s('rect', { x: CH.x, y: CH.y, width: CH.w, height: CH.h, rx: 6, class: 'panel-bg' }));
  const hline = (v, cls, lbl) => { chart.append(s('line', { x1: CH.x, x2: CH.x + CH.w, y1: yOf(v), y2: yOf(v), class: cls })); if (lbl) chart.append(s('text', { x: CH.x + CH.w - 3, y: yOf(v) - 3, 'text-anchor': 'end', 'font-size': FS.tick, class: 't-muted' }, lbl)); };
  if (chartKey === 'roll') { chart.append(s('rect', { x: CH.x, width: CH.w, y: yOf(12), height: yOf(-12) - yOf(12), class: 'band-neutral' })); hline(22, 'line-enter', '22°'); hline(-22, 'line-enter'); hline(12, 'line-exit'); hline(-12, 'line-exit'); }
  if (chartKey === 'pitch') { chart.append(s('rect', { x: CH.x, width: CH.w, y: yOf(12), height: yOf(-10) - yOf(12), class: 'band-neutral' })); hline(25, 'line-enter', '25°'); hline(12, 'line-exit', '12°'); }
  if (chartKey === 'gy') { hline(100, 'line-enter', '+100'); hline(-100, 'line-enter', '−100'); hline(0, 'grid-line'); }
  if (chartKey === 'mag') { hline(1, 'grid-line', '1 g'); }
  const all = rows.map((r) => [xOf(r.t), yOf(val(r))]);
  chart.append(s('polyline', { points: all.map((p) => p.join(',')).join(' '), fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 2 }));
  const live = s('polyline', { fill: 'none', stroke: chartKey === 'gy' ? 'var(--viz-y)' : chartKey === 'pitch' ? 'var(--viz-y)' : 'var(--viz-x)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  const cursor = s('line', { y1: CH.y, y2: CH.y + CH.h, stroke: 'var(--c-text)', 'stroke-width': 1.5 });
  chart.append(live, cursor);
  const chartLbl = { roll: 'góc nghiêng đã lọc (°)', pitch: 'góc gập đã lọc (°)', gy: 'tốc độ quay gy (°/s)', mag: 'độ lớn gia tốc |a| (g)' }[chartKey];
  chart.append(s('text', { x: CH.x, y: CH.y - 6, 'font-size': FS.chart, class: 't-muted', 'font-weight': 600 }, chartLbl));
  svgA.append(chart);
  const readA = s('text', { x: 125, y: 350, 'text-anchor': 'middle', 'font-size': FS.read, 'font-weight': 700, class: 'bw-mono' });
  const timeA = s('text', { x: 125, y: 378, 'text-anchor': 'middle', 'font-size': FS.time, class: 't-muted' });
  svgA.append(readA, timeA);

  // ---------- graph pane ----------
  const mk = arrowMarker(defsB, 'var(--c-muted)', 'sm');
  const mkOn = arrowMarker(defsB, 'var(--c-primary)', 'smon');
  const edges = {};
  const edge = (key, d, lbl, lx, ly, anchor = 'middle') => {
    const p = s('path', { d, class: 'edge', 'marker-end': mk });
    const t = s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': FS.edge, class: 't-muted', 'font-weight': 600 });
    lbl.split('\n').forEach((ln, i) => t.append(s('tspan', { x: lx, dy: i ? FS.lh : 0 }, ln)));
    svgB.append(p, t); edges[key] = { p, t };
  };
  edge('NEUTRAL>ARMED', 'M154,49 L240,49', 'yên 200 ms', 197, 84);
  edge('ARMED>CANDIDATE', 'M276,78 L276,165', 'vượt 22°', 268, 126, 'end');
  edge('CANDIDATE>ARMED', 'M356,171 L356,84', 'thả\nsớm', 364, 120, 'start');
  edge('CANDIDATE>EMIT', 'M276,229 L276,316', `giữ đủ\n${HOLD} ms`, 268, 266, 'end');
  // Upper-left of the curve (curve x ≥ 198 for y < 160), well above the cooldown label (y ≈ 250).
  edge('ARMED>EMIT', 'M246,70 C170,130 170,270 246,330', 'lắc 3 pha,\ngõ 2 lần,\nnhấp 2 lần', 185, 122, 'end');
  edge('EMIT>COOLDOWN', 'M246,351 L160,351', 'ngay', 203, 342);
  edge('COOLDOWN>NEUTRAL', 'M60,322 L60,84', 'hết\n650 ms', 68, 250, 'start');
  const nodes = {};
  for (const [k, n] of Object.entries(NODES)) {
    const g = s('g', { 'data-hotspot': n.id, 'data-label': n.label });
    const r = s('rect', { x: n.x, y: n.y, width: NW, height: NH, rx: 14, class: 'node' });
    const t1 = s('text', { x: n.x + NW / 2, y: n.y + 24, 'text-anchor': 'middle', 'font-size': FS.node, 'font-weight': 700 }, n.label);
    const t2 = s('text', { x: n.x + NW / 2, y: n.y + 43, 'text-anchor': 'middle', 'font-size': FS.sub, class: 't-muted bw-mono' }, n.sub);
    const barBg = s('rect', { x: n.x + 12, y: n.y + NH - 9, width: NW - 24, height: 5, rx: 2.5, fill: 'var(--c-surface-2)', opacity: P.showTimers ? 1 : 0 });
    const bar = s('rect', { x: n.x + 12, y: n.y + NH - 9, width: 0, height: 5, rx: 2.5, fill: 'var(--c-primary)', opacity: P.showTimers ? 1 : 0 });
    g.append(r, t1, t2, barBg, bar); svgB.append(g);
    nodes[k] = { g, r, t2, bar, n };
  }
  const token = s('circle', { r: 9, fill: 'var(--c-primary)', stroke: 'var(--c-surface)', 'stroke-width': 3 });
  svgB.append(token);
  const burst = s('g', { opacity: 0 });
  const burstChip = s('rect', { x: 240, y: 288, width: 152, height: 30, rx: 15, stroke: 'rgba(0,0,0,.2)' });
  const burstTxt = s('text', { x: 316, y: 308, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 't-on-light bw-mono' });
  burst.append(burstChip, burstTxt); svgB.append(burst);
  const modelNote = s('text', { x: 200, y: 396, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }, 'Mô hình đơn giản hoá · mã thật dùng cờ armed / candidate / cooling');
  svgB.append(modelNote);

  // ---------- code ----------
  let code = null;
  if (P.showCode) { code = codeView(CODE, { lang: 'cpp', label: 'Mã rút gọn từ GestureDetector.h' }); f.side.append(code.el); }

  // ---------- beats ----------
  const segs = segments(rows, (r) => (r.state === 'NEUTRAL' && !r.rest && r.i > 15 ? 'WAIT' : r.state), { keep: (k) => k === 'EMIT' });
  const base = { NEUTRAL: 'neutral', ARMED: 'armed', CANDIDATE: 'candidate', EMIT: 'emit', COOLDOWN: 'cooldown', WAIT: 'wait-neutral' };
  const ids = uniqueIds(segs.map((g) => base[g.key]));
  const cap = (g, id) => {
    const first = !/\d$/.test(id);
    switch (g.key) {
      case 'NEUTRAL': return first ? 'Vừa hiệu chuẩn xong: tay phải yên ở trung tính đủ 200 ms thì mới "sẵn sàng".' : 'Tay đã về trung tính: đếm lại 200 ms để sẵn sàng cho lệnh mới.';
      case 'ARMED':
        if (!first) return P.scenario === 'flick' ? 'Thả tay trước khi đủ 250 ms: bộ đếm giữ về 0, không phát lệnh nào.' : 'Sẵn sàng trở lại: lệnh tiếp theo có thể bắt đầu.';
        if (P.scenario === 'shake') return 'Sẵn sàng. Lắc: mỗi lần gy vượt ±100 °/s (2 mẫu liền, đổi chiều) là một pha.';
        if (P.scenario === 'tap') return 'Sẵn sàng. Chip IMU báo gõ đôi; firmware chỉ nhận nếu 300 ms trước đó tay không xoay quá 50 °/s (2 mẫu liền), rồi chờ thêm 150 ms xem tay có yên không.';
        if (isHelp) return 'Sẵn sàng. Mỗi lần góc gập vượt 25° rồi về dưới 12° trong 700 ms là một lần nhấp; đủ 2 lần cùng chiều trong 2 giây là HELP.';
        return 'Sẵn sàng. Tay nghiêng dần; sau khi ngừng chuyển động 150 ms mới xét ngưỡng 22°.';
      case 'CANDIDATE': return P.scenario === 'flick' ? 'Vượt 22° nên bắt đầu đếm giờ giữ… nhưng tay quay về quá sớm.' : `Góc đã lọc vượt ngưỡng: ghi candidateAt và đếm thời gian giữ (cần ${HOLD} ms).`;
      case 'EMIT': return `Phát lệnh ${sc.cmd}! emit() đặt cooling = true, armed = false và xoá mọi bộ đếm.`;
      case 'COOLDOWN': return 'Nghỉ 650 ms: trong lúc này không phát lệnh nào.';
      case 'WAIT': return P.scenario === 'held-no-repeat' ? 'Hết nghỉ nhưng tay vẫn nghiêng: chưa về trung tính nên KHÔNG lặp lại lệnh.' : 'Hết nghỉ: chờ tay quay về trung tính (dưới 12°).';
      default: return '';
    }
  };
  const SLOW = 2.4;
  const beats = segs.map((g, k) => ({
    id: ids[k], key: g.key, seg: g, caption: cap(g, ids[k]),
    dur: g.key === 'EMIT' ? 1500 : clamp((g.t1 - g.t0 + 20) * SLOW, 1300, 6000),
    prevKey: k ? segs[k - 1].key : null,
  }));
  beats.push({ id: 'end', key: 'END', seg: segs[segs.length - 1], dur: 600, caption: P.scenario === 'held-no-repeat' ? 'Kết quả: giữ tay 2,4 giây chỉ phát đúng 1 lệnh WATER.' : P.scenario === 'flick' ? 'Kết quả: không phát lệnh nào vì giữ chưa đủ 250 ms.' : `Kết quả: phát đúng 1 lệnh ${sc.cmd}, rồi vòng tay sẵn sàng trở lại.`, prevKey: null });

  const stateOf = (key) => (key === 'WAIT' ? 'NEUTRAL' : key);
  const edgeKey = (from, to) => `${stateOf(from)}>${stateOf(to)}`;

  const render = ({ beat, t01 }) => {
    const g = beat.seg;
    const simT = beat.key === 'EMIT' || beat.key === 'END' ? g.t1 : lerp(g.t0, g.t1 + 20, t01);
    const i = rowAt(rows, simT), r = rows[i];
    // wrist
    arm.set(r.roll, r.pitch);
    const tapRows = rows.filter((q) => q.tap);
    const tapT = tapRows.length ? tapRows[0].t : null;
    rp.forEach((c, k) => {
      if (tapT == null) return;
      const t = tapT - (k === 0 ? 260 : 0);
      const age = simT - t;
      const on = age >= 0 && age < 300;
      const [bx, by] = arm.boardScreen;
      attr(c, { cx: bx, cy: by, r: on ? 10 + age / 8 : 0, opacity: on ? 1 - age / 300 : 0 });
    });
    shakeArrows.setAttribute('opacity', r.tag === 'shake' ? 1 : 0);
    // chart
    const upto = rows.slice(0, i + 1).map((q) => `${xOf(q.t).toFixed(1)},${yOf(val(q)).toFixed(1)}`).join(' ');
    live.setAttribute('points', upto);
    attr(cursor, { x1: xOf(simT), x2: xOf(simT) });
    readA.textContent = chartKey === 'pitch' ? `gập ${signed(r.filteredPitch)}° · nghiêng ${signed(r.filtered)}°` : chartKey === 'gy' ? `gy = ${signed(r.gy)} °/s` : chartKey === 'mag' ? `|a| = ${fmt(r.mag, 2)} g` : `nghiêng ${signed(r.filtered)}° (đã lọc)`;
    timeA.textContent = `t = ${Math.round(simT - tr.t0)} ms`;
    // nodes
    const st = beat.key === 'END' ? r.state : stateOf(beat.key);
    for (const [k, n] of Object.entries(nodes)) {
      n.r.setAttribute('class', `node${k === st ? (k === 'EMIT' ? ' is-active is-emit' : k === 'COOLDOWN' ? ' is-active is-cool' : ' is-active') : ''}`);
      let p = 0, sub = n.n.sub;
      if (k === 'NEUTRAL' && st === 'NEUTRAL') { p = r.neutralTiming ? (r.t - r.neutralAt) / C.NEUTRAL_MS : 0; if (P.showTimers) sub = r.neutralTiming ? `${Math.min(200, r.t - r.neutralAt)}/200 ms` : 'chưa yên'; }
      if (k === 'CANDIDATE' && st === 'CANDIDATE') { p = (r.t - r.candidateAt) / HOLD; if (P.showTimers) sub = `${Math.min(HOLD, r.t - r.candidateAt)}/${HOLD} ms`; }
      if (k === 'COOLDOWN' && st === 'COOLDOWN') { p = (r.t - r.lastEmission) / C.COOLDOWN_MS; if (P.showTimers) sub = `${Math.min(650, r.t - r.lastEmission)}/650 ms`; }
      if (k === 'ARMED' && st === 'ARMED') {
        if (r.shakePulses) { p = r.shakePulses / 3; sub = `lắc ${r.shakePulses}/3`; }
        else if (r.dipDir || r.dips) { p = r.dips / 2; sub = `nhấp ${r.dips}/2${r.dipDir ? ' …' : ''}`; }
        else if (r.tapPending) { p = (r.t - r.tapAt) / C.TAP_CONFIRM_MS; sub = `gõ ${Math.min(150, r.t - r.tapAt)}/150 ms`; }
        else if (r.path === 'settle') sub = 'chờ lắng 150 ms';
      }
      if (k === 'EMIT' && st === 'EMIT') { p = 1; }
      n.bar.setAttribute('width', ((NW - 24) * clamp(p, 0, 1)).toFixed(1));
      n.t2.textContent = sub;
    }
    // edges
    Object.values(edges).forEach((e) => { e.p.setAttribute('class', 'edge'); e.p.setAttribute('marker-end', mk); e.t.setAttribute('class', 't-muted'); });
    let ek = beat.prevKey ? edgeKey(beat.prevKey, beat.key) : null;
    if (ek === 'NEUTRAL>NEUTRAL') ek = null;
    const e = ek && edges[ek];
    if (e) { e.p.setAttribute('class', 'edge is-active'); e.p.setAttribute('marker-end', mkOn); e.t.removeAttribute('class'); }
    // token
    const nodeC = (k) => { const n = NODES[k]; return [n.x + NW - 10, n.y + 10]; };
    let [tx, ty] = nodeC(st);
    if (e && t01 < 0.35) {
      const L = e.p.getTotalLength ? e.p.getTotalLength() : 0;
      if (L) { const pt = e.p.getPointAtLength(L * easeOut(t01 / 0.35)); tx = pt.x; ty = pt.y; }
    }
    attr(token, { cx: tx, cy: ty });
    // burst
    const showBurst = beat.key === 'EMIT';
    burst.setAttribute('opacity', showBurst ? 1 : 0);
    if (showBurst) { burstChip.setAttribute('fill', COMMANDS[sc.cmd].color); burstTxt.textContent = `📡 ${sc.cmd}`; attr(burst, { transform: `translate(0,${-10 * easeOut(t01)})` }); }
    if (code) code.highlight(beat.key === 'END' ? [] : linesFor(r), r.state === 'EMIT' ? 'ok' : 'run');
  };

  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('candidate') - 10 });
}
