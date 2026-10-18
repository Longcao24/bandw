// forward-flex (id kept for the registry): HELP = two quick forearm dips the same way (firmware DIP_MAX_MS /
// HELP_WINDOW_MS). Side view, pitch = asin(y/|a|); pitch vs roll bars with the 8° margin; dip counter + 700 ms ring;
// a strip chart of |filtered pitch| (last 4 s) marks each dip green (≤ 700 ms, counted) or red (held: not a dip).
// The tour also shows the rejected cases: a single dip (2 s window expires), forearm on the lap, hand to mouth.
import { frame, s, h, attr, armSide, fmt, signed, clamp, lerp, ticker, drag, svgPoint, slider, ring, Timeline, timelineHandle, staticHandle, isReduced, DEG } from './_shared.js';
import { GestureDetector, poseToAccel, makeSignal, runTrace, rowAt, findRow, C, COMMANDS, COMMAND_OF } from './_model.js';

export const meta = {
  id: 'forward-flex',
  title: 'Nhấp cẳng tay 2 lần = Tôi cần giúp đỡ',
  timeline: false,
  checkpoints: ['dip1', 'dip2', 'emit', 'single', 'posture', 'sip', 'end'],
  hotspots: [{ id: 'hand', label: 'Bàn tay' }, { id: 'pitch-bar', label: 'Thanh góc gập' }, { id: 'roll-bar', label: 'Thanh góc nghiêng' }, { id: 'margin', label: 'Khoảng cách 8°' }, { id: 'dip-ring', label: 'Đồng hồ 700 ms của một lần nhấp' }, { id: 'pitch-trace', label: 'Đồ thị góc gập theo thời gian' }],
  defaults: { enterDeg: 25, exitDeg: 12, axisMarginDeg: 8, interactive: true, tour: false },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  // Phones: every pane is shown full width, so the strip chart uses a narrower viewBox with larger text.
  const narrow = (el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800)) < 520;
  const CW = narrow ? 360 : 640, CH = narrow ? 168 : 136, CF = narrow ? 14 : 12.5;
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[340, 320], [300, 320], [CW, CH]],
    alt: 'Nhìn ngang cẳng tay đeo vòng. Hạ hoặc nâng cẳng tay làm trục Y chúi xuống hoặc ngóc lên, góc gập = asin(y/|a|). Một lần nhấp là góc gập vượt 25° (hơn góc nghiêng ít nhất 8°) rồi về dưới 12° trong 700 ms. Hai lần nhấp cùng chiều trong 2 giây thì phát HELP; giữ yên một tư thế thì không.',
  });
  const [A, B] = f.svgs;
  A.append(s('text', { x: 170, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Nhìn ngang cẳng tay'));
  A.append(s('line', { x1: 40, x2: 330, y1: 120, y2: 120, stroke: 'var(--c-border)', 'stroke-dasharray': '5 6' }));
  A.append(s('text', { x: 334, y: 160, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, 'đường trung tính 0°'));
  const handG = s('g', { 'data-hotspot': 'hand', 'data-label': 'Bàn tay' }); A.append(handG);
  const arm = armSide(handG, { ex: 52, ey: 120, len: 170, k: 0.8 });
  const handHit = s('circle', { r: 34, class: 'bw-hs-hit' }); handG.append(handHit);
  const arc = s('path', { fill: 'none', stroke: 'var(--viz-y)', 'stroke-width': 3 });
  const arcTxt = s('text', { 'font-size': 16, 'font-weight': 700, fill: 'var(--viz-y)' });
  A.append(arc, arcTxt);
  const hint = s('text', { x: 170, y: 306, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted' }, P.interactive && !P.tour ? '↕ Kéo bàn tay xuống rồi lên, nhanh, 2 lần' : '');
  A.append(hint);

  // bars
  const BY0 = 50, BY1 = 270, MAXD = 60;
  const by = (d) => BY1 - (clamp(d, 0, MAXD) / MAXD) * (BY1 - BY0);
  B.append(s('text', { x: 150, y: 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, 'Trục nào thắng?'));
  const bar = (x, id, label, color) => {
    const g = s('g', { 'data-hotspot': id, 'data-label': label });
    g.append(s('rect', { x, y: BY0, width: 46, height: BY1 - BY0, rx: 6, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)' }));
    const fill = s('rect', { x: x + 3, width: 40, rx: 4, fill: color });
    const val = s('text', { x: x + 23, y: BY1 + 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, class: 'bw-mono' });
    g.append(fill, val, s('text', { x: x + 23, y: BY1 + 40, 'text-anchor': 'middle', 'font-size': 13, class: 't-muted' }, label));
    B.append(g); return { fill, val };
  };
  [[0, '0°'], [12, '12°'], [25, '25°'], [40, '40°'], [60, '60°']].forEach(([d, l]) => B.append(s('text', { x: 36, y: by(d) + 5, 'text-anchor': 'end', 'font-size': 12, class: 't-muted' }, l)));
  const pBar = bar(44, 'pitch-bar', '|gập|', 'var(--viz-y)');
  const rBar = bar(110, 'roll-bar', '|nghiêng|', 'var(--viz-x)');
  B.append(s('line', { x1: 40, x2: 164, y1: by(25), y2: by(25), class: 'line-enter' }));
  B.append(s('line', { x1: 40, x2: 164, y1: by(12), y2: by(12), class: 'line-exit' }));
  const margin = s('g', { 'data-hotspot': 'margin', 'data-label': 'Khoảng cách 8°' });
  const mLine = s('line', { x1: 40, x2: 96, stroke: 'var(--c-text)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' });
  const mTxt = s('text', { x: 2, 'font-size': 11.5, 'font-weight': 700 }, '');
  const mHit = s('rect', { x: 38, width: 60, height: 16, class: 'bw-hs-hit' });
  margin.append(mHit, mLine, mTxt); B.append(margin);
  const ringG = s('g', { 'data-hotspot': 'dip-ring', 'data-label': 'Đồng hồ 700 ms của một lần nhấp' }); B.append(ringG);
  const rg = ring(ringG, { cx: 232, cy: 120, r: 44, width: 12 });
  const rTxt = s('text', { x: 232, y: 126, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, class: 'bw-mono' });
  const dTxt = s('text', { x: 232, y: 186, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 });
  const wTxt = s('text', { x: 232, y: 204, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }, 'mỗi lần ≤ 700 ms');
  B.append(rTxt, dTxt, wTxt);
  const vG = s('g', { opacity: 0 });
  const vR = s('rect', { x: 178, y: 214, width: 112, height: 38, rx: 19, stroke: 'rgba(0,0,0,.15)' });
  const vT = s('text', { x: 234, y: 239, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 });
  vG.append(vR, vT); B.append(vG);

  // strip chart: |filtered pitch| over the last 4 s, enter 25° / exit 12° lines, dip spans and counts
  const Cv = f.svgs[2];
  const WIN = 4000, X0 = narrow ? 40 : 44, X1 = CW - 12, Y0 = narrow ? 34 : 28, Y1 = CH - (narrow ? 22 : 18);
  const cy = (d) => Y1 - (clamp(d, 0, MAXD) / MAXD) * (Y1 - Y0);
  const traceG = s('g', { 'data-hotspot': 'pitch-trace', 'data-label': 'Đồ thị góc gập theo thời gian' });
  traceG.append(s('rect', { x: X0, y: Y0, width: X1 - X0, height: Y1 - Y0, class: 'panel-bg' }));
  traceG.append(s('text', { x: X0, y: Y0 - (narrow ? 12 : 9), 'font-size': CF + 1, 'font-weight': 700 }, narrow ? '|góc gập| · 4 giây gần nhất' : '|góc gập đã lọc| theo thời gian · 4 giây gần nhất'));
  traceG.append(s('line', { x1: X0, x2: X1, y1: cy(C.PITCH_ENTER_DEG), y2: cy(C.PITCH_ENTER_DEG), class: 'line-enter' }));
  traceG.append(s('line', { x1: X0, x2: X1, y1: cy(C.PITCH_EXIT_DEG), y2: cy(C.PITCH_EXIT_DEG), class: 'line-exit' }));
  [[C.PITCH_ENTER_DEG, '25°'], [C.PITCH_EXIT_DEG, '12°'], [0, '0°']].forEach(([d, l]) => traceG.append(s('text', { x: X0 - 5, y: cy(d) + 4, 'text-anchor': 'end', 'font-size': CF, class: 't-muted' }, l)));
  const spanG = s('g'), lineEl = s('polyline', { fill: 'none', stroke: 'var(--viz-y)', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }), markG = s('g');
  traceG.append(spanG, lineEl, markG);
  traceG.append(s('text', { x: X1, y: CH - 4, 'text-anchor': 'end', 'font-size': CF, class: 't-muted' }, narrow ? 'xanh = nhấp ≤ 700 ms · đỏ = giữ' : 'nền xanh = một lần nhấp (≤ 700 ms) · nền đỏ = giữ tư thế, không tính'));
  Cv.append(traceG);
  // hist: [{ t, ap (|filtered pitch|), dipDir, dips, ev }] oldest → newest
  const drawTrace = (hist, tNow) => {
    const tx = (t) => X0 + (1 - (tNow - t) / WIN) * (X1 - X0);
    const vis = hist.filter((q) => tNow - q.t <= WIN);
    lineEl.setAttribute('points', vis.map((q) => `${tx(q.t).toFixed(1)},${cy(q.ap).toFixed(1)}`).join(' '));
    spanG.textContent = ''; markG.textContent = '';
    let k = 0;
    while (k < vis.length) {
      if (!vis[k].dipDir) { k++; continue; }
      let j = k; while (j + 1 < vis.length && vis[j + 1].dipDir) j++;
      const len = vis[j].t - vis[k].t + 20, open = j === vis.length - 1;
      const col = len > C.DIP_MAX_MS ? 'var(--c-danger)' : open ? 'var(--c-primary)' : 'var(--c-success)';
      spanG.append(s('rect', { x: tx(vis[k].t), y: Y0, width: Math.max(2, tx(vis[j].t + 20) - tx(vis[k].t)), height: Y1 - Y0, fill: col, opacity: 0.16 }));
      if (len > C.DIP_MAX_MS) markG.append(s('text', { x: tx(vis[k].t) + 4, y: Y0 + CF + 3, 'font-size': CF, 'font-weight': 700, fill: 'var(--c-danger)' }, '> 700 ms'));
      k = j + 1;
    }
    vis.forEach((q, i) => {
      const prev = i ? vis[i - 1] : null;
      if (!prev) return;
      const x = tx(q.t);
      if (q.ev || q.dips > prev.dips) {
        const n = q.ev ? 2 : q.dips;
        markG.append(s('circle', { cx: x, cy: cy(C.PITCH_EXIT_DEG), r: narrow ? 9 : 8, fill: q.ev ? 'var(--c-success)' : 'var(--c-primary)' }));
        markG.append(s('text', { x, y: cy(C.PITCH_EXIT_DEG) + 4.5, 'text-anchor': 'middle', 'font-size': CF, 'font-weight': 700, fill: '#fff' }, String(n)));
        if (q.ev) markG.append(s('text', { x: Math.min(x + 12, X1 - 2), y: Y0 + CF + 3, 'text-anchor': x + 60 > X1 ? 'end' : 'start', 'font-size': CF, 'font-weight': 700, fill: 'var(--c-success)' }, 'HELP ✓'));
      } else if (prev.dips && !q.dips && !q.ev) {
        markG.append(s('text', { x, y: cy(C.PITCH_EXIT_DEG) + 4.5, 'text-anchor': 'middle', 'font-size': CF + 1, 'font-weight': 700, fill: 'var(--c-danger)' }, '✗'));
      }
    });
  };

  const card = (k, cls = '') => { const v = h('span', { class: 'bw-card__v' }); const c = h('div', { class: `bw-card ${cls}` }, h('span', { class: 'bw-card__k' }, k), v); f.readout.append(c); return { c, v }; };
  const cF = card('Công thức góc gập', 'bw-card--formula');
  const cS = card('Vòng tay đang thấy');

  const draw = ({ roll, pitch, fRoll, fPitch, dipDir, dipMs, dips, winMs = 0, flashCmd, emitted }) => {
    arm.set(pitch);
    const [hx, hy] = arm.handAt(pitch); attr(handHit, { cx: hx, cy: hy });
    const a0 = 0, a1 = pitch, R = 120;
    const p = (a) => [52 + R * Math.cos(a * DEG), 120 + R * Math.sin(a * DEG)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    arc.setAttribute('d', Math.abs(pitch) < 1 ? '' : `M${x0},${y0} A${R},${R} 0 0 ${pitch > 0 ? 1 : 0} ${x1},${y1}`);
    const pm = p(pitch / 2); attr(arcTxt, { x: pm[0] + 8, y: pm[1] + (pitch > 0 ? 18 : -6) }); arcTxt.textContent = Math.abs(pitch) < 1 ? '' : `${signed(pitch)}°`;
    const ap = Math.abs(fPitch), ar = Math.abs(fRoll);
    attr(pBar.fill, { y: by(ap), height: BY1 - by(ap) });
    attr(rBar.fill, { y: by(ar), height: BY1 - by(ar) });
    pBar.val.textContent = `${fmt(ap)}°`; rBar.val.textContent = `${fmt(ar)}°`;
    const need = ar + C.AXIS_MARGIN_DEG;
    attr(mLine, { y1: by(need), y2: by(need) }); attr(mTxt, { y: by(need) - 4 }); attr(mHit, { y: by(need) - 8 });
    mTxt.textContent = ar > 0.5 ? `cần ≥ ${fmt(need)}°` : '';
    const a = poseToAccel(roll, pitch, 1);
    cF.v.textContent = `asin(y/|a|) = asin(${fmt(a.y, 2)}) = ${signed(Math.asin(clamp(a.y, -1, 1)) / DEG)}°`;
    const over = dipDir && dipMs > C.DIP_MAX_MS;
    rg.set(emitted ? 1 : dipDir ? dipMs / C.DIP_MAX_MS : 0);
    rg.color(emitted ? 'var(--c-success)' : over ? 'var(--c-danger, #d92916)' : 'var(--c-primary)');
    rTxt.textContent = emitted ? '✓' : dipDir ? `${Math.round(Math.min(dipMs, 999))} ms` : '0 ms';
    dTxt.textContent = `Lần nhấp: ${emitted ? 2 : dips}/2`;
    wTxt.textContent = dips && !emitted ? `2 s · còn ${Math.max(0, Math.round((C.HELP_WINDOW_MS - winMs) / 100) * 100)} ms` : 'mỗi lần ≤ 700 ms';
    wTxt.style.fill = dips && !emitted ? 'var(--c-primary)' : ''; wTxt.style.fontWeight = dips && !emitted ? '700' : '';
    let txt, cls = '';
    if (flashCmd) { txt = `Đủ 2 lần nhấp → phát lệnh ${flashCmd} ✓`; cls = 'is-ok'; }
    else if (over) { txt = 'Quá 700 ms: đây là giữ tư thế, không phải nhấp → huỷ đếm'; cls = 'is-warn'; }
    else if (dipDir) { txt = `Lần nhấp ${dips + 1}: đã quá 25° (${dipDir > 0 ? 'xuống' : 'lên'}), giờ đưa về dưới 12°`; cls = 'is-ok'; }
    else if (ap > C.PITCH_ENTER_DEG && ap < ar + C.AXIS_MARGIN_DEG) { txt = 'Gập và nghiêng gần bằng nhau: không trục nào thắng 8° → bỏ qua'; cls = 'is-warn'; }
    else if (dips === 1) { txt = 'Đã có 1 lần nhấp. Nhấp thêm 1 lần cùng chiều trong 2 giây.'; cls = 'is-ok'; }
    else if (ap > C.PITCH_EXIT_DEG) txt = 'Đang gập nhưng chưa đủ 25°';
    else txt = 'Trung tính';
    cS.v.textContent = txt; cS.c.className = `bw-card ${cls}`;
    vG.setAttribute('opacity', flashCmd || emitted ? 1 : 0);
    const c = flashCmd || 'HELP';
    vR.setAttribute('fill', COMMANDS[c].color); vT.textContent = `📡 ${c}`; vT.setAttribute('fill', 'var(--c-text-on-light, #21242c)');
  };

  if (P.tour) {
    // Same shapes as firmware/tests/gesture_test.cpp: helpDips(), oneDip, and rampPitch() postures (≈ 80–100 °/s, held).
    const dip = (p, tag) => [{ move: 160, pitch: p, tag }, { hold: 200, tag }, { move: 160, pitch: 0, tag }, { hold: 240, tag }];
    const segs = [{ hold: 500 }, ...dip(40), ...dip(40), { hold: 1000 },
      ...dip(40, 'single'), { hold: 2300, tag: 'single' },
      { move: 500, pitch: 40, tag: 'lap' }, { hold: 1500, tag: 'lap' }, { move: 500, pitch: 0, tag: 'lap' }, { hold: 700, tag: 'lap' },
      { move: 560, pitch: -45, tag: 'sip' }, { hold: 1000, tag: 'sip' }, { move: 560, pitch: 0, tag: 'sip' }, { hold: 700 }];
    const rows = runTrace(makeSignal(segs, { seed: 19 })).rows;
    const T = (i) => rows[Math.max(0, Math.min(rows.length - 1, i))].t;
    const eI = findRow(rows, (r) => r.event);
    const r1 = findRow(rows, (r) => r.dips === 1);
    const sI = findRow(rows, (r) => r.tag === 'single');
    const xI = findRow(rows, (r) => r.dips === 0 && r.tag === 'single', findRow(rows, (r) => r.dips === 1, sI));
    const lI = findRow(rows, (r) => r.tag === 'lap'), pI = findRow(rows, (r) => r.tag === 'sip');
    const zI = findRow(rows, (r) => !r.tag, pI);
    const beats = [
      { id: 'dip1', t0: T(0), t1: T(r1), caption: 'Lần nhấp 1: hạ cẳng tay quá 25° rồi đưa về dưới 12°, chỉ mất khoảng nửa giây (≤ 700 ms).' },
      { id: 'dip2', t0: T(r1), t1: T(eI) - 1, caption: 'Lần nhấp 2, cùng chiều, trong vòng 2 giây kể từ lần 1. Bộ đếm lên 2/2.' },
      { id: 'emit', t0: T(eI), t1: T(eI) + 500, caption: 'Đủ 2 lần nhấp → phát HELP, điện thoại nói "Tôi cần giúp đỡ."' },
      { id: 'single', t0: T(eI) + 500, t1: T(xI) + 300, caption: 'Chỉ nhấp 1 lần rồi thôi: hết cửa sổ 2 giây mà không có lần thứ 2 → bộ đếm về 0/2, không phát gì.' },
      { id: 'posture', t0: T(xI) + 300, t1: T(pI), caption: 'Đặt cẳng tay lên đùi và để yên: góc gập vượt 25° nhưng quá 700 ms mới về, nên đây là "giữ", không phải "nhấp".' },
      { id: 'sip', t0: T(pI), t1: T(zI), caption: 'Đưa tay lên miệng uống nước (cẳng tay nâng lên, giữ 1 giây): cũng quá 700 ms → không phát HELP. Cách cũ "gập và giữ" từng báo nhầm đúng ở những tư thế này.' },
      { id: 'end', t0: T(zI), t1: rows[rows.length - 1].t, caption: 'HELP là lệnh khẩn nên dùng cử chỉ khó xảy ra tình cờ: 2 lần nhấp nhanh, cùng chiều, trong 2 giây.' },
    ].map((b) => ({ ...b, dur: clamp((b.t1 - b.t0) * 2.4, 1200, b.id === 'single' || b.id === 'sip' ? 6000 : 5000) }));
    if (lI < 0 || pI < 0) throw new Error('forward-flex tour: missing segment');
    const hist = rows.map((q) => ({ t: q.t, ap: Math.abs(q.filteredPitch), dipDir: q.dipDir, dips: q.dips, ev: !!q.event }));
    const render = ({ beat, t01 }) => {
      const simT = lerp(beat.t0, beat.t1, t01);
      const i = rowAt(rows, simT), r = rows[i];
      const emitted = simT >= T(eI) && simT < T(eI) + 900;
      draw({ roll: r.roll, pitch: r.pitch, fRoll: r.filtered, fPitch: r.filteredPitch, dipDir: r.dipDir, dipMs: r.t - r.dipStart, dips: r.dips, winMs: r.t - r.firstDipAt, flashCmd: emitted ? 'HELP' : null, emitted });
      drawTrace(hist.slice(Math.max(0, i - 220), i + 1), r.t);
    };
    const tl = new Timeline({ beats, render, ctx });
    return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('dip1') + 300 });
  }

  // interactive: detector clock at 50 Hz
  const det = new GestureDetector();
  let now = 1000; det.calibrate(0, 0, 1, now - 20);
  let pitch = 0, roll = 0, prevP = 0, prevR = 0, acc = 0, flash = null;
  const hist = [];
  const sample = () => {
    const gx = (pitch - prevP) / 0.02, gy = (roll - prevR) / 0.02; prevP = pitch; prevR = roll;
    const a = poseToAccel(roll, pitch, 1);
    const g = det.update(a.x, a.y, a.z, clamp(gx, -400, 400), clamp(gy, -400, 400), 0, now, false);
    if (g) { flash = { cmd: COMMAND_OF[g], at: now }; ctx.onEvent?.('gesture', { command: COMMAND_OF[g] }); }
    hist.push({ t: now, ap: Math.abs(det.filteredPitch), dipDir: det.dipDir, dips: det.dips, ev: COMMAND_OF[g] === 'HELP' });
    if (hist.length > 240) hist.shift();
    now += 20;
  };
  for (let i = 0; i < 15; i++) sample();
  const redraw = () => {
    const fl = flash && now - flash.at < 1200 ? flash.cmd : null;
    draw({ roll, pitch, fRoll: det.filtered, fPitch: det.filteredPitch, dipDir: det.dipDir, dipMs: now - 20 - det.dipStart, dips: det.dips, winMs: now - 20 - det.firstDipAt, flashCmd: fl, emitted: !!fl });
    drawTrace(hist, now - 20);
  };
  const clock = ticker((dt) => { acc += dt; while (acc >= 20) { acc -= 20; if (auto && auto.length) { pitch = auto.shift(); sP.set(pitch); } sample(); } redraw(); });
  const sP = slider({ label: 'Góc gập', min: -50, max: 60, value: 0, unit: '°', fmtFn: (v) => signed(v), onInput: (v) => set(v, roll) });
  const sR = slider({ label: 'Nghiêng kèm', min: 0, max: 40, value: 0, unit: '°', onInput: (v) => set(pitch, v) });
  // "Nhấp thử": one automatic quick dip (0 → 40° → 0 in ≈ 0.5 s) so keyboard / touch users can try it too.
  let auto = null;
  const dipBtn = h('button', { type: 'button', class: 'bw-btn' }, '↕ Nhấp thử 1 lần');
  dipBtn.addEventListener('click', () => {
    const plan = [...Array(8)].map((_, k) => 5 * (k + 1)).concat(Array(10).fill(40), [...Array(8)].map((_, k) => 35 - 5 * k), Array(12).fill(0));
    if (reduced) { for (const p of plan) { pitch = p; sample(); } sP.set(pitch); redraw(); return; }
    auto = plan; clock.start();
  });
  f.panel.append(sP.el, sR.el, dipBtn);
  const set = (p, r) => {
    pitch = clamp(Math.round(p), -50, 60); roll = clamp(Math.round(r), 0, 40); sP.set(pitch); sR.set(roll);
    if (reduced) { for (let i = 0; i < 30; i++) sample(); redraw(); } else clock.start();
  };
  let offDrag = null;
  if (P.interactive) {
    offDrag = drag(A, { onMove: (e) => { if (f.root.classList.contains('is-hotspot')) return; const p = svgPoint(A, e); set(Math.atan2(p.y - 120, p.x - 52) / DEG, roll); } });
    f.stage.tabIndex = 0;
    f.stage.setAttribute('aria-label', 'Cẳng tay: phím mũi tên lên/xuống để gập 2°, hoặc bấm nút Nhấp thử');
    f.stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); set(pitch + (e.key === 'ArrowDown' ? 2 : -2), roll); } });
  }
  f.setCaption('Kéo bàn tay xuống quá 25° rồi về ngay, 2 lần liền (hoặc bấm "Nhấp thử" 2 lần). Giữ yên lâu thì không ra HELP. Thử "Nghiêng kèm" để thấy biên 8°.');
  redraw();
  if (!reduced) clock.start();
  return staticHandle({ f, start: () => { if (!reduced) clock.start(); }, stop: () => clock.stop(), extraDestroy: () => offDrag?.() });
}
