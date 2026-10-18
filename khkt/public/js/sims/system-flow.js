// system-flow: cổ tay → IMU → chip nRF52840 → BLE → điện thoại → loa. A packet changes form at each stage.
import { frame, s, h, attr, wristCross, fmt, signed, clamp, lerp, ease, easeOut, arrowMarker, asciiBytes, Timeline, timelineHandle } from './_shared.js';
import { presetTrace, CMD_LIST, COMMANDS } from './_model.js';

export const meta = {
  id: 'system-flow',
  title: 'Đường đi của một cử chỉ',
  timeline: true,
  checkpoints: ['sensed', 'decided', 'sent', 'received', 'spoken', 'end'],
  hotspots: [
    { id: 'wrist', label: 'Cổ tay' }, { id: 'imu', label: 'Cảm biến IMU' }, { id: 'mcu', label: 'Chip nRF52840' },
    { id: 'ble', label: 'Sóng Bluetooth (BLE)' }, { id: 'phone', label: 'Điện thoại' }, { id: 'speaker', label: 'Loa' },
  ],
  defaults: { gesture: 'cycle', showLatency: false },
};

const PRESET_OF = { WATER: 'water', FOOD: 'food', NO: 'no', YES: 'yes', HELP: 'help' };
const POSE = { WATER: { roll: -40 }, FOOD: { roll: 40 }, NO: { shake: true }, YES: { tap: true }, HELP: { pitch: 40 } };
const DECIDE = { WATER: 'nghiêng > 22°, giữ 250 ms', FOOD: 'nghiêng > 22°, giữ 250 ms', NO: '3 pha lắc trong 900 ms', YES: 'gõ đôi + xác nhận 150 ms', HELP: '2 lần nhấp > 25°, trong 2 s' };

const BOX = { w: 170, h: 124 };
const TITLES = { wrist: 'Cổ tay', imu: 'Cảm biến IMU', mcu: 'Chip nRF52840', ble: 'Sóng BLE', phone: 'Điện thoại', speaker: 'Loa' };
const WIDE = [['wrist', 15, 30], ['imu', 215, 30], ['mcu', 415, 30], ['ble', 415, 246], ['phone', 215, 246], ['speaker', 15, 246]];
const TALL = [['wrist', 5, 24], ['imu', 185, 24], ['mcu', 185, 214], ['ble', 5, 214], ['phone', 5, 420], ['speaker', 185, 420]];
const center = (n) => [n.x + BOX.w / 2, n.y + BOX.h / 2];

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const list = P.gesture === 'cycle' ? CMD_LIST : [CMD_LIST.includes(P.gesture) ? P.gesture : 'WATER'];
  // detector-backed facts for each gesture
  const facts = {};
  for (const c of list) {
    const tr = presetTrace(PRESET_OF[c]);
    const ev = tr.events[0];
    // HELP fires when the forearm is back near neutral, so show the deepest point of the dips instead.
    const r = c === 'HELP' ? tr.rows.slice(0, ev.i + 1).reduce((m, q) => (Math.abs(q.filteredPitch) > Math.abs(m.filteredPitch) ? q : m)) : tr.rows[ev.i];
    facts[c] = { cmd: ev.command, x: r.x, y: r.y, z: r.z, gy: r.gy, roll: r.filtered, pitch: r.filteredPitch };
  }
  const narrow = (el.clientWidth || 600) < 520;
  const NODES = (narrow ? TALL : WIDE).map(([id, x, y]) => ({ id, x, y, title: TITLES[id] }));
  const f = frame(el, {
    id: meta.id, title: meta.title, viewBox: narrow ? [360, 570] : [600, 400],
    alt: 'Sáu khối nối thành đường: Cổ tay → Cảm biến IMU → Chip nRF52840 → Sóng BLE → Điện thoại → Loa. Một gói dữ liệu chạy dọc đường và đổi dạng: chuyển động → số gia tốc → mã lệnh như WATER → 5 byte ASCII → câu tiếng Việt → âm thanh.',
  });
  const { svg, defs } = f;
  const mk = arrowMarker(defs, 'var(--c-muted)');
  const legs = [];
  for (let k = 0; k < NODES.length - 1; k++) {
    const a = NODES[k], b = NODES[k + 1];
    let d;
    if (a.y === b.y) { const y = a.y + BOX.h / 2; d = a.x < b.x ? `M${a.x + BOX.w},${y} L${b.x}, ${y}` : `M${a.x},${y} L${b.x + BOX.w},${y}`; }
    else { const x = a.x + BOX.w / 2; d = `M${x},${a.y + BOX.h} L${x},${b.y}`; }
    const p = s('path', { d, class: 'edge', 'marker-end': mk }); svg.append(p);
    const lt = s('text', { 'font-size': 12.5, 'font-weight': 600, class: 't-muted', 'text-anchor': 'middle' });
    svg.append(lt);
    legs.push({ p, lt, a, b });
  }
  const nodes = {};
  NODES.forEach((n) => {
    const g = s('g', { 'data-hotspot': n.id, 'data-label': meta.hotspots.find((x) => x.id === n.id).label });
    const r = s('rect', { x: n.x, y: n.y, width: BOX.w, height: BOX.h, rx: 16, class: 'node' });
    const t = s('text', { x: n.x + BOX.w / 2, y: n.y + BOX.h - 12, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, n.title);
    const art = s('g');
    g.append(r, art, t); svg.append(g);
    nodes[n.id] = { g, r, art, n };
  });
  // node art
  const W = nodes.wrist.n, wr = wristCross(nodes.wrist.art, { cx: W.x + 85, cy: W.y + 60, r: 30, label: false });
  const waveW = s('text', { x: W.x + 150, y: W.y + 28, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: 'var(--c-primary)' }); nodes.wrist.art.append(waveW);
  const I = nodes.imu.n;
  nodes.imu.art.append(s('rect', { x: I.x + 55, y: I.y + 18, width: 60, height: 50, rx: 6, fill: '#2b303b' }), s('text', { x: I.x + 85, y: I.y + 48, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff' }, 'LSM6DS3'));
  const imuTxt = s('text', { x: I.x + 85, y: I.y + 88, 'text-anchor': 'middle', 'font-size': 12.5, class: 'bw-mono' }); nodes.imu.art.append(imuTxt);
  const M = nodes.mcu.n;
  nodes.mcu.art.append(s('rect', { x: M.x + 50, y: M.y + 14, width: 70, height: 56, rx: 6, fill: '#1f6fd8' }), s('text', { x: M.x + 85, y: M.y + 46, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff' }, 'nRF52840'));
  const mcuTxt = s('text', { x: M.x + 85, y: M.y + 90, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }); nodes.mcu.art.append(mcuTxt);
  const Bn = nodes.ble.n;
  const arcs = [0, 1, 2].map((k) => nodes.ble.art.appendChild(s('path', { d: `M${Bn.x + 70 - k * 12},${Bn.y + 30 - k * 8} q${18 + k * 12},${30 + k * 8} 0,${60 + k * 16}`, fill: 'none', stroke: 'var(--viz-packet)', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.3, transform: `rotate(180 ${Bn.x + 85} ${Bn.y + 60})` })));
  const bleTxt = s('text', { x: Bn.x + 85, y: Bn.y + 92, 'text-anchor': 'middle', 'font-size': 12.5, class: 'bw-mono' }); nodes.ble.art.append(bleTxt);
  const Ph = nodes.phone.n;
  nodes.phone.art.append(s('rect', { x: Ph.x + 50, y: Ph.y + 8, width: 70, height: 92, rx: 10, fill: '#1b1f27' }));
  const card = s('rect', { x: Ph.x + 22, y: Ph.y + 34, width: 126, height: 40, rx: 8, stroke: 'rgba(0,0,0,.2)', opacity: 0 });
  const cardTxt = s('text', { x: Ph.x + 85, y: Ph.y + 59, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 't-on-light', opacity: 0 });
  nodes.phone.art.append(card, cardTxt);
  const Sp = nodes.speaker.n;
  nodes.speaker.art.append(s('path', { d: `M${Sp.x + 50},${Sp.y + 40} h18 l22,-18 v76 l-22,-18 h-18 z`, fill: 'var(--c-text)' }));
  const sWaves = [0, 1, 2].map((k) => nodes.speaker.art.appendChild(s('path', { d: `M${Sp.x + 102 + k * 12},${Sp.y + 34 - k * 6} q${12 + k * 4},${26 + k * 6} 0,${52 + k * 12}`, fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 3.5, 'stroke-linecap': 'round', opacity: 0 })));
  const bubble = s('text', { x: Sp.x + 85, y: Sp.y - 10, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, opacity: 0 }); svg.append(bubble);
  // packet
  const pkt = s('g', { opacity: 0 });
  const pktR = s('rect', { x: -44, y: -14, width: 88, height: 28, rx: 14, fill: 'var(--viz-packet)' });
  const pktT = s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, fill: '#fff', class: 'bw-mono' });
  pkt.append(pktR, pktT); svg.append(pkt);
  const note = s('text', { x: narrow ? 180 : 300, y: narrow ? 566 : 214, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }, P.showLatency ? 'Thời gian ghi "≈" là ước lượng minh hoạ' : '');
  svg.append(note);
  if (P.focus && nodes[P.focus]) Object.entries(nodes).forEach(([id, n]) => { if (id !== P.focus) n.g.classList.add('dim'); });

  const STAGES = ['sensed', 'decided', 'sent', 'received', 'spoken'];
  const beats = [];
  list.forEach((c, gi) => {
    const fc = facts[c];
    const caps = {
      sensed: `${COMMANDS[c].gesture}: cảm biến IMU cảm nhận chuyển động của cổ tay.`,
      decided: `IMU gửi số đo (x, y, z, tốc độ quay) cho chip; GestureDetector quyết định: ${DECIDE[c]} → ${c}.`,
      sent: `Chip chỉ gửi một từ ngắn "${c}" qua Bluetooth Low Energy.`,
      received: `Điện thoại nhận ${c.length} byte (${asciiBytes(c).join(' ')}) và tra ra câu "${COMMANDS[c].phrase}"`,
      spoken: `Loa đọc: "${COMMANDS[c].phrase}"`,
    };
    STAGES.forEach((st, k) => beats.push({ id: gi === 0 ? st : `${st}-${c.toLowerCase()}`, cmd: c, leg: k, fc, caption: caps[st], dur: k === 4 ? 2600 : 2000 }));
  });
  beats.push({ id: 'end', cmd: list[list.length - 1], leg: 5, fc: facts[list[list.length - 1]], dur: 600, caption: 'Vòng tay tự nhận dạng; điện thoại chỉ nhận một từ rồi nói thành câu.' });
  const lat = (c) => [' mỗi 20 ms', c === 'NO' ? '≤ 900 ms' : c === 'YES' ? '+150 ms' : c === 'HELP' ? '2 lần nhấp ≤ 2 s' : 'giữ 250 ms', '≈ vài ms', '≈ vài chục ms', '≈ dưới 1 giây'];
  const legData = (c, fc) => [c === 'NO' ? 'lắc ↔' : c === 'YES' ? 'gõ ✌' : c === 'HELP' ? `nhấp ${fmt(fc.pitch)}° ×2` : `nghiêng ${fmt(fc.roll)}°`, c === 'NO' ? `gy ${fmt(fc.gy)}` : c === 'HELP' ? `y ${fmt(fc.y, 2)} z ${fmt(fc.z, 2)}` : `x ${fmt(fc.x, 2)} z ${fmt(fc.z, 2)}`, c, asciiBytes(c).join(' '), '🔊'];

  const render = ({ beat, t01 }) => {
    const c = beat.cmd, fc = beat.fc, leg = beat.leg;
    const col = COMMANDS[c].color;
    // nodes
    NODES.forEach((n, k) => {
      const active = k === leg + 1 || (k === leg && t01 < 0.2) || (leg === 5 && k === 5);
      nodes[n.id].r.setAttribute('class', `node${active ? ' is-active' : ''}`);
    });
    // wrist pose
    const pose = POSE[c];
    const motion = leg === 0 ? ease(clamp(t01 * 1.6, 0, 1)) : leg < 5 ? 1 : 0;
    const roll = pose.roll ? pose.roll * motion : pose.shake && leg === 0 ? 25 * Math.sin(t01 * Math.PI * 6) : 0;
    wr.set(roll);
    waveW.textContent = pose.tap && leg === 0 && t01 > 0.3 ? '✌' : pose.pitch && leg === 0 ? '↓' : pose.shake && leg === 0 ? '↔' : '';
    imuTxt.textContent = leg >= 1 ? legData(c, fc)[1] : '';
    mcuTxt.textContent = leg >= 1 ? (leg === 1 && t01 < 0.7 ? 'đang kiểm tra…' : `→ ${c}`) : '';
    arcs.forEach((a, k) => a.setAttribute('opacity', leg === 2 || leg === 3 ? 0.3 + 0.7 * (Math.floor(t01 * 6 + k) % 3 === 0 ? 1 : 0) : 0.25));
    bleTxt.textContent = leg >= 2 && leg <= 3 ? `"${c}"` : '';
    const showCard = leg >= 4 || (leg === 3 && t01 > 0.8);
    attr(card, { opacity: showCard ? 1 : 0, fill: col }); attr(cardTxt, { opacity: showCard ? 1 : 0 }); cardTxt.textContent = COMMANDS[c].phrase;
    sWaves.forEach((w, k) => w.setAttribute('opacity', (leg === 4 && t01 > 0.5) || leg === 5 ? (Math.floor(t01 * 8) + k) % 3 === 0 ? 1 : 0.35 : 0));
    attr(bubble, { opacity: (leg === 4 && t01 > 0.5) || leg === 5 ? 1 : 0 }); bubble.textContent = `“${COMMANDS[c].phrase}”`;
    // legs
    legs.forEach((L, k) => {
      L.p.setAttribute('class', `edge${k === leg ? ' is-active' : ''}`);
      const [ax, ay] = center(L.a), [bx, by] = center(L.b);
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      attr(L.lt, { x: L.a.y === L.b.y ? mx : mx + (L.a.x > 100 ? -52 : 52), y: L.a.y === L.b.y ? (k === 0 ? L.a.y + BOX.h + 18 : L.a.y - 10) : my + 4 });
      L.lt.textContent = P.showLatency ? lat(c)[k] : '';
    });
    // packet travels along the current leg
    if (leg < 5) {
      const L = legs[leg].p;
      const len = L.getTotalLength ? L.getTotalLength() : 0;
      const u = easeOut(clamp((t01 - 0.15) / 0.7, 0, 1));
      const pt = len ? L.getPointAtLength(len * u) : { x: 0, y: 0 };
      const txt = legData(c, fc)[leg];
      pktT.textContent = txt;
      const w = Math.max(60, txt.length * 8 + 18);
      attr(pktR, { x: -w / 2, width: w, fill: leg === 2 || leg === 3 ? 'var(--viz-packet)' : leg === 4 ? '#2f9e44' : '#5b616e' });
      attr(pkt, { transform: `translate(${pt.x},${pt.y})`, opacity: t01 > 0.12 && t01 < 0.95 ? 1 : 0 });
    } else pkt.setAttribute('opacity', 0);
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('sent') - 600 });
}
