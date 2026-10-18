// tilt-angle: front view of the wrist; gravity split into x/z components; atan2 dial with
// neutral band (±12°) and enter zones (±22°). Verdict comes from the real detector port at 50 Hz.
import { frame, s, h, attr, wristCross, fmt, signed, clamp, ticker, drag, svgPoint, slider, toggle, arrowMarker, sectorPath, staticHandle, isReduced, DEG } from './_shared.js';
import { GestureDetector, poseToAccel, C, COMMANDS, COMMAND_OF } from './_model.js';

export const meta = {
  id: 'tilt-angle',
  title: 'Góc nghiêng và ngưỡng',
  timeline: false,
  checkpoints: [],
  hotspots: [
    { id: 'wrist', label: 'Cổ tay' }, { id: 'x-component', label: 'Thành phần x' }, { id: 'z-component', label: 'Thành phần z' },
    { id: 'enter-zone-left', label: 'Vùng kích hoạt trái' }, { id: 'enter-zone-right', label: 'Vùng kích hoạt phải' }, { id: 'neutral-band', label: 'Dải trung tính' },
  ],
  defaults: { enterDeg: 22, exitDeg: 12, initialDeg: 0, showFormula: true, showComponents: true, showFilter: false },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  const ENTER = P.enterDeg, EXIT = P.exitDeg;
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[330, 400], [310, 400, 330, 0]],
    alt: `Nhìn cổ tay từ phía sau. Mũi tên trọng lực tím hướng xuống; gia tốc kế đo vectơ ngược lại (a = −g, nét đứt hướng lên), chia thành thành phần x (đỏ, dọc trục X hướng về phía trái cổ tay) và z (xanh). Trục nào hướng lên thì đọc số dương. Đồng hồ bên phải có dải trung tính ±${EXIT}° màu xanh lá và vùng kích hoạt ngoài ±${ENTER}°: bên trái là WATER, bên phải là FOOD.`,
  });
  const { svg, defs } = f;
  const svgB = f.svgs[1];

  // ---- left: wrist ----
  const wristG = s('g', { 'data-hotspot': 'wrist', 'data-label': 'Cổ tay' });
  svg.append(wristG);
  const WX = 165, WY = 230;
  const wrist = wristCross(wristG, { cx: WX, cy: WY, r: 70 });
  const vec = s('g'); svg.append(vec);
  const mkG = arrowMarker(defs, 'var(--viz-g)'), mkX = arrowMarker(defs, 'var(--viz-x)'), mkZ = arrowMarker(defs, 'var(--viz-z)');
  const axisX = s('line', { stroke: 'var(--viz-x)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', opacity: 0.7 });
  const axisZ = s('line', { stroke: 'var(--viz-z)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', opacity: 0.7 });
  const gLine = s('line', { stroke: 'var(--viz-g)', 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': mkG });
  const gLbl = s('text', { 'font-size': 18, 'font-weight': 700, fill: 'var(--viz-g)' }, 'g');
  // What the accelerometer reports is the reaction to gravity: a vector of 1 g pointing UP (a = −g).
  // It reads +1 g on whichever axis points up, so x and z are drawn as components of THIS vector.
  const aLine = s('line', { stroke: 'var(--viz-g)', 'stroke-width': 3, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round', 'marker-end': mkG, opacity: 0.85 });
  const aLbl = s('text', { 'font-size': 15, 'font-weight': 700, fill: 'var(--viz-g)', 'text-anchor': 'middle' }, 'a đo được = −g');
  const xLine = s('line', { stroke: 'var(--viz-x)', 'stroke-width': 4, 'stroke-linecap': 'round', 'marker-end': mkX });
  const xLbl = s('text', { 'font-size': 16, 'font-weight': 700, fill: 'var(--viz-x)', 'text-anchor': 'middle' });
  const zLine = s('line', { stroke: 'var(--viz-z)', 'stroke-width': 4, 'stroke-linecap': 'round', 'marker-end': mkZ });
  const zLbl = s('text', { 'font-size': 16, 'font-weight': 700, fill: 'var(--viz-z)' });
  const thArc = s('path', { fill: 'none', stroke: 'var(--c-text)', 'stroke-width': 2 });
  const thLbl = s('text', { 'font-size': 16, 'font-weight': 700, 'text-anchor': 'middle' });
  const xG = s('g', { 'data-hotspot': 'x-component', 'data-label': 'Thành phần x' }, xLine, xLbl);
  const zG = s('g', { 'data-hotspot': 'z-component', 'data-label': 'Thành phần z' }, zLine, zLbl);
  vec.append(axisX, axisZ, gLine, gLbl, aLine, aLbl, thArc, thLbl);
  if (P.showComponents) vec.append(xG, zG);
  svg.append(s('text', { x: 165, y: 34, 'text-anchor': 'middle', 'font-size': 16, class: 't-muted', 'font-weight': 600 }, 'Nhìn từ phía sau cổ tay'));
  const dragHint = s('text', { x: 165, y: 388, 'text-anchor': 'middle', 'font-size': 15, class: 't-muted' }, '↔ Kéo bàn tay để nghiêng');
  svg.append(dragHint);

  // ---- right: dial ----
  const DX = 482, DY = 250, R = 108, K = 1.5; // ±60° on the wrist → ±90° on the dial
  const dial = s('g'); svgB.append(dial);
  const sec = (a0, a1, fill, hs, label) => {
    const p = s('path', { d: sectorPath(DX, DY, R - 34, R, a0 * K, a1 * K), fill, stroke: 'var(--c-surface)', 'stroke-width': 1.5 });
    if (hs) attr(p, { 'data-hotspot': hs, 'data-label': label });
    dial.append(p); return p;
  };
  sec(-60, -ENTER, COMMANDS.WATER.color, 'enter-zone-left', 'Vùng kích hoạt trái');
  sec(-ENTER, -EXIT, 'var(--c-surface-2)');
  const nb = sec(-EXIT, EXIT, 'var(--viz-neutral)', 'neutral-band', 'Dải trung tính');
  nb.setAttribute('stroke', 'var(--viz-y)');
  sec(EXIT, ENTER, 'var(--c-surface-2)');
  sec(ENTER, 60, COMMANDS.FOOD.color, 'enter-zone-right', 'Vùng kích hoạt phải');
  const tick = (a, label, cls) => {
    const r0 = R + 2, r1 = R + 12, x = (r) => DX + r * Math.sin(a * K * DEG), y = (r) => DY - r * Math.cos(a * K * DEG);
    dial.append(s('line', { x1: x(r0), y1: y(r0), x2: x(r1), y2: y(r1), stroke: cls || 'var(--c-muted)', 'stroke-width': 2 }));
    dial.append(s('text', { x: x(R + 28), y: y(R + 28) + 5, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted' }, label));
  };
  [[-60, '−60°'], [-ENTER, `−${ENTER}°`, 'var(--viz-enter)'], [-EXIT, `−${EXIT}°`, 'var(--viz-exit)'], [0, '0°'], [EXIT, `${EXIT}°`, 'var(--viz-exit)'], [ENTER, `${ENTER}°`, 'var(--viz-enter)'], [60, '60°']].forEach((t) => tick(...t));
  dial.append(s('text', { x: DX - 88, y: DY - 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 't-on-light' }, 'WATER'));
  dial.append(s('text', { x: DX + 88, y: DY - 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 't-on-light' }, 'FOOD'));
  dial.append(s('text', { x: DX, y: DY - R + 52, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--viz-y)' }, 'trung tính'));
  const ghost = s('line', { x1: DX, y1: DY, stroke: 'var(--c-muted)', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '6 5', opacity: P.showFilter ? 0.9 : 0 });
  const needle = s('line', { x1: DX, y1: DY, stroke: 'var(--c-text)', 'stroke-width': 5, 'stroke-linecap': 'round' });
  dial.append(ghost, needle, s('circle', { cx: DX, cy: DY, r: 9, fill: 'var(--c-text)' }));
  const dialVal = s('text', { x: DX, y: DY + 44, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 700 });
  const dialSub = s('text', { x: DX, y: DY + 70, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted' }, P.showFilter ? 'kim đậm: góc đo · kim đứt: góc đã lọc' : 'góc nghiêng so với trung tính');
  dial.append(dialVal, dialSub);
  svgB.append(s('text', { x: DX, y: 34, 'text-anchor': 'middle', 'font-size': 16, class: 't-muted', 'font-weight': 600 }, 'Đồng hồ góc nghiêng'));
  const emitG = s('g', { opacity: 0 });
  const emitRect = s('rect', { x: DX - 80, y: 52, width: 160, height: 40, rx: 20, stroke: 'rgba(0,0,0,.2)' });
  const emitTxt = s('text', { x: DX, y: 79, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, class: 't-on-light' });
  emitG.append(emitRect, emitTxt); svgB.append(emitG);

  // ---- readouts ----
  const card = (k, cls = '') => { const v = h('span', { class: 'bw-card__v' }); const c = h('div', { class: `bw-card ${cls}` }, h('span', { class: 'bw-card__k' }, k), v); f.readout.append(c); return { c, v }; };
  const cF = P.showFormula ? card('Công thức trong firmware', 'bw-card--formula') : null;
  const cS = card('Vòng tay đang thấy');
  const sl = slider({ label: 'Góc nghiêng', min: -60, max: 60, step: 1, value: P.initialDeg, unit: '°', fmtFn: (v) => signed(v), onInput: (v) => setAngle(v) });
  f.panel.append(sl.el);
  let showFilter = P.showFilter;
  f.panel.append(toggle({ label: 'Hiện góc đã lọc (α = 0,22)', checked: showFilter, onChange: (v) => { showFilter = v; ghost.setAttribute('opacity', v ? 0.9 : 0); dialSub.textContent = v ? 'kim đậm: góc đo · kim đứt: góc đã lọc' : 'góc nghiêng so với trung tính'; } }).el);

  // ---- detector clock (50 Hz) ----
  const det = new GestureDetector();
  let now = 1000; det.calibrate(0, 0, 1, now - 20);
  let angleDeg = clamp(P.initialDeg, -60, 60), prevSampleAngle = angleDeg, acc = 0, flash = null;
  const sample = () => {
    const rate = (angleDeg - prevSampleAngle) / 0.02; prevSampleAngle = angleDeg;
    const a = poseToAccel(angleDeg, 0, 1);
    const g = det.update(a.x, a.y, a.z, 0, clamp(rate, -400, 400), 0, now, false);
    if (g) { flash = { cmd: COMMAND_OF[g], at: now }; ctx.onEvent?.('gesture', { command: COMMAND_OF[g] }); }
    now += 20;
  };
  // warm-up so the band starts armed at the initial pose (as if it had been worn for a while)
  for (let i = 0; i < 40; i++) { const a0 = angleDeg; angleDeg = 0; prevSampleAngle = 0; sample(); angleDeg = a0; }
  prevSampleAngle = angleDeg;

  const verdict = () => {
    const fl = det.filtered;
    if (flash && now - flash.at < 1200) return { text: `Phát lệnh ${flash.cmd} ✓`, cls: 'is-ok' };
    if (det.cooling || (!det.armed && Math.abs(fl) >= EXIT)) return { text: 'Đã phát: về trung tính để phát tiếp', cls: 'is-warn' };
    if (Math.abs(fl) < EXIT) return { text: det.armed ? 'Trung tính · sẵn sàng' : 'Trung tính · đang chờ 200 ms', cls: '' };
    if (det.candidate === -1) return { text: `Nghiêng trái → WATER (giữ ${Math.min(C.HOLD_MS, now - 20 - det.candidateAt)} ms)`, cls: 'is-ok' };
    if (det.candidate === 1) return { text: `Nghiêng phải → FOOD (giữ ${Math.min(C.HOLD_MS, now - 20 - det.candidateAt)} ms)`, cls: 'is-ok' };
    if (Math.abs(fl) > ENTER) return { text: 'Vượt ngưỡng, đang chờ tay lắng (150 ms)', cls: 'is-warn' };
    return { text: 'Vùng trễ (12°–22°): chưa đủ để kích hoạt', cls: '' };
  };

  const draw = () => {
    wrist.set(angleDeg);
    const [ox, oy] = wrist.boardAt(angleDeg);
    const r = angleDeg * DEG, L = 120;
    // Screen directions of board +X and +Z. +X points to the wrist's LEFT side (from behind), so tilting
    // right lifts +X (x > 0) and tilting left lowers it (x < 0), matching poseToAccel/firmware signs.
    const Xd = [-Math.cos(r), -Math.sin(r)], Zd = [Math.sin(r), -Math.cos(r)];
    attr(axisX, { x1: ox - Xd[0] * 130, y1: oy - Xd[1] * 130, x2: ox + Xd[0] * 130, y2: oy + Xd[1] * 130 });
    const ax = ox, ay = oy - L; // tip of the measured vector a (straight up)
    attr(aLine, { x1: ox, y1: oy, x2: ax, y2: ay });
    attr(axisZ, { x1: ox - Zd[0] * 150, y1: oy - Zd[1] * 150, x2: ox + Zd[0] * 60, y2: oy + Zd[1] * 60 });
    const gx = ox, gy = oy + L;
    attr(gLine, { x1: ox, y1: oy, x2: gx, y2: gy });
    attr(gLbl, { x: gx + 10, y: gy + 4 });
    const xc = Math.sin(r), zc = Math.cos(r);
    // a = x·X̂ + z·Ẑ: the x arrow runs along ±X, then the z arrow (along +Z) closes the triangle at a's tip.
    const xT = [ox + Xd[0] * L * xc, oy + Xd[1] * L * xc];
    const side = Math.sign(xT[0] - ox) || 1;
    // label beside the tip of a, on the side away from the x/z legs (keeps clear of the pane title)
    attr(aLbl, { x: ax - side * 10, y: ay + 12, 'text-anchor': side > 0 ? 'end' : 'start' });
    attr(xLine, { x1: ox, y1: oy, x2: xT[0], y2: xT[1], opacity: Math.abs(xc) < 0.04 ? 0 : 1 });
    attr(xLbl, { x: xT[0] + side * 40, y: xT[1] + 5 });
    xLbl.textContent = `x = ${signed(xc, 2)}`;
    attr(zLine, { x1: xT[0], y1: xT[1], x2: ax, y2: ay });
    attr(zLbl, { x: (xT[0] + ax) / 2 + side * 12, y: (xT[1] + ay) / 2 + 6, 'text-anchor': side > 0 ? 'start' : 'end' });
    zLbl.textContent = `z = ${fmt(zc, 2)}`;
    // theta arc between gravity (down) and board −Z
    const rr = 46, a0 = 180, a1 = 180 - angleDeg; // svg arc helper: 0 = up, clockwise
    const p = (a) => [ox + rr * Math.sin(a * DEG), oy - rr * Math.cos(a * DEG)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    thArc.setAttribute('d', Math.abs(angleDeg) < 1 ? '' : `M${x0},${y0} A${rr},${rr} 0 0 ${a1 > a0 ? 1 : 0} ${x1},${y1}`);
    const pm = p((a0 + a1) / 2 + (angleDeg >= 0 ? -8 : 8));
    attr(thLbl, { x: pm[0] + (angleDeg >= 0 ? -16 : 16), y: pm[1] + 22 }); thLbl.textContent = Math.abs(angleDeg) < 1 ? '' : 'θ';
    // dial
    const nd = (deg, len) => [DX + len * Math.sin(clamp(deg, -60, 60) * K * DEG), DY - len * Math.cos(clamp(deg, -60, 60) * K * DEG)];
    const [nx, ny] = nd(angleDeg, R - 8); attr(needle, { x2: nx, y2: ny });
    const [fx, fy] = nd(det.filtered, R - 22); attr(ghost, { x2: fx, y2: fy });
    dialVal.textContent = `${signed(angleDeg)}°`;
    if (cF) cF.v.textContent = `góc = atan2(x, z) = atan2(${fmt(xc, 2)}; ${fmt(zc, 2)}) = ${signed(Math.atan2(xc, zc) / DEG)}°`;
    const v = verdict();
    cS.v.textContent = v.text; cS.c.className = `bw-card ${v.cls}`;
    const showEmit = flash && now - flash.at < 1200;
    emitG.setAttribute('opacity', showEmit ? 1 : 0);
    if (showEmit) { emitRect.setAttribute('fill', COMMANDS[flash.cmd].color); emitTxt.textContent = `📡 ${flash.cmd}`; }
  };

  const clock = ticker((dt) => {
    acc += dt;
    while (acc >= 20) { acc -= 20; sample(); }
    draw();
  });
  const setAngle = (v) => {
    angleDeg = clamp(Math.round(v), -60, 60); sl.set(angleDeg);
    if (reduced) { for (let i = 0; i < 25; i++) sample(); prevSampleAngle = angleDeg; draw(); }
    else { clock.start(); draw(); }
  };
  // drag the hand
  const offDrag = drag(svg, {
    onMove: (e) => {
      if (f.root.classList.contains('is-hotspot')) return;
      const p = svgPoint(svg, e);
      const [ox, oy] = [WX, WY];
      setAngle(Math.atan2(p.x - ox, oy - p.y) / DEG);
    },
  });
  f.stage.tabIndex = 0;
  f.stage.setAttribute('aria-label', 'Cổ tay: phím mũi tên trái/phải để nghiêng 2°');
  f.stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setAngle(angleDeg + (e.key === 'ArrowLeft' ? -2 : 2)); } });
  f.setCaption('Kéo bàn tay hoặc thanh trượt: gia tốc kế đo a = −g (ngược chiều trọng lực), chia thành x và z; firmware tính góc bằng atan2(x, z).');
  // settle on the initial angle without animation
  if (reduced) for (let i = 0; i < 25; i++) sample();
  draw();
  if (!reduced) clock.start();
  return staticHandle({ f, start: () => { if (!reduced) clock.start(); }, stop: () => clock.stop(), extraDestroy: () => offDrag() });
}
