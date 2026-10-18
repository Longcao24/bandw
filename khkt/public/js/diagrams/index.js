// Named static diagrams (spec §4.4). Pure strings: colors come from CSS vars, so dark mode works.
// Every clickable region: <g class="hs" data-hotspot="id" data-label="Nhãn">.

const defs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--c-muted)"/></marker></defs>`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function box({ id, label, x, y, w, h, title, sub, icon, cls = '', rx = 12 }) {
  const cx = x + w / 2;
  const lines = [];
  let ty = y + h / 2 + (sub ? -4 : 6) + (icon ? 12 : 0);
  if (icon) lines.push(`<text x="${cx}" y="${y + 30}" text-anchor="middle" font-size="24" aria-hidden="true">${icon}</text>`);
  lines.push(`<text x="${cx}" y="${ty}" text-anchor="middle" font-size="16" font-weight="700" class="dg-title">${esc(title)}</text>`);
  if (sub) lines.push(`<text x="${cx}" y="${ty + 20}" text-anchor="middle" font-size="14" class="dg-sub">${esc(sub)}</text>`);
  const inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="dg-node ${cls}"/>${lines.join('')}`;
  return id ? `<g class="hs" data-hotspot="${id}" data-label="${esc(label || title)}">${inner}</g>` : `<g>${inner}</g>`;
}
const arrow = (m, d, extra = '') => `<path d="${d}" class="dg-arrow" marker-end="url(#${m})" ${extra}/>`;
const label = (x, y, t, anchor = 'middle', size = 14) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" class="dg-sub">${esc(t)}</text>`;
const svg = (vb, body, title) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" class="diagram-svg" role="img"><title>${esc(title)}</title>${body}</svg>`;

// ---------- system-blocks ----------
function systemBlocks() {
  const m = 'dg-a-sys';
  const W = 160, H = 96;
  const B = [
    { id: 'wrist', title: 'Cổ tay', sub: 'cử chỉ', icon: '✋', x: 20, y: 24 },
    { id: 'imu', title: 'IMU', sub: 'LSM6DS3', icon: '🧭', x: 220, y: 24 },
    { id: 'mcu', title: 'Chip nRF52840', sub: 'nhận dạng', icon: '🧠', x: 420, y: 24 },
    { id: 'ble', title: 'Sóng BLE', sub: '"WATER"', icon: '📶', x: 420, y: 200 },
    { id: 'phone', title: 'Điện thoại', sub: 'app Android', icon: '📱', x: 220, y: 200 },
    { id: 'speaker', title: 'Loa', sub: 'đọc câu', icon: '🔊', x: 20, y: 200 },
  ];
  const labels = { wrist: 'Cổ tay', imu: 'Cảm biến IMU', mcu: 'Vi điều khiển nRF52840', ble: 'Bluetooth Low Energy', phone: 'Điện thoại Android', speaker: 'Loa' };
  const body = defs(m) + `<rect x="12" y="14" width="576" height="118" rx="16" class="dg-zone fw"/>` +
    `<rect x="12" y="190" width="576" height="118" rx="16" class="dg-zone app"/>` +
    B.map((b) => box({ ...b, label: labels[b.id], w: W, h: H })).join('') +
    arrow(m, 'M182,72 L216,72') + arrow(m, 'M382,72 L416,72') + arrow(m, 'M500,122 L500,196') +
    arrow(m, 'M418,248 L384,248') + arrow(m, 'M218,248 L184,248') +
    label(300, 166, 'Trên: vòng tay (firmware C++) · Dưới: điện thoại (app Java)', 'middle', 14);
  return svg('0 0 600 320', body, 'Sơ đồ khối hệ thống BandW');
}

// ---------- xiao-board ----------
function xiaoBoard() {
  const body = `
  <rect x="150" y="40" width="300" height="300" rx="22" class="dg-board"/>
  <g class="hs" data-hotspot="usb" data-label="Cổng USB-C"><rect x="250" y="18" width="100" height="44" rx="10" class="dg-node metal"/>${label(300, 46, 'USB-C', 'middle', 15)}</g>
  <g class="hs" data-hotspot="mcu" data-label="Chip nRF52840 (vi điều khiển + Bluetooth)"><rect x="190" y="110" width="160" height="150" rx="10" class="dg-node chip"/><text x="270" y="180" text-anchor="middle" font-size="16" font-weight="700" class="dg-title-inv">nRF52840</text><text x="270" y="202" text-anchor="middle" font-size="14" class="dg-title-inv">bộ não + BLE</text></g>
  <g class="hs" data-hotspot="antenna" data-label="Ăng-ten Bluetooth"><path d="M362,110 h60 v20 h-40 v20 h40 v20 h-40 v20 h40" class="dg-antenna"/><rect x="356" y="102" width="74" height="96" rx="8" fill="transparent" class="hs-pad"/>${label(394, 222, 'ăng-ten')}</g>
  <g class="hs" data-hotspot="imu" data-label="Cảm biến IMU LSM6DS3"><rect x="372" y="250" width="54" height="54" rx="6" class="dg-node imu"/>${label(399, 282, 'IMU', 'middle', 14)}</g>
  <g class="hs" data-hotspot="led" data-label="Đèn LED trạng thái"><circle cx="196" cy="84" r="12" class="dg-led"/><text x="222" y="90" font-size="14" class="dg-sub">LED</text></g>
  <g class="hs" data-hotspot="battery" data-label="Chân pin (mặt sau)"><rect x="190" y="286" width="120" height="40" rx="8" class="dg-node dashed"/>${label(250, 312, 'pin (mặt sau)', 'middle', 14)}</g>
  ${label(300, 370, 'Seeed XIAO nRF52840 Sense, nhìn từ trên (21 × 17,8 mm)', 'middle', 14)}`;
  return svg('0 0 600 380', body, 'Bo mạch XIAO nRF52840 Sense nhìn từ trên');
}

// ---------- imu-axes ----------
function imuAxes() {
  const mx = 'dg-ax-x', my = 'dg-ax-y', mz = 'dg-ax-z';
  const mk = (id, v) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(${v})"/></marker>`;
  const body = `<defs>${mk(mx, '--viz-x')}${mk(my, '--viz-y')}${mk(mz, '--viz-z')}</defs>
  <path d="M40,300 L330,170 L560,170 L300,300 Z" class="dg-arm"/>
  ${label(110, 330, 'cẳng tay (nhìn chéo từ phía trước)', 'start')}
  <path d="M250,250 L330,214 L410,214 L330,250 Z" class="dg-board"/>
  <g class="hs" data-hotspot="axis-x" data-label="Trục X: nghiêng trái / phải"><line x1="330" y1="232" x2="210" y2="232" stroke="var(--viz-x)" stroke-width="6" marker-end="url(#${mx})"/><text x="150" y="226" font-size="18" font-weight="700" fill="var(--viz-x)">X</text><text x="60" y="250" font-size="14" class="dg-sub">nghiêng trái/phải</text></g>
  <g class="hs" data-hotspot="axis-y" data-label="Trục Y: dọc theo cẳng tay"><line x1="330" y1="232" x2="480" y2="165" stroke="var(--viz-y)" stroke-width="6" marker-end="url(#${my})"/><text x="492" y="160" font-size="18" font-weight="700" fill="var(--viz-y)">Y</text><text x="450" y="132" font-size="14" class="dg-sub">dọc cẳng tay</text></g>
  <g class="hs" data-hotspot="axis-z" data-label="Trục Z: hướng lên trên"><line x1="330" y1="232" x2="330" y2="70" stroke="var(--viz-z)" stroke-width="6" marker-end="url(#${mz})"/><text x="342" y="72" font-size="18" font-weight="700" fill="var(--viz-z)">Z</text><text x="342" y="94" font-size="14" class="dg-sub">hướng lên</text></g>
  <circle cx="330" cy="232" r="6" fill="currentColor"/>`;
  return svg('0 0 600 350', body, 'Ba trục X, Y, Z của IMU trên cẳng tay ở tư thế trung tính');
}

// ---------- gesture-map ----------
const GESTURES = [
  { id: 'water', cmd: 'WATER', phrase: 'Tôi muốn uống nước.', how: '← Nghiêng tay trái', icon: '↶', color: '#E4EFF9' },
  { id: 'food', cmd: 'FOOD', phrase: 'Tôi muốn ăn.', how: '→ Nghiêng tay phải', icon: '↷', color: '#F6EFCF' },
  { id: 'no', cmd: 'NO', phrase: 'Không.', how: '↔ Lắc cổ tay', icon: '⇋', color: '#FCEAE5' },
  { id: 'yes', cmd: 'YES', phrase: 'Có.', how: '✌ Gõ 2 lần', icon: '✌', color: '#E3F2DF' },
  { id: 'help', cmd: 'HELP', phrase: 'Tôi cần giúp đỡ.', how: '↕ Hạ cẳng tay rồi nâng lại, 2 lần', short: 'Nhấp cẳng tay 2 lần', icon: '↕', color: '#F7C6C0' },
];
function gestureMap() {
  const m = 'dg-a-gm';
  const rows = GESTURES.map((g, i) => {
    const y = 16 + i * 76;
    return `<g class="hs" data-hotspot="${g.id}" data-label="${esc(g.how)} → ${g.cmd}">
      <rect x="8" y="${y}" width="584" height="64" rx="14" class="dg-row"/>
      <text x="40" y="${y + 41}" text-anchor="middle" font-size="24" class="dg-title" aria-hidden="true">${g.icon}</text>
      <text x="66" y="${y + 38}" font-size="15" class="dg-title">${esc(g.short || g.how.slice(2))}</text>
      ${arrow(m, `M222,${y + 32} L250,${y + 32}`)}
      <rect x="256" y="${y + 14}" width="92" height="36" rx="18" fill="${g.color}" class="dg-chip"/>
      <text x="302" y="${y + 38}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--c-text-on-light)" font-family="var(--mono)">${g.cmd}</text>
      ${arrow(m, `M354,${y + 32} L382,${y + 32}`)}
      <text x="392" y="${y + 38}" font-size="15" class="dg-title">“${esc(g.phrase)}”</text></g>`;
  }).join('');
  return svg('0 0 600 400', defs(m) + rows, 'Năm cử chỉ, mã lệnh và câu nói');
}

// ---------- gatt-tree ----------
function gattTree() {
  const m = 'dg-a-gatt';
  const body = defs(m) +
    box({ id: 'device', label: 'Thiết bị BandW-Sense', title: '📟 BandW-Sense', sub: 'thiết bị (device)', x: 200, y: 10, w: 200, h: 62 }) +
    arrow(m, 'M300,72 L300,96') +
    box({ id: 'service', label: 'Dịch vụ (service) c91b0001', title: 'Service c91b0001-…', sub: 'dịch vụ BandW', x: 170, y: 100, w: 260, h: 62, cls: 'svc' }) +
    arrow(m, 'M240,162 L150,196') + arrow(m, 'M360,162 L450,196') +
    box({ id: 'cmd-char', label: 'Characteristic lệnh c91b0002 (Read + Notify)', title: 'c91b0002 · lệnh', sub: 'Read + Notify, ≤ 8 byte', x: 20, y: 200, w: 260, h: 66, cls: 'chr' }) +
    box({ id: 'ctrl-char', label: 'Characteristic điều khiển c91b0003 (Read/Write/Notify)', title: 'c91b0003 · điều khiển', sub: 'Read/Write/Notify', x: 320, y: 200, w: 260, h: 66, cls: 'chr' }) +
    arrow(m, 'M150,266 L150,290') +
    box({ id: 'cccd', label: 'Descriptor CCCD 0x2902 (công tắc đăng ký)', title: 'CCCD 0x2902', sub: 'công tắc "báo cho tôi"', x: 40, y: 294, w: 220, h: 58, cls: 'dsc' }) +
    label(450, 296, 'app ghi "CALIBRATE"', 'middle') + label(450, 318, 'board báo "CALIBRATING" / "READY"', 'middle');
  return svg('0 0 600 362', body, 'Cây GATT của BandW-Sense');
}

// ---------- tts-chain ----------
function ttsChain() {
  const m = 'dg-a-tts';
  const W = 170, H = 84;
  const N = [
    { id: 'bytes', title: '57 41 54 45 52', sub: 'byte nhận được', x: 10, y: 20 },
    { id: 'parse', title: 'parse()', sub: 'trim + viết hoa', x: 215, y: 20 },
    { id: 'enum', title: 'GestureCommand', sub: '.WATER', x: 420, y: 20 },
    { id: 'phrase', title: '“Tôi muốn', sub: 'uống nước.”', x: 420, y: 160 },
    { id: 'tts', title: 'TextToSpeech', sub: 'vi-VN, tốc độ 0.9', x: 215, y: 160 },
    { id: 'speaker', title: '🔊 Loa', sub: 'phát thành tiếng', x: 10, y: 160 },
  ];
  const labels = { bytes: 'Byte ASCII "WATER"', parse: 'Hàm parse()', enum: 'Enum GestureCommand.WATER', phrase: 'Câu tiếng Việt', tts: 'Bộ đọc TextToSpeech', speaker: 'Loa điện thoại' };
  const body = defs(m) + N.map((n) => box({ ...n, label: labels[n.id], w: W, h: H, cls: n.id === 'bytes' ? 'mono' : '' })).join('') +
    arrow(m, 'M182,62 L211,62') + arrow(m, 'M387,62 L416,62') + arrow(m, 'M505,106 L505,156') +
    arrow(m, 'M418,202 L389,202') + arrow(m, 'M213,202 L184,202');
  return svg('0 0 600 260', body, 'Chuỗi xử lý từ byte WATER đến tiếng nói');
}

// ---------- loop-flow ----------
function loopFlow() {
  const m = 'dg-a-loop';
  const W = 280, x = 160;
  const body = defs(m) +
    box({ id: 'kick', label: 'Cho watchdog ăn (kick)', title: 'Cho watchdog "ăn"', sub: 'NRF_WDT->RR[0]', x, y: 10, w: W, h: 56 }) + arrow(m, 'M300,66 L300,82') +
    box({ id: 'poll', label: 'BLE.poll()', title: 'BLE.poll()', sub: 'xử lý Bluetooth, LED', x, y: 86, w: W, h: 56 }) + arrow(m, 'M300,142 L300,158') +
    `<g class="hs" data-hotspot="wait" data-label="Chưa đủ 20 ms thì delay(1) và return"><path d="M300,162 L420,204 L300,246 L180,204 Z" class="dg-node diamond"/><text x="300" y="200" text-anchor="middle" font-size="15" font-weight="700" class="dg-title">đủ 20 ms?</text><text x="300" y="220" text-anchor="middle" font-size="14" class="dg-sub">now − sampleAt</text>
      <path d="M420,204 L520,204 L520,40 L444,40" class="dg-arrow" marker-end="url(#${m})"/><text x="528" y="128" font-size="14" class="dg-sub">chưa:</text><text x="528" y="146" font-size="14" class="dg-sub">delay(1)</text><text x="528" y="164" font-size="14" class="dg-sub">return</text></g>` +
    label(312, 262, 'rồi', 'start') + arrow(m, 'M300,246 L300,270') +
    box({ id: 'read', label: 'Đọc IMU 6 trục', title: 'Đọc IMU', sub: 'readImu(v): 6 trục', x, y: 274, w: W, h: 56 }) + arrow(m, 'M300,330 L300,346') +
    `<g class="hs" data-hotspot="calib" data-label="Đã hiệu chuẩn chưa?"><path d="M300,350 L420,392 L300,434 L180,392 Z" class="dg-node diamond"/><text x="300" y="397" text-anchor="middle" font-size="15" font-weight="700" class="dg-title">đã hiệu chuẩn?</text>
      <path d="M180,392 L90,392 L90,40 L156,40" class="dg-arrow" marker-end="url(#${m})"/><text x="12" y="372" font-size="14" class="dg-sub">chưa:</text><text x="12" y="392" font-size="14" class="dg-sub">calibrator</text><text x="12" y="410" font-size="14" class="dg-sub">.add()</text></g>` +
    label(312, 450, 'rồi', 'start') + arrow(m, 'M300,434 L300,458') +
    box({ id: 'update', label: 'detector.update()', title: 'detector.update()', sub: 'nhận dạng cử chỉ', x, y: 462, w: W, h: 56 }) + arrow(m, 'M300,518 L300,534') +
    box({ id: 'send', label: 'Gửi lệnh nếu có', title: 'Có lệnh → gửi BLE', sub: 'writeValue("WATER")', x, y: 538, w: W, h: 56 }) +
    `<path d="M440,566 L560,566 L560,24 L444,24" class="dg-arrow dashed" marker-end="url(#${m})"/><text x="566" y="590" font-size="14" text-anchor="end" class="dg-sub">lặp lại mãi</text>`;
  return svg('0 0 600 604', body, 'Lưu đồ hàm loop() của firmware');
}

// ---------- state-machine ----------
function stateMachine() {
  const m = 'dg-a-sm';
  const W = 170, H = 70;
  const S = [
    { id: 'neutral', title: 'Chờ trung tính', sub: '!armed', x: 30, y: 30 },
    { id: 'armed', title: 'Sẵn sàng', sub: 'armed', x: 400, y: 30 },
    { id: 'candidate', title: 'Đang giữ', sub: 'candidate ≠ 0', x: 400, y: 200 },
    { id: 'emit', title: 'Phát lệnh', sub: 'emit()', x: 215, y: 330 },
    { id: 'cooldown', title: 'Nghỉ 650 ms', sub: 'cooling', x: 30, y: 200 },
  ];
  const labels = { neutral: 'Chờ về trung tính', armed: 'Sẵn sàng', candidate: 'Đang giữ tư thế', emit: 'Phát lệnh', cooldown: 'Nghỉ 650 ms' };
  const body = defs(m) + S.map((s) => box({ ...s, label: labels[s.id], w: W, h: H, cls: 'state', rx: 35 })).join('') +
    arrow(m, 'M204,65 L396,65') + label(300, 52, 'trung tính đủ 200 ms') +
    arrow(m, 'M485,104 L485,196') + label(495, 146, 'nghiêng vượt', 'start') + label(495, 164, '22°', 'start') +
    arrow(m, 'M440,274 L360,330') + label(470, 318, 'giữ đủ 250 ms', 'middle') +
    arrow(m, 'M215,350 L130,274') + label(96, 318, 'cooling = true', 'middle') +
    arrow(m, 'M115,196 L115,104') + label(125, 146, 'hết 650 ms', 'start') +
    `<path d="M420,200 C360,170 360,130 410,104" class="dg-arrow dashed" marker-end="url(#${m})"/>` + label(300, 156, 'thả tay sớm', 'middle') + label(300, 174, '(candidate = 0)', 'middle') +
    label(300, 425, 'Mô hình cho lệnh nghiêng; code thật dùng các cờ (flag)', 'middle');
  return svg('0 0 600 436', body, 'Máy trạng thái 5 trạng thái của BandW');
}

const H = (pairs) => pairs.map(([id, label]) => ({ id, label }));

export const NAMED_DIAGRAMS = {
  'system-blocks': { svg: systemBlocks, alt: 'Sơ đồ khối: cổ tay, cảm biến IMU, chip nRF52840, sóng BLE, điện thoại, loa, nối bằng mũi tên theo thứ tự.',
    hotspots: H([['wrist', 'Cổ tay'], ['imu', 'Cảm biến IMU'], ['mcu', 'Vi điều khiển nRF52840'], ['ble', 'Bluetooth Low Energy'], ['phone', 'Điện thoại Android'], ['speaker', 'Loa']]) },
  'xiao-board': { svg: xiaoBoard, alt: 'Bo mạch XIAO nRF52840 Sense nhìn từ trên: cổng USB-C, chip nRF52840, ăng-ten, cảm biến IMU, đèn LED và chân pin ở mặt sau.',
    hotspots: H([['usb', 'Cổng USB-C'], ['mcu', 'Chip nRF52840'], ['imu', 'Cảm biến IMU'], ['led', 'Đèn LED'], ['antenna', 'Ăng-ten'], ['battery', 'Chân pin']]) },
  'imu-axes': { svg: imuAxes, alt: 'Cẳng tay với bo mạch nằm phẳng; trục X đỏ chỉ sang trái/phải, trục Y xanh lá dọc cẳng tay, trục Z xanh dương hướng lên.',
    hotspots: H([['axis-x', 'Trục X'], ['axis-y', 'Trục Y'], ['axis-z', 'Trục Z']]) },
  'gesture-map': { svg: gestureMap, alt: 'Bảng năm cử chỉ: nghiêng trái → WATER → Tôi muốn uống nước; nghiêng phải → FOOD → Tôi muốn ăn; lắc → NO → Không; gõ 2 lần → YES → Có; hạ cẳng tay rồi nâng lại 2 lần → HELP → Tôi cần giúp đỡ.',
    hotspots: H(GESTURES.map((g) => [g.id, `${g.how} → ${g.cmd}`])) },
  'gatt-tree': { svg: gattTree, alt: 'Cây GATT: thiết bị BandW-Sense chứa service c91b0001, gồm characteristic lệnh c91b0002 (Read + Notify, có CCCD 0x2902) và characteristic điều khiển c91b0003.',
    hotspots: H([['device', 'Thiết bị'], ['service', 'Service'], ['cmd-char', 'Characteristic lệnh'], ['ctrl-char', 'Characteristic điều khiển'], ['cccd', 'CCCD 0x2902']]) },
  'tts-chain': { svg: ttsChain, alt: 'Chuỗi xử lý trong app: byte 57 41 54 45 52 → parse() → GestureCommand.WATER → câu Tôi muốn uống nước → TextToSpeech vi-VN → loa.',
    hotspots: H([['bytes', 'Byte nhận được'], ['parse', 'parse()'], ['enum', 'Enum'], ['phrase', 'Câu nói'], ['tts', 'TextToSpeech'], ['speaker', 'Loa']]) },
  'loop-flow': { svg: loopFlow, alt: 'Lưu đồ loop(): cho watchdog ăn, BLE.poll, kiểm tra đủ 20 ms (chưa thì return), đọc IMU, kiểm tra đã hiệu chuẩn, detector.update, gửi lệnh, rồi lặp lại.',
    hotspots: H([['kick', 'Watchdog'], ['poll', 'BLE.poll()'], ['wait', 'Chờ 20 ms'], ['read', 'Đọc IMU'], ['calib', 'Đã hiệu chuẩn?'], ['update', 'detector.update()'], ['send', 'Gửi lệnh']]) },
  'state-machine': { svg: stateMachine, alt: 'Năm trạng thái nối thành vòng: Chờ trung tính → Sẵn sàng → Đang giữ → Phát lệnh → Nghỉ 650 ms → Chờ trung tính; thả tay sớm thì từ Đang giữ quay lại Sẵn sàng.',
    hotspots: H([['neutral', 'Chờ trung tính'], ['armed', 'Sẵn sàng'], ['candidate', 'Đang giữ'], ['emit', 'Phát lệnh'], ['cooldown', 'Nghỉ 650 ms']]) },
};
export const DIAGRAM_NAMES = Object.keys(NAMED_DIAGRAMS);

/** Hotspot ids found in an inline svg string (data-hotspot="…"). */
export function inlineHotspots(svgText) {
  const out = [];
  for (const m of String(svgText || '').matchAll(/data-hotspot="([^"]+)"(?:[^>]*?data-label="([^"]*)")?/g)) out.push({ id: m[1], label: m[2] || m[1] });
  return out;
}

/** Safety check for writer-provided inline SVG. Returns list of problems. */
export function svgProblems(s) {
  const p = [];
  const t = String(s || '');
  if (!/^\s*<svg[\s>]/.test(t)) p.push('phải bắt đầu bằng <svg');
  if (!/viewBox=/.test(t)) p.push('thiếu viewBox');
  if (/<script/i.test(t)) p.push('chứa <script');
  if (/\son[a-z]+\s*=/i.test(t)) p.push('chứa thuộc tính on…=');
  if (/<foreignObject/i.test(t)) p.push('chứa <foreignObject');
  if (/(xlink:)?href\s*=\s*["']\s*(https?:|javascript:)/i.test(t)) p.push('liên kết ngoài');
  return p;
}
