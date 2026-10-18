// gesture-gallery: five gesture cards with looping mini animations, command and phrase; tap to enlarge + listen.
import { frame, h, s, attr, wristCross, armSide, clamp, ease, ticker, listenButton, staticHandle, isReduced } from './_shared.js';
import { COMMANDS, CMD_LIST } from './_model.js';

export const meta = {
  id: 'gesture-gallery',
  title: 'Năm cử chỉ, năm câu nói',
  timeline: false,
  checkpoints: [],
  hotspots: [{ id: 'water', label: 'Nghiêng trái: WATER' }, { id: 'food', label: 'Nghiêng phải: FOOD' }, { id: 'no', label: 'Lắc cổ tay: NO' }, { id: 'yes', label: 'Gõ 2 lần: YES' }, { id: 'help', label: 'Nhấp cẳng tay 2 lần: HELP' }],
  defaults: { showCommands: true, showPhrases: true },
};

const HOW = { WATER: 'nghiêng trái > 22°, giữ 250 ms', FOOD: 'nghiêng phải > 22°, giữ 250 ms', NO: '3 lần lắc đổi chiều trong 900 ms', YES: 'gõ 2 lần khi tay yên', HELP: 'nhấp cẳng tay > 25° rồi về, 2 lần trong 2 s' };

function mini(svg, cmd) {
  const isHelp = cmd === 'HELP';
  const pose = isHelp ? armSide(svg, { ex: 34, ey: 70, len: 92, k: 0.55 }) : wristCross(svg, { cx: 100, cy: 112, r: 46, label: false });
  const rip = [0, 1].map(() => svg.appendChild(s('circle', { cx: 100, cy: 60, r: 0, fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 4, opacity: 0 })));
  const arrow = s('text', { x: 100, y: 190, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 700, fill: 'var(--c-primary)' }, ({ WATER: '↶ trái', FOOD: 'phải ↷', NO: '↶ ↷ ↶', YES: '✌ ✌', HELP: '↕ ↕' })[cmd]);
  svg.append(arrow);
  return (t, still) => { // t in seconds
    const T = 2.4, u = (t % T) / T;
    const hold = still ? 1 : u < 0.3 ? ease(u / 0.3) : u < 0.7 ? 1 : 1 - ease((u - 0.7) / 0.3);
    if (cmd === 'WATER') pose.set(-35 * hold);
    else if (cmd === 'FOOD') pose.set(35 * hold);
    else if (cmd === 'NO') pose.set(still ? 20 : 24 * Math.sin(u * Math.PI * 6) * (u < 0.75 ? 1 : 0));
    else if (cmd === 'HELP') {
      // two quick dips (≈ 0.5 s each, out past 25° and straight back), then a pause: never a held pose
      const bump = (a, b) => (u >= a && u < b ? Math.sin(Math.PI * (u - a) / (b - a)) : 0);
      const d1 = bump(0.08, 0.3), d2 = bump(0.38, 0.6);
      pose.set(still ? 40 : 40 * Math.max(d1, d2));
      arrow.textContent = still ? '↕ ↕' : u < 0.34 ? '↕ 1' : u < 0.64 ? '↕ 1 ↕ 2' : 'HELP ✓';
    }
    else pose.set(0);
    rip.forEach((c, k) => {
      if (cmd !== 'YES') return;
      const age = still ? (k ? 0.12 : 0.3) : u - (0.2 + k * 0.18);
      const on = age >= 0 && age < 0.3;
      attr(c, { r: on ? 8 + age * 120 : 0, opacity: on ? 1 - age / 0.3 : 0 });
    });
  };
}

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const reduced = isReduced(ctx);
  const f = frame(el, { id: meta.id, title: meta.title, viewBox: [10, 10], alt: 'Năm thẻ: nghiêng trái = WATER "Tôi muốn uống nước.", nghiêng phải = FOOD "Tôi muốn ăn.", lắc cổ tay = NO "Không.", gõ 2 lần = YES "Có.", hạ cẳng tay rồi nâng lại 2 lần = HELP "Tôi cần giúp đỡ."' });
  f.stage.innerHTML = '';
  f.stage.classList.add('is-table');
  const grid = h('div', { class: 'bw-gal' });
  const big = h('div', { class: 'bw-gal__big', hidden: true });
  const anims = [];
  let open = null, bigAnim = null;
  const listen = listenButton('', { label: '🔊 Nghe' });
  const bigSvg = s('svg', { viewBox: '0 0 200 200', role: 'img' });
  const bigTitle = h('h4'), bigPhrase = h('p'), bigHow = h('p', { class: 'bw-gal__how' });
  big.append(bigSvg, h('div', {}, bigTitle, bigPhrase, bigHow, listen.el));
  const cards = CMD_LIST.map((cmd) => {
    const c = COMMANDS[cmd];
    const svg = s('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' });
    anims.push(mini(svg, cmd));
    const card = h('button', { type: 'button', class: `bw-gal__card${P.highlight === cmd ? ' is-hl' : ''}`, 'data-hotspot': cmd.toLowerCase(), 'data-label': `${c.gesture}: ${cmd}`, 'aria-expanded': 'false', 'aria-label': `${c.gesture}: lệnh ${cmd}, câu “${c.phrase}”` },
      svg, P.showCommands ? h('span', { class: 'bw-gal__cmd', style: { background: c.color } }, cmd) : null,
      h('span', { class: 'bw-gal__how' }, c.label), P.showPhrases ? h('span', { class: 'bw-gal__phrase' }, `“${c.phrase}”`) : null);
    card.addEventListener('click', () => { if (!f.root.classList.contains('is-hotspot')) toggle(cmd, card); });
    grid.append(card); return card;
  });
  const toggle = (cmd, card) => {
    const same = open === cmd;
    cards.forEach((c) => c.setAttribute('aria-expanded', 'false'));
    if (same) { open = null; big.hidden = true; return; }
    open = cmd; card.setAttribute('aria-expanded', 'true'); big.hidden = false;
    bigSvg.innerHTML = ''; bigAnim = mini(bigSvg, cmd);
    const c = COMMANDS[cmd];
    bigTitle.textContent = `${c.gesture} → ${cmd}`; bigPhrase.textContent = `Điện thoại nói: “${c.phrase}”`; bigHow.textContent = `Cách vòng tay nhận: ${HOW[cmd]}.`;
    bigSvg.setAttribute('aria-label', `${c.gesture}`);
    listen.setText(c.phrase);
    if (reduced) bigAnim(0, true);
    f.setCaption(`${c.gesture}: ${HOW[cmd]}. Bấm 🔊 Nghe để nghe câu.`);
  };
  f.stage.append(grid, big);
  if (P.highlight && CMD_LIST.includes(P.highlight)) toggle(P.highlight, cards[CMD_LIST.indexOf(P.highlight)]);
  f.setCaption(open ? f.caption.textContent : 'Chạm vào một thẻ để xem lớn và nghe câu nói.');
  let t = 0;
  const loop = ticker((dt) => { t += dt / 1000; anims.forEach((a, i) => a(t + i * 0.37, false)); bigAnim?.(t, false); });
  anims.forEach((a) => a(0, true));
  if (!reduced) loop.start();
  return staticHandle({ f, start: () => { if (!reduced) loop.start(); }, stop: () => loop.stop(), extraDestroy: () => listen.destroy() });
}
