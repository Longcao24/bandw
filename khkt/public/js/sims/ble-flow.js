// ble-flow: advertise → connect → discover GATT → subscribe (CCCD 0x2902) → notify "WATER" → (disconnect).
// The disconnect beat also shows the app's automatic reconnect (BandBleClient BACKOFF_MS): waits of
// 1, 2, 4, 8, 15, 15 s, then every 30 s with no limit, until the user presses "Ngắt kết nối".
import { frame, s, h, attr, fmt, clamp, lerp, ease, easeOut, arrowMarker, asciiBytes, Timeline, timelineHandle } from './_shared.js';
import { COMMANDS, CMD_LIST } from './_model.js';

export const meta = {
  id: 'ble-flow',
  title: 'Bluetooth Low Energy gửi một lệnh',
  timeline: true,
  checkpoints: ['advertise', 'connect', 'discover', 'subscribe', 'notify', 'disconnect', 'end'],
  hotspots: [
    { id: 'band', label: 'Vòng tay' }, { id: 'phone', label: 'Điện thoại' }, { id: 'service', label: 'Dịch vụ (Service) BandW' },
    { id: 'cmd-char', label: 'Characteristic lệnh' }, { id: 'ctrl-char', label: 'Characteristic điều khiển' }, { id: 'cccd', label: 'CCCD 0x2902' }, { id: 'packet', label: 'Gói dữ liệu' },
  ],
  defaults: { phase: 'all', command: 'WATER', showBytes: true, showUuids: false },
};
const U = (n) => `c91b000${n}-7d7a-4f8c-9d29-6e44c786a321`;

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const cmd = CMD_LIST.includes(String(P.command).toUpperCase()) ? String(P.command).toUpperCase() : 'WATER';
  const bytes = asciiBytes(cmd);
  const f = frame(el, {
    id: meta.id, title: meta.title, viewBox: [480, 410],
    alt: `Vòng tay (trái) và điện thoại (phải). Các bước: quảng bá tên BandW-Sense, điện thoại kết nối, khám phá dịch vụ c91b0001, ghi 01 00 vào CCCD 0x2902 để đăng ký, rồi vòng tay gửi thông báo "${cmd}" gồm ${bytes.length} byte ${bytes.join(' ')}. Khi mất kết nối, ứng dụng tự nối lại sau 1, 2, 4, 8, 15, 15 giây rồi cứ 30 giây một lần cho đến khi người dùng bấm Ngắt kết nối.`,
  });
  const { svg, defs } = f;
  const mkL = arrowMarker(defs, 'var(--viz-packet)'), mkG = arrowMarker(defs, 'var(--c-muted)');
  const BX = 62, PX = 418, MY = 100;
  // band
  const band = s('g', { 'data-hotspot': 'band', 'data-label': 'Vòng tay' });
  band.append(s('circle', { cx: BX, cy: MY, r: 40, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 2 }));
  band.append(s('rect', { x: BX - 32, y: MY - 14, width: 64, height: 28, rx: 5, fill: '#1f6fd8' }), s('text', { x: BX, y: MY + 4, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700, fill: '#fff' }, 'nRF52840'));
  band.append(s('text', { x: BX, y: MY + 60, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'Vòng tay'));
  band.append(s('text', { x: BX, y: MY + 77, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted bw-mono' }, 'BandW-Sense'));
  svg.append(band);
  // phone
  const phone = s('g', { 'data-hotspot': 'phone', 'data-label': 'Điện thoại' });
  phone.append(s('rect', { x: PX - 34, y: MY - 58, width: 68, height: 116, rx: 12, fill: '#1b1f27' }));
  const screen = s('rect', { x: PX - 28, y: MY - 46, width: 56, height: 90, rx: 4, fill: '#2b303b' });
  const scrTxt = s('text', { x: PX, y: MY - 4, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700, fill: '#fff' });
  const scrTxt2 = s('text', { x: PX, y: MY + 12, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 700, fill: '#fff' });
  phone.append(screen, scrTxt, scrTxt2, s('text', { x: PX, y: MY + 77, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'Điện thoại'));
  svg.append(phone);
  // radio waves + link
  const waves = [0, 1, 2].map(() => svg.appendChild(s('circle', { cx: BX, cy: MY, fill: 'none', stroke: 'var(--viz-packet)', 'stroke-width': 3, opacity: 0 })));
  const link = s('line', { x1: BX + 44, x2: PX - 38, y1: MY, y2: MY, stroke: 'var(--viz-packet)', 'stroke-width': 3, opacity: 0 });
  const cut = s('text', { x: (BX + PX) / 2, y: MY + 8, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: 'var(--c-danger)', opacity: 0 }, '✕');
  svg.append(link, cut);
  const msg = s('g', { opacity: 0 });
  const msgLine = s('line', { stroke: 'var(--c-muted)', 'stroke-width': 2.5, 'marker-end': mkG });
  const msgTxt = s('text', { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 });
  msg.append(msgLine, msgTxt); svg.append(msg);
  // packet
  const pkt = s('g', { 'data-hotspot': 'packet', 'data-label': 'Gói dữ liệu', opacity: 0 });
  const pktR = s('rect', { y: -16, height: 32, rx: 16, fill: 'var(--viz-packet)' });
  const pktT = s('text', { x: 0, y: 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, fill: '#fff', class: 'bw-mono' });
  pkt.append(pktR, pktT); svg.append(pkt);
  const byteG = s('g', { opacity: 0 });
  const byteEls = bytes.map((b, i) => {
    const x = 240 - (bytes.length * 46) / 2 + i * 46;
    const g = s('g');
    g.append(s('rect', { x, y: 150, width: 40, height: 46, rx: 6, fill: 'var(--c-surface-2)', stroke: 'var(--viz-packet)', 'stroke-width': 2 }));
    g.append(s('text', { x: x + 20, y: 169, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'bw-mono' }, b));
    g.append(s('text', { x: x + 20, y: 189, 'text-anchor': 'middle', 'font-size': 13, class: 't-muted bw-mono' }, cmd[i]));
    byteG.append(g); return g;
  });
  if (P.showBytes) svg.append(byteG);
  // GATT tree
  const tree = s('g');
  const node = (id, label, x, y, w, l1, l2) => {
    const g = s('g', { 'data-hotspot': id, 'data-label': label, opacity: 0 });
    g.append(s('rect', { x, y, width: w, height: 46, rx: 8, class: 'node' }));
    g.append(s('text', { x: x + 8, y: y + 19, 'font-size': 13, 'font-weight': 700 }, l1));
    // A full 36-char UUID does not fit a node; show 'c91b0001-…-6e44c786a321' and keep the full value
    // in a tooltip (<title>) so the text never runs out of its box or under the connector.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l2);
    const shown = isUuid ? `${l2.slice(0, 8)}-…-${l2.slice(24)}` : l2;
    const t2 = s('text', { x: x + 8, y: y + 36, 'font-size': P.showUuids ? 9.5 : 11.5, class: 't-muted bw-mono' }, shown);
    if (isUuid) g.prepend(s('title', {}, `${label}: ${l2}`));
    g.append(t2);
    tree.append(g); return g;
  };
  svg.append(s('text', { x: 14, y: 232, 'font-size': 13, 'font-weight': 700, class: 't-muted' }, 'Cấu trúc GATT của vòng tay'));
  const tDev = node('band-tree', 'Thiết bị', 10, 244, 112, 'Thiết bị', 'BandW-Sense'); tDev.removeAttribute('data-hotspot');
  const tSvc = node('service', 'Dịch vụ (Service) BandW', 132, 244, 150, 'Dịch vụ BandW', P.showUuids ? U(1) : 'c91b0001…');
  const tCmd = node('cmd-char', 'Characteristic lệnh', 292, 244, 180, 'Lệnh · Read, Notify', P.showUuids ? U(2) : 'c91b0002… (≤ 8 byte)');
  const tCtl = node('ctrl-char', 'Characteristic điều khiển', 292, 352, 180, 'Điều khiển · R/W/Notify', P.showUuids ? U(3) : 'c91b0003… CALIBRATE');
  const cccd = s('g', { 'data-hotspot': 'cccd', 'data-label': 'CCCD 0x2902', opacity: 0 });
  cccd.append(s('rect', { x: 292, y: 298, width: 180, height: 46, rx: 8, class: 'node' }), s('text', { x: 300, y: 317, 'font-size': 13, 'font-weight': 700 }, 'CCCD 0x2902'));
  const sw = s('rect', { x: 412, y: 306, width: 48, height: 26, rx: 13, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 2 });
  const knob = s('circle', { cy: 319, r: 10, fill: 'var(--c-muted)' });
  const swT = s('text', { x: 300, y: 336, 'font-size': 11.5, class: 't-muted bw-mono' }, 'tắt (00 00)');
  cccd.append(sw, knob, swT); tree.append(cccd);
  // Connectors are revealed together with the node they lead to (no stray bracket ticks on an empty panel).
  const links = [[122, 267, 132, 267], [282, 267, 292, 267], [282, 267, 287, 267, 287, 321, 292, 321], [287, 321, 287, 375, 292, 375]]
    .map((p) => tree.appendChild(s('polyline', { points: p.join(','), fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 2, opacity: 0 })));
  svg.append(tree);
  // reconnect backoff strip (disconnect beat)
  const BACKOFF = ['1', '2', '4', '8', '15', '15', '30', '30', '…'];
  const boG = s('g', { opacity: 0 });
  const BW = 25, BS = 28.5, BX0 = 240 - (BACKOFF.length * BS - 3.5) / 2;
  boG.append(s('text', { x: 240, y: 150, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'Ứng dụng tự thử nối lại sau (giây):'));
  const boxes = BACKOFF.map((v, i) => {
    const r = s('rect', { x: BX0 + i * BS, y: 158, width: BW, height: 24, rx: 5, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 1.5 });
    const t = s('text', { x: BX0 + i * BS + BW / 2, y: 175, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, class: 'bw-mono' }, v);
    boG.append(r, t); return { r, t };
  });
  const boNote = s('text', { x: 240, y: 200, 'text-anchor': 'middle', 'font-size': 11.5, class: 't-muted' }, 'rồi cứ 30 giây một lần, đến khi bấm "Ngắt kết nối"');
  boG.append(boNote); svg.append(boG);

  const ALL = [
    { id: 'advertise', dur: 3000, caption: 'Quảng bá: vòng tay liên tục phát tên "BandW-Sense" kèm mã dịch vụ. Điện thoại quét (8 giây) và lọc theo mã đó.' },
    { id: 'connect', dur: 2400, caption: 'Kết nối: điện thoại gửi yêu cầu, vòng tay đồng ý. Hai bên giữ một đường liên lạc riêng.' },
    { id: 'discover', dur: 3000, caption: 'Khám phá dịch vụ: điện thoại đọc "cây" GATT: dịch vụ BandW chứa 2 characteristic.' },
    { id: 'subscribe', dur: 2800, caption: 'Đăng ký: điện thoại ghi 01 00 vào CCCD 0x2902 = bật công tắc "báo cho tôi khi có lệnh".' },
    { id: 'notify', dur: 3400, caption: `Thông báo (notify): có cử chỉ → vòng tay tự đẩy "${cmd}" (${bytes.length} byte ASCII ${bytes.join(' ')}) sang điện thoại.` },
    { id: 'disconnect', dur: 7000, caption: 'Mất kết nối (ví dụ đi quá xa): lệnh làm lúc này không được lưu lại. Vòng tay quảng bá lại; ứng dụng tự nối lại sau 1, 2, 4, 8, 15, 15 giây, rồi cứ 30 giây một lần, không giới hạn số lần, đến khi người dùng bấm "Ngắt kết nối". Tắt màn hình không làm ngắt (ứng dụng giữ kết nối bằng dịch vụ chạy nền).' },
  ];
  const sel = P.phase === 'all' ? ALL : ALL.filter((b) => b.id === P.phase);
  const beats = [...(sel.length ? sel : ALL), { id: 'end', dur: 500, caption: 'Gói tin chỉ là vài byte chữ; câu tiếng Việt nằm trong ứng dụng.' }];
  const idx = (id) => ALL.findIndex((b) => b.id === id);
  const firstPhase = idx(beats[0].id);

  const render = ({ beat, t01 }) => {
    const ph = beat.id === 'end' ? idx(beats[beats.length - 2].id) + 0.999 : idx(beat.id) + t01;
    const at = (id) => ph - idx(id); // <0 not yet, 0..1 during, >1 done
    const done = (id) => at(id) >= 1 || (firstPhase > idx(id) && id !== 'disconnect');
    // waves (advertise, and again after disconnect)
    const dc = at('disconnect'), lost = dc > 0.1, back = dc > 0.88;
    const tries = clamp(Math.floor((dc - 0.18) / 0.7 * 4), 0, 3); // demo: back in range at the 4th try
    const adv = (at('advertise') >= 0 && at('advertise') < 1) || (dc > 0.3 && !back);
    waves.forEach((w, k) => { const u = ((t01 * 3 + k / 3) % 1); attr(w, { r: 44 + u * 120, opacity: adv ? 0.6 * (1 - u) : 0 }); });
    const connected = (at('connect') > 0.7 || done('connect')) && !(lost && !back);
    attr(link, { opacity: connected ? 0.8 : 0, 'stroke-dasharray': connected ? 'none' : '6 6' });
    cut.setAttribute('opacity', lost && !back ? 1 : 0);
    boG.setAttribute('opacity', dc > 0.15 ? 1 : 0);
    boxes.forEach(({ r, t }, i) => {
      const cur = !back && i === tries, past = back ? i <= tries : i < tries;
      attr(r, { fill: cur ? 'var(--c-primary)' : past ? 'var(--c-surface-2)' : 'var(--c-surface)', stroke: cur ? 'var(--c-primary)' : 'var(--c-border)' });
      t.setAttribute('fill', cur ? '#fff' : past ? 'var(--c-muted)' : 'var(--c-text)');
    });
    boNote.textContent = back ? `Nối lại được ở lần thử ${tries + 1} ✓ (vòng tay đã ở gần)` : 'rồi cứ 30 giây một lần, đến khi bấm "Ngắt kết nối"';
    // phone screen
    let l1 = '', l2 = '', scr = '#2b303b';
    if (at('advertise') >= 0 && at('advertise') < 1) { l1 = 'Đang quét…'; l2 = at('advertise') > 0.5 ? 'thấy BandW' : ''; }
    else if (connected && at('notify') < 0.75) { l1 = 'Đã kết nối'; l2 = done('subscribe') || at('subscribe') > 0.7 ? 'đã đăng ký' : ''; }
    if (at('notify') >= 0.75 && !lost) { l1 = cmd; l2 = '→ đọc câu'; scr = COMMANDS[cmd].color; }
    if (lost) { l1 = back ? 'Đã nối lại' : dc < 0.18 ? 'Mất kết nối' : 'Nối lại…'; l2 = back ? 'đăng ký lại' : dc < 0.18 ? '' : `lần ${tries + 1}`; }
    screen.setAttribute('fill', scr);
    [scrTxt, scrTxt2].forEach((t) => t.setAttribute('fill', scr === '#2b303b' ? '#fff' : '#21242c'));
    scrTxt.textContent = l1; scrTxt2.textContent = l2;
    // messages
    let m = null;
    if (at('connect') >= 0 && at('connect') < 1) m = at('connect') < 0.5 ? { from: PX - 40, to: BX + 46, y: MY - 24, t: 'yêu cầu kết nối' } : { from: BX + 46, to: PX - 40, y: MY - 24, t: 'đồng ý ✓' };
    if (at('discover') >= 0 && at('discover') < 1) m = { from: PX - 40, to: BX + 46, y: MY - 24, t: 'có những dịch vụ nào?' };
    if (m) { attr(msg, { opacity: 1 }); attr(msgLine, { x1: m.from, x2: m.to, y1: m.y, y2: m.y }); attr(msgTxt, { x: (m.from + m.to) / 2, y: m.y - 8 }); msgTxt.textContent = m.t; }
    else msg.setAttribute('opacity', 0);
    // tree reveal
    const dv = at('discover');
    const reveal = (g, th) => g.setAttribute('opacity', dv >= th || done('discover') ? 1 : P.phase === 'notify' || P.phase === 'subscribe' ? 1 : 0);
    reveal(tDev, 0.1); reveal(tSvc, 0.3); reveal(tCmd, 0.5); reveal(cccd, 0.65); reveal(tCtl, 0.8);
    [tSvc, tCmd, cccd, tCtl].forEach((n, k) => links[k].setAttribute('opacity', n.getAttribute('opacity')));
    const on = at('subscribe') > 0.6 || done('subscribe') || ['notify'].includes(P.phase);
    const subOn = on && !(lost && !back);
    attr(sw, { fill: subOn ? 'var(--c-success)' : 'var(--c-surface-2)' }); attr(knob, { cx: subOn ? 447 : 425, fill: subOn ? '#fff' : 'var(--c-muted)' });
    swT.textContent = subOn ? 'bật (01 00) ✓' : 'tắt (00 00)';
    // packets
    let pk = null;
    if (at('advertise') >= 0 && at('advertise') < 1) { const u = (t01 * 2) % 1; pk = { x: lerp(BX + 50, PX - 50, easeOut(u)), y: MY + 36, t: 'BandW-Sense', c: '#5b616e' }; }
    if (at('subscribe') >= 0 && at('subscribe') < 0.8) { const u = clamp(at('subscribe') / 0.7, 0, 1); pk = { x: lerp(PX - 50, BX + 60, ease(u)), y: MY + 36, t: 'ghi 01 00 → 0x2902', c: '#2f9e44' }; }
    if (at('notify') >= 0 && at('notify') < 1) { const u = clamp((at('notify') - 0.1) / 0.6, 0, 1); pk = { x: lerp(BX + 50, PX - 50, ease(u)), y: MY + 36, t: `"${cmd}"`, c: 'var(--viz-packet)' }; }
    if (beat.id === 'end' && (P.phase === 'notify' || P.phase === 'all')) pk = null;
    if (pk) { pktT.textContent = pk.t; const w = pk.t.length * 8.4 + 22; attr(pktR, { x: -w / 2, width: w, fill: pk.c }); attr(pkt, { transform: `translate(${pk.x},${pk.y})`, opacity: 1 }); }
    else pkt.setAttribute('opacity', 0);
    const showB = at('notify') >= 0.15 && at('notify') < 1.6 && !(dc > 0.12);
    byteG.setAttribute('opacity', showB ? 1 : 0);
    byteEls.forEach((g, i) => g.setAttribute('opacity', at('notify') >= 0.15 + i * 0.08 ? 1 : 0));
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => (tl.has('notify') ? tl.targetOf('notify') - (beats.find((b) => b.id === 'notify').dur * 0.6) : tl.targetOf('end')) });
}
