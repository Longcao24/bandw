// tts-pipeline: bytes "WATER" → parse() → GestureCommand.WATER → phrase card → TextToSpeech (vi-VN, 0,9×) → loa.
import { frame, s, h, attr, clamp, ease, easeOut, arrowMarker, asciiBytes, chipButtons, listenButton, Timeline, timelineHandle } from './_shared.js';
import { COMMANDS, CMD_LIST } from './_model.js';

export const meta = {
  id: 'tts-pipeline',
  title: 'Từ chữ "WATER" đến giọng nói',
  timeline: true,
  checkpoints: ['receive', 'parse', 'display', 'speak', 'flush', 'ignored', 'end'],
  hotspots: [{ id: 'bytes', label: 'Các byte nhận được' }, { id: 'parse', label: 'Hàm parse()' }, { id: 'enum', label: 'Giá trị enum GestureCommand' }, { id: 'phrase', label: 'Thẻ câu nói' }, { id: 'tts', label: 'Bộ đọc TextToSpeech' }, { id: 'speaker', label: 'Loa' }],
  defaults: { command: 'WATER', allowPick: true, showInvalid: false, showQueueFlush: false },
};
const parse = (raw) => { const k = String(raw).trim().toUpperCase(); return CMD_LIST.includes(k) ? k : null; }; // like GestureCommand.parse

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  let cmd = parse(P.command) || 'WATER';
  const narrow = (el.clientWidth || 600) < 520;
  const BW = 140, BH = 112;
  const POS = narrow ? [[10, 16], [170, 16], [170, 176], [10, 176], [10, 336], [170, 336]] : [[10, 20], [170, 20], [330, 20], [330, 210], [170, 210], [10, 210]];
  const f = frame(el, {
    id: meta.id, title: meta.title, viewBox: narrow ? [320, 470] : [480, 340],
    alt: 'Chuỗi xử lý trong ứng dụng: các byte nhận qua Bluetooth → parse() (bỏ khoảng trắng, viết hoa, tìm trong danh sách) → giá trị GestureCommand → thẻ câu tiếng Việt → TextToSpeech tiếng Việt tốc độ 0,9 → loa. Chuỗi lạ bị bỏ qua.',
  });
  const { svg, defs } = f;
  const mk = arrowMarker(defs, 'var(--c-muted)');
  const ids = ['bytes', 'parse', 'enum', 'phrase', 'tts', 'speaker'];
  const titles = ['Nhận byte', 'parse()', 'Lệnh (enum)', 'Hiện câu', 'TextToSpeech', 'Loa'];
  const edges = [];
  for (let k = 0; k < 5; k++) {
    const [ax, ay] = POS[k], [bx, by] = POS[k + 1];
    const d = ay === by ? (ax < bx ? `M${ax + BW},${ay + BH / 2} L${bx},${by + BH / 2}` : `M${ax},${ay + BH / 2} L${bx + BW},${by + BH / 2}`) : `M${ax + BW / 2},${ay + BH} L${bx + BW / 2},${by}`;
    edges.push(svg.appendChild(s('path', { d, class: 'edge', 'marker-end': mk })));
  }
  const N = ids.map((id, k) => {
    const [x, y] = POS[k];
    const g = s('g', { 'data-hotspot': id, 'data-label': meta.hotspots[k].label });
    const r = s('rect', { x, y, width: BW, height: BH, rx: 14, class: 'node' });
    g.append(r, s('text', { x: x + BW / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: k === 1 ? 'bw-mono' : '' }, titles[k]));
    const body = s('g'); g.append(body); svg.append(g);
    return { g, r, body, x, y };
  });
  // bodies
  const bytesT1 = s('text', { x: N[0].x + 70, y: N[0].y + 56, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'bw-mono' });
  const bytesT2 = s('text', { x: N[0].x + 70, y: N[0].y + 84, 'text-anchor': 'middle', 'font-size': 15, class: 'bw-mono t-muted' });
  N[0].body.append(bytesT1, bytesT2);
  const pSteps = ['trim()', 'toUpperCase()', 'valueOf()'].map((t, i) => { const tt = s('text', { x: N[1].x + 14, y: N[1].y + 48 + i * 22, 'font-size': 13, class: 'bw-mono' }, `· ${t}`); N[1].body.append(tt); return tt; });
  const enumT = s('text', { x: N[2].x + 70, y: N[2].y + 62, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'bw-mono' });
  N[2].body.append(s('text', { x: N[2].x + 70, y: N[2].y + 42, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted bw-mono' }, 'GestureCommand.'), enumT);
  const enumBad = s('text', { x: N[2].x + 70, y: N[2].y + 90, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, fill: 'var(--c-danger)' });
  N[2].body.append(enumBad);
  const card = s('rect', { x: N[3].x + 10, y: N[3].y + 32, width: 120, height: 66, rx: 10, stroke: 'rgba(0,0,0,.2)', opacity: 0 });
  const cardT = s('text', { x: N[3].x + 70, y: N[3].y + 62, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 't-on-light', opacity: 0 });
  const cardT2 = s('text', { x: N[3].x + 70, y: N[3].y + 82, 'text-anchor': 'middle', 'font-size': 11.5, class: 't-on-light', opacity: 0 });
  N[3].body.append(card, cardT, cardT2);
  const gear = s('text', { x: N[4].x + 70, y: N[4].y + 66, 'text-anchor': 'middle', 'font-size': 30 }, '⚙');
  N[4].body.append(gear, s('text', { x: N[4].x + 70, y: N[4].y + 94, 'text-anchor': 'middle', 'font-size': 12, class: 't-muted' }, 'vi-VN · tốc độ 0,9'));
  const spk = N[5];
  spk.body.append(s('path', { d: `M${spk.x + 36},${spk.y + 50} h14 l18,-14 v58 l-18,-14 h-14 z`, fill: 'var(--c-text)' }));
  const waves = [0, 1, 2].map((k) => spk.body.appendChild(s('path', { d: `M${spk.x + 78 + k * 11},${spk.y + 46 - k * 6} q${10 + k * 4},${20 + k * 6} 0,${40 + k * 12}`, fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 })));
  const said = s('text', { x: spk.x + 70, y: spk.y + 104, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700 }); spk.body.append(said);

  // controls: pick + listen
  const listen = listenButton(COMMANDS[cmd].phrase, { label: '🔊 Nghe thử' });
  if (P.allowPick) f.panel.append(chipButtons(CMD_LIST.map((c) => ({ value: c, label: c, color: COMMANDS[c].color })), { value: cmd, label: 'Chọn lệnh', onPick: (v) => { cmd = v; listen.setText(COMMANDS[cmd].phrase); build(); } }).el);
  f.panel.append(listen.el);

  let beats;
  const second = () => CMD_LIST[(CMD_LIST.indexOf(cmd) + 1) % CMD_LIST.length];
  const build = () => {
    beats = [
      { id: 'receive', dur: 2000, caption: `Ứng dụng nhận ${cmd.length} byte qua Bluetooth và đổi thành chữ "${cmd}".` },
      { id: 'parse', dur: 2400, caption: 'GestureCommand.parse(): bỏ khoảng trắng, viết hoa, rồi tìm tên đó trong danh sách 5 lệnh.' },
      { id: 'display', dur: 2000, caption: `Tìm thấy GestureCommand.${cmd} → hiện câu "${COMMANDS[cmd].phrase}" bằng chữ lớn.` },
      { id: 'speak', dur: 2800, caption: 'TextToSpeech đọc câu bằng giọng tiếng Việt (vi-VN), tốc độ 0,9 cho dễ nghe.' },
    ];
    if (P.showQueueFlush) beats.push({ id: 'flush', dur: 3000, caption: `Lệnh mới "${second()}" đến khi đang đọc: QUEUE_FLUSH cắt câu cũ và đọc ngay câu mới.` });
    if (P.showInvalid) beats.push({ id: 'ignored', dur: 3000, caption: 'Nhận chữ lạ "HELLO": parse() trả về null → ứng dụng bỏ qua, không đọc gì.' });
    beats.push({ id: 'end', dur: 500, caption: 'Câu tiếng Việt nằm trong ứng dụng (GestureCommand.java), không nằm trong vòng tay.' });
    if (tl) { tl.pause(); tl.setBeats(beats); tl.T = 0; tl._emit('rebuild'); tl.render(); f.setCaption(beats[0].caption); }
  };
  let tl = null;
  build();

  const render = ({ beat, t01 }) => {
    const order = ['receive', 'parse', 'display', 'speak'];
    let stage = order.indexOf(beat.id); // 0..3
    if (beat.id === 'end') stage = 4;
    const flush = beat.id === 'flush', bad = beat.id === 'ignored';
    const cur = flush ? second() : cmd;
    const raw = bad ? 'HELLO' : cur;
    const u = flush || bad ? t01 : 1;
    // which node is active
    let act = stage === 0 ? 0 : stage === 1 ? 1 : stage === 2 ? (t01 < 0.5 ? 2 : 3) : stage === 3 ? (t01 < 0.4 ? 4 : 5) : -1;
    if (flush) act = t01 < 0.2 ? 0 : t01 < 0.4 ? 1 : t01 < 0.55 ? 3 : 5;
    if (bad) act = t01 < 0.3 ? 0 : 1;
    N.forEach((n, k) => n.r.setAttribute('class', `node${k === act ? ' is-active' : ''}${bad && k === 1 && t01 > 0.5 ? ' is-cool' : ''}`));
    edges.forEach((e, k) => e.setAttribute('class', `edge${k === act - 1 ? ' is-active' : ''}`));
    const reached = (k) => flush || bad ? true : stage > k || (stage === k);
    bytesT1.textContent = asciiBytes(raw).join(' ');
    bytesT2.textContent = `"${raw}"`;
    const pp = bad ? clamp((t01 - 0.3) / 0.5, 0, 1) * 3 : stage === 1 ? t01 * 3 : stage > 1 ? 3 : 0;
    pSteps.forEach((t, i) => { const okk = pp > i + 0.5; t.textContent = `${okk ? (bad && i === 2 ? '✗' : '✓') : '·'} ${['trim()', 'toUpperCase()', 'valueOf()'][i]}`; t.setAttribute('fill', okk ? (bad && i === 2 ? 'var(--c-danger)' : 'var(--c-success)') : 'var(--c-muted)'); });
    enumT.textContent = bad ? (t01 > 0.8 ? 'null' : '…') : (stage >= 2 || flush ? cur : '…');
    enumBad.textContent = bad && t01 > 0.8 ? '→ bỏ qua' : '';
    const showCard = !bad && (stage >= 2 && (stage > 2 || t01 > 0.4)) || flush || (bad);
    const cc = flush && t01 < 0.5 ? cmd : cur;
    attr(card, { opacity: showCard ? 1 : 0, fill: COMMANDS[bad ? cmd : cc].color });
    [cardT, cardT2].forEach((t) => t.setAttribute('opacity', showCard ? 1 : 0));
    cardT.textContent = COMMANDS[bad ? cmd : cc].phrase; cardT2.textContent = COMMANDS[bad ? cmd : cc].label;
    const speaking = (stage === 3 && t01 > 0.35) || stage === 4 || (flush);
    waves.forEach((w, k) => w.setAttribute('opacity', speaking && !bad ? ((Math.floor(t01 * 10) + k) % 3 === 0 ? 1 : 0.35) : 0));
    if (flush) {
      said.textContent = t01 < 0.5 ? `“${COMMANDS[cmd].phrase.slice(0, Math.max(3, Math.floor(t01 * 2 * COMMANDS[cmd].phrase.length * 0.6)))}—”` : `“${COMMANDS[cur].phrase}”`;
      said.setAttribute('text-decoration', 'none');
      said.setAttribute('fill', t01 < 0.5 ? 'var(--c-danger)' : 'var(--c-text)');
    } else { said.textContent = speaking && !bad ? `“${COMMANDS[cmd].phrase}”` : ''; said.setAttribute('fill', 'var(--c-text)'); }
    gear.setAttribute('transform', speaking ? `rotate(${t01 * 360} ${N[4].x + 70} ${N[4].y + 56})` : '');
  };
  tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.targetOf('speak') - 200, extraDestroy: () => listen.destroy() });
}
