// main-loop: loop() every 20 ms — kick watchdog → BLE.poll → wait (return early) → read IMU → detector.update → send.
import { frame, s, h, attr, fmt, clamp, lerp, arrowMarker, codeView, varTable, Timeline, timelineHandle } from './_shared.js';
import { presetTrace, COMMAND_OF, GESTURE_NAME } from './_model.js';

export const meta = {
  id: 'main-loop',
  title: 'Vòng lặp loop() mỗi 20 ms',
  timeline: true,
  checkpoints: [...[1, 2, 3, 4].flatMap((c) => ['kick', 'poll', 'wait', 'read', 'update', 'send'].map((b) => `${b}-c${c}`)), 'end'],
  hotspots: [
    { id: 'kick', label: 'Đá watchdog' }, { id: 'poll', label: 'BLE.poll()' }, { id: 'wait', label: 'Chờ đủ 20 ms' },
    { id: 'read', label: 'Đọc cảm biến IMU' }, { id: 'update', label: 'Nhận dạng cử chỉ' }, { id: 'send', label: 'Gửi lệnh' },
  ],
  defaults: { sampleMs: 20, showVariables: true, scenario: 'water', slowmo: true },
};

const CODE = `void loop() {
  NRF_WDT->RR[0] = WDT_RR_RR_Reload; // đá watchdog
  BLE.poll();
  uint32_t now = millis();
  if (now - sampleAt < SAMPLE_MS) { delay(1); return; }
  sampleAt = now;
  float v[6] = {};
  bool valid = readImu(v);
  float gx = v[0], gy = v[1], gz = v[2], x = v[3], y = v[4], z = v[5];
  if (!calibrated) { /* đưa mẫu vào Calibrator */ return; }
  Gesture event = detector.update(x, y, z, gx, gy, gz, now, doubleTap);
  if (!subscribed) return;
  const char* command = event == Gesture::Water ? "WATER" : /* … */ nullptr;
  if (command) gestureCharacteristic.writeValue(command);
}`;
const LINES = { kick: [2], poll: [3], wait: [4, 5], read: [6, 7, 8, 9], update: [10, 11], send: [12, 13, 14] };
const HS = { kick: { label: 'Đá watchdog', lines: [2, 2] }, poll: { label: 'BLE.poll()', lines: [3, 3] }, wait: { label: 'Chờ đủ 20 ms', lines: [4, 5] }, read: { label: 'Đọc cảm biến IMU', lines: [6, 9] }, update: { label: 'Nhận dạng cử chỉ', lines: [10, 11] }, send: { label: 'Gửi lệnh', lines: [12, 14] } };
const ST = [['kick', 'Đá watchdog'], ['poll', 'BLE.poll'], ['wait', 'Chờ 20 ms'], ['read', 'Đọc IMU'], ['update', 'Nhận dạng'], ['send', 'Gửi lệnh']];

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const tr = presetTrace(P.scenario === 'idle' ? 'rest' : 'water');
  const rows = tr.rows;
  const k = P.scenario === 'idle' ? 30 : tr.events[0].i; // the 4th cycle is the emitting one
  const cyc = [k - 3, k - 2, k - 1, k].map((i) => ({ r: rows[i], prev: rows[i - 1] }));
  const f = frame(el, {
    id: meta.id, title: meta.title, side: true, viewBox: [320, 330],
    alt: 'Vòng tròn 6 trạm của loop(): đá watchdog, BLE.poll, chờ đủ 20 ms, đọc IMU, nhận dạng, gửi lệnh. Đồng hồ millis() cho thấy mỗi 20 ms mới đọc cảm biến một lần, tức 50 lần mỗi giây; giữa các lần đó loop() quay nhanh rồi return.',
  });
  const { svg, defs } = f;
  const CX = 160, CY = 150, R = 100;
  const mk = arrowMarker(defs, 'var(--c-border)');
  svg.append(s('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 3, 'stroke-dasharray': '2 8' }));
  const stations = ST.map(([id, label], i) => {
    const a = (i / 6) * 2 * Math.PI;
    const x = CX + R * Math.sin(a), y = CY - R * Math.cos(a);
    const g = s('g');
    const c = s('circle', { cx: x, cy: y, r: 22, class: 'node' });
    const n = s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700 }, String(i + 1));
    const below = Math.cos(a) < -0.3;
    const t = s('text', { x, y: below ? y + 38 : y - 28, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label);
    g.append(c, n, t); svg.append(g); return { c, t };
  });
  const dot = s('circle', { r: 8, fill: 'var(--c-primary)' }); svg.append(dot);
  const ms = s('text', { x: CX, y: CY - 14, 'text-anchor': 'middle', 'font-size': 14, class: 't-muted' }, 'millis()');
  const msV = s('text', { x: CX, y: CY + 12, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, class: 'bw-mono' });
  const cycT = s('text', { x: CX, y: CY + 36, 'text-anchor': 'middle', 'font-size': 13, class: 't-muted' });
  svg.append(ms, msV, cycT);
  // 20 ms bar
  svg.append(s('text', { x: 20, y: 296, 'font-size': 12.5, class: 't-muted' }, 'từ lần đọc trước'));
  svg.append(s('rect', { x: 20, y: 302, width: 280, height: 14, rx: 7, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)' }));
  const bar = s('rect', { x: 20, y: 302, height: 14, rx: 7, fill: 'var(--c-primary)' });
  const barT = s('text', { x: 300, y: 296, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'bw-mono' });
  svg.append(bar, barT);

  const code = codeView(CODE, { lang: 'cpp', label: 'Mã rút gọn từ BandW_Sense.ino', hotspots: HS });
  f.side.append(code.el);
  const vars = varTable(['now', 'sampleAt', 'x', 'y', 'z', 'gy', 'event', 'command'], { title: 'Giá trị các biến' });
  if (P.showVariables) f.side.append(vars.el);

  const CAP = {
    kick: 'Đầu mỗi vòng: "đá" watchdog. Nếu chương trình treo quá 4 giây, vòng tay tự khởi động lại.',
    poll: 'BLE.poll(): xử lý việc của Bluetooth (kết nối, đăng ký…).',
    wait: 'Chưa đủ 20 ms kể từ lần đọc trước → delay(1); return; loop() quay lại từ đầu rất nhanh.',
    read: 'Đủ 20 ms: ghi sampleAt = now và đọc 6 trục từ IMU (gia tốc x, y, z và con quay).',
    update: 'detector.update(...) xét mẫu mới: có cử chỉ nào hoàn thành không?',
  };
  const beats = [];
  cyc.forEach((c, ci) => ST.forEach(([id]) => {
    const isEmit = !!c.r.event;
    beats.push({ id: `${id}-c${ci + 1}`, st: id, ci, c, dur: id === 'wait' ? 2200 : id === 'send' && isEmit ? 2200 : P.slowmo ? 1100 : 600,
      caption: id === 'send' ? (isEmit ? `event = ${GESTURE_NAME[c.r.event]} → command = "${c.r.command}" → writeValue gửi qua BLE!` : 'event = None → command = nullptr → không gửi gì. Vòng sau lại bắt đầu.') : CAP[id] });
  }));
  beats.push({ id: 'end', st: 'send', ci: 3, c: cyc[3], dur: 700, caption: '1000 ms ÷ 20 ms = 50 lần đọc cảm biến mỗi giây.' });

  const render = ({ beat, t01 }) => {
    const { st, c, ci } = beat;
    const order = ST.findIndex(([id]) => id === st);
    stations.forEach((x, i) => x.c.setAttribute('class', `node${i === order ? ' is-active' : ''}`));
    const a = ((order + (beat.id === 'end' ? 1 : t01 * 0.999)) / 6) * 2 * Math.PI;
    attr(dot, { cx: CX + R * Math.sin(a), cy: CY - R * Math.cos(a) });
    const prevT = c.prev.t, curT = c.r.t;
    let now = prevT + 1;
    if (st === 'wait') now = Math.round(lerp(prevT + 1, curT, t01));
    else if (['read', 'update', 'send'].includes(st)) now = curT;
    else now = prevT + 1;
    const spins = st === 'wait' ? Math.max(0, now - prevT - 1) : 0;
    msV.textContent = String(now);
    cycT.textContent = st === 'wait' && now - prevT < 20 ? `return sớm ×${spins + 1}` : `lần đọc thứ ${ci + 1}`;
    const elapsed = clamp(now - prevT, 0, 20);
    attr(bar, { width: 280 * elapsed / 20, fill: elapsed >= 20 ? 'var(--c-success)' : 'var(--c-primary)' });
    barT.textContent = `${elapsed}/20 ms`;
    const lines = st === 'wait' && now - prevT >= 20 ? [4, 5] : LINES[st];
    code.highlight(lines, st === 'send' && c.r.event ? 'ok' : st === 'wait' && now - prevT < 20 ? 'no' : 'run');
    const after = ['read', 'update', 'send'].includes(st);
    const r = after ? c.r : c.prev;
    const showEvent = st === 'update' ? t01 > 0.5 : st === 'send';
    vars.set({
      now, sampleAt: after ? curT : prevT,
      x: fmt(r.x, 2), y: fmt(r.y, 2), z: fmt(r.z, 2), gy: fmt(r.gy, 0),
      event: showEvent ? `Gesture::${GESTURE_NAME[c.r.event]}` : '—',
      command: st === 'send' ? (c.r.command ? `"${c.r.command}"` : 'nullptr') : '—',
    });
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('update-c1') });
}
