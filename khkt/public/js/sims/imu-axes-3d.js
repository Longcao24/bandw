// imu-axes-3d: pseudo-3D wrist + board with X/Y/Z axes, gravity arrow, live accel/gyro bars.
import { frame, s, h, attr, arm3d, fmt, signed, clamp, lerp, ease, ticker, drag, svgPoint, Timeline, timelineHandle, staticHandle, isReduced } from './_shared.js';
import { poseToAccel, C } from './_model.js';

export const meta = {
  id: 'imu-axes-3d',
  title: 'Ba trục của cảm biến IMU',
  timeline: false,
  checkpoints: ['neutral', 'left', 'right', 'forward', 'vertical', 'end'],
  hotspots: [
    { id: 'axis-x', label: 'Trục X' }, { id: 'axis-y', label: 'Trục Y' }, { id: 'axis-z', label: 'Trục Z' },
    { id: 'gravity', label: 'Trọng lực' }, { id: 'board', label: 'Bo mạch' },
  ],
  defaults: { mode: 'accel', interactive: true, preset: 'neutral', showBars: true, tour: false },
};

const PRESETS = {
  neutral: { roll: 0, pitch: 0, label: 'Trung tính', cap: 'Đặt phẳng: trọng lực dồn hết vào trục Z, nên z ≈ 1 g còn x, y ≈ 0.' },
  left: { roll: -40, pitch: 0, label: 'Nghiêng trái', cap: 'Nghiêng trái 40°: trục X chúc xuống nên x âm, z giảm. Trục nào hướng lên thì đọc số dương.' },
  right: { roll: 40, pitch: 0, label: 'Nghiêng phải', cap: 'Nghiêng phải 40°: trục X ngóc lên nên x dương, z giảm. Độ lớn tổng vẫn ≈ 1 g.' },
  forward: { roll: 0, pitch: 40, label: 'Hạ cẳng tay', cap: 'Hạ cẳng tay 40°: trục Y (dọc cẳng tay, mũi tên về phía khuỷu) ngóc lên nên y dương.' },
  vertical: { roll: 0, pitch: -80, label: 'Dựng đứng', cap: 'Cẳng tay dựng đứng: x và z gần 0, √(x²+z²) < 0,4 g nên firmware khoá góc nghiêng.' },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  const showA = P.mode !== 'gyro', showG = P.mode !== 'accel';
  // Two panes: the 3D arm and the bar panel. On phones (< 600px) the panes stack, so the bars get the
  // full width and their labels/values stay readable (≥ 16px) instead of shrinking to ~5px.
  const barsH = showA && showG ? 392 : 212;
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[430, 400], [215, barsH, 430, 0]],
    alt: 'Mô hình cổ tay đeo bo mạch, có mũi tên trục X (đỏ, về phía trái cổ tay), Y (xanh lá, dọc cẳng tay về phía khuỷu), Z (xanh dương, hướng lên) và mũi tên trọng lực tím hướng xuống. Các thanh bên phải cho biết gia tốc kế đo bao nhiêu g trên mỗi trục.',
  });
  const { svg, defs } = f;
  svg.append(s('rect', { x: 0, y: 0, width: 640, height: 400, fill: 'var(--c-surface, #fff)' }));
  // floor shadow
  svg.append(s('ellipse', { cx: 225, cy: 330, rx: 170, ry: 26, fill: 'var(--c-surface-2, #eee)' }));
  const armG = s('g'); svg.append(armG);
  const arm = arm3d(armG, defs, { axes: true, gravity: true, yaw: -28, elev: 34, scale: 74, cx: 215, cy: 240, persp: 16, axisLen: 1.3 });
  const boardHit = s('circle', { r: 26, class: 'bw-hs-hit', 'data-hotspot': 'board', 'data-label': 'Bo mạch' });
  svg.append(boardHit);
  const dragHint = s('text', { x: 220, y: 385, 'text-anchor': 'middle', 'font-size': 15, class: 't-muted' }, P.interactive ? '↔ ↕ Kéo để xoay cổ tay' : '');
  svg.append(dragHint);
  const warn = s('g', { visibility: 'hidden' },
    s('rect', { x: 18, y: 14, width: 404, height: 40, rx: 10, fill: 'var(--c-warn-bg, #fff3e0)', stroke: 'var(--viz-exit)' }),
    s('text', { x: 220, y: 40, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: 'var(--c-warn, #9a5200)' }, '⚠ √(x²+z²) < 0,4 g → khoá nghiêng'));
  svg.append(warn);

  // bars
  const barsG = s('g', { transform: 'translate(440,24)' }); f.svgs[1].append(barsG);
  const bars = [];
  const mkBar = (key, label, color, y, max, unit) => {
    const W = 180, cx = W / 2;
    const g = s('g', { transform: `translate(0,${y})` });
    const txt = s('text', { x: 0, y: 0, 'font-size': 16, 'font-weight': 700, fill: color }, label);
    const track = s('rect', { x: 0, y: 8, width: W, height: 20, rx: 6, fill: 'var(--c-surface-2, #f0f2f5)', stroke: 'var(--c-border)' });
    const zero = s('line', { x1: cx, x2: cx, y1: 4, y2: 32, stroke: 'var(--c-muted)', 'stroke-width': 1.5 });
    const fill = s('rect', { y: 10, height: 16, rx: 4, fill: color });
    const val = s('text', { x: W, y: 0, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 700, class: 'bw-mono' }, '');
    g.append(txt, track, fill, zero, val); barsG.append(g);
    bars.push({ key, set(v) { const k = clamp(v / max, -1, 1) * (W / 2 - 2); attr(fill, { x: k >= 0 ? cx : cx + k, width: Math.abs(k) }); val.textContent = `${signed(v, unit === 'g' ? 2 : 0)} ${unit}`; } });
  };
  let y = 0;
  if (showA) {
    barsG.append(s('text', { x: 0, y: y, 'font-size': 15, class: 't-muted', 'font-weight': 600 }, 'Gia tốc kế (g)'));
    y += 26;
    [['ax', 'x', 'var(--viz-x)'], ['ay', 'y', 'var(--viz-y)'], ['az', 'z', 'var(--viz-z)']].forEach(([k, l, c]) => { mkBar(k, l, c, y, 1.1, 'g'); y += 50; });
    y += 4;
  }
  if (showG) {
    barsG.append(s('text', { x: 0, y: y, 'font-size': 15, class: 't-muted', 'font-weight': 600 }, 'Con quay (°/s)'));
    y += 26;
    [['gx', 'gx', 'var(--viz-x)'], ['gy', 'gy', 'var(--viz-y)'], ['gz', 'gz', 'var(--viz-z)']].forEach(([k, l, c]) => { mkBar(k, l, c, y, 400, '°/s'); y += 50; });
  }

  // readouts
  const card = (k) => { const v = h('span', { class: 'bw-card__v' }); const c = h('div', { class: 'bw-card' }, h('span', { class: 'bw-card__k' }, k), v); f.readout.append(c); return { c, v }; };
  const cPose = card('Tư thế');
  const cMag = card('Độ lớn |a|');
  const cPlane = card('√(x² + z²)');

  // state
  let roll = 0, pitch = 0, gyro = { gx: 0, gy: 0, gz: 0 }, lastT = 0, tween = null, target = null;
  const draw = () => {
    arm.set(roll, pitch);
    const [bx, by] = arm.boardScreen; attr(boardHit, { cx: bx, cy: by });
    const a = poseToAccel(roll, pitch, 1);
    const vals = { ax: a.x, ay: a.y, az: a.z, ...gyro };
    bars.forEach((b) => b.set(vals[b.key]));
    const plane = Math.hypot(a.x, a.z);
    cMag.v.textContent = `${fmt(Math.hypot(a.x, a.y, a.z), 2)} g`;
    cPlane.v.textContent = `${fmt(plane, 2)} g`;
    cPlane.c.classList.toggle('is-warn', plane < C.MIN_PLANE_G);
    warn.setAttribute('visibility', plane < C.MIN_PLANE_G ? 'visible' : 'hidden');
    cPose.v.textContent = `nghiêng ${signed(roll)}° · gập ${signed(pitch)}°`;
  };
  // gyro estimate from pose motion, decays when still
  const setPose = (r, p, dtMs) => {
    if (dtMs > 0) {
      const k = 1000 / dtMs;
      const ngy = (r - roll) * k, ngx = (p - pitch) * k;
      gyro.gy = lerp(gyro.gy, clamp(ngy, -500, 500), 0.5); gyro.gx = lerp(gyro.gx, clamp(ngx, -500, 500), 0.5);
    }
    roll = clamp(r, -90, 90); pitch = clamp(p, -85, 85);
  };
  const decay = ticker((dt) => {
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.dur);
      const e = ease(tween.t);
      setPose(lerp(tween.r0, tween.r1, e), lerp(tween.p0, tween.p1, e), dt);
      if (tween.t >= 1) tween = null;
    } else {
      gyro.gx *= Math.pow(0.82, dt / 16); gyro.gy *= Math.pow(0.82, dt / 16);
      if (Math.abs(gyro.gx) < 0.5 && Math.abs(gyro.gy) < 0.5 && !dragging) { gyro.gx = gyro.gy = 0; draw(); decay.stop(); return; }
    }
    draw();
  });
  const goTo = (name, dur = 700) => {
    const pr = PRESETS[name] || PRESETS.neutral;
    if (reduced || dur === 0) { tween = null; roll = pr.roll; pitch = pr.pitch; gyro = { gx: 0, gy: 0, gz: 0 }; draw(); return; }
    tween = { r0: roll, p0: pitch, r1: pr.roll, p1: pr.pitch, t: 0, dur };
    decay.start();
  };

  // interaction
  let dragging = false, last = null, offDrag = null;
  if (P.interactive) {
    f.stage.tabIndex = 0;
    f.stage.setAttribute('aria-label', 'Mô hình cổ tay: dùng phím mũi tên trái/phải để nghiêng, lên/xuống để gập');
    offDrag = drag(svg, {
      onStart: (e) => { if (f.root.classList.contains('is-hotspot')) return; dragging = true; tween = null; last = { ...svgPoint(svg, e), t: performance.now() }; decay.start(); },
      onMove: (e) => {
        if (!dragging) return;
        const p = svgPoint(svg, e), t = performance.now();
        const dt = Math.max(8, t - last.t);
        setPose(roll + (p.x - last.x) * 0.45, pitch + (p.y - last.y) * 0.45, dt);
        last = { ...p, t }; draw();
      },
      onEnd: () => { dragging = false; },
    });
    f.stage.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key];
      if (!d) return; e.preventDefault(); tween = null;
      setPose(roll + d[0], pitch + d[1], 60); draw(); decay.start();
    });
    const btns = h('div', { class: 'bw-chips', role: 'group', 'aria-label': 'Tư thế mẫu' });
    Object.entries(PRESETS).forEach(([k, v]) => btns.append(h('button', { type: 'button', class: 'bw-chip', onclick: () => { goTo(k); f.setCaption(v.cap); } }, v.label)));
    if (!P.tour) f.panel.append(btns);
  }

  if (P.tour) {
    const order = ['neutral', 'left', 'right', 'forward', 'vertical'];
    let prev = PRESETS.neutral;
    const beats = order.map((k) => { const b = { id: k, dur: 2600, caption: PRESETS[k].cap, from: prev, to: PRESETS[k] }; prev = PRESETS[k]; return b; });
    beats.push({ id: 'end', dur: 400, caption: 'Thử kéo mô hình để tự khám phá.', from: PRESETS.vertical, to: PRESETS.vertical });
    let lastFrameT = 0;
    const tl = new Timeline({
      beats, ctx,
      render: ({ beat, t01, T }) => {
        const k = ease(clamp(t01 / 0.45, 0, 1));
        const r = lerp(beat.from.roll, beat.to.roll, k), p = lerp(beat.from.pitch, beat.to.pitch, k);
        const dt = Math.abs(T - lastFrameT); lastFrameT = T;
        if (t01 < 0.45 && dt > 0 && dt < 100) setPose(r, p, dt / (tl?.speed || 1)); else { roll = r; pitch = p; gyro = { gx: 0, gy: 0, gz: 0 }; }
        draw();
      },
    });
    const hd = timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('left'), extraDestroy: () => { decay.stop(); offDrag?.(); } });
    return hd;
  }

  goTo(P.preset, 0);
  f.setCaption((PRESETS[P.preset] || PRESETS.neutral).cap);
  return staticHandle({ f, start: () => {}, stop: () => decay.stop(), extraDestroy: () => offDrag?.() });
}
