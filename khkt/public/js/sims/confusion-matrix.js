// confusion-matrix: rows = intended gesture, columns = detected (+ "Không nhận"). Trials fill in one by one.
import { frame, h, s, attr, fmt, clamp, Timeline, timelineHandle } from './_shared.js';
import { rng, COMMANDS, CMD_LIST } from './_model.js';

const DEMO = { WATER: [18, 0, 0, 0, 0, 2], FOOD: [1, 19, 0, 0, 0, 0], NO: [0, 0, 17, 1, 0, 2], YES: [0, 0, 0, 18, 0, 2], HELP: [0, 3, 0, 0, 16, 1] };
const NAME = { WATER: 'WATER', FOOD: 'FOOD', NO: 'NO', YES: 'YES', HELP: 'HELP', NONE: 'Không nhận' };

export const meta = {
  id: 'confusion-matrix',
  title: 'Ma trận nhầm lẫn',
  timeline: true,
  checkpoints: ['row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'totals', 'end'],
  hotspots: [
    { id: 'diag', label: 'Đường chéo (nhận đúng)' },
    ...CMD_LIST.map((c) => ({ id: `row-${c}`, label: `Hàng ${c}` })),
    ...CMD_LIST.map((c) => ({ id: `col-${c}`, label: `Cột ${c}` })), { id: 'col-NONE', label: 'Cột Không nhận' },
    ...CMD_LIST.flatMap((r) => [...CMD_LIST, 'NONE'].map((c) => ({ id: `cell-${r}-${c}`, label: `Làm ${r}, máy nhận ${NAME[c]}` }))),
  ],
  defaults: { data: 'demo', trialsPerGesture: 20, gestures: CMD_LIST, includeNone: true },
};

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const G = (Array.isArray(P.gestures) && P.gestures.length ? P.gestures : CMD_LIST).filter((g) => CMD_LIST.includes(g));
  const cols = P.includeNone ? [...G, 'NONE'] : [...G];
  const demo = P.data === 'demo' || !Array.isArray(P.data);
  const M = G.map((g, i) => {
    if (!demo) return cols.map((_, j) => Math.max(0, Math.round(Number(P.data[i]?.[j]) || 0)));
    const full = DEMO[g]; const order = [...CMD_LIST, 'NONE'];
    return cols.map((c) => full[order.indexOf(c)] || 0);
  });
  const f = frame(el, { id: meta.id, title: P.label || meta.title, viewBox: [10, 10], alt: `Bảng ${G.length} hàng (cử chỉ đã làm) × ${cols.length} cột (lệnh máy nhận được). Ô trên đường chéo là nhận đúng.${demo ? ' Số liệu minh hoạ, không phải kết quả thật.' : ''}` });
  f.stage.innerHTML = '';
  f.stage.classList.add('is-table');
  const head = h('div', { class: 'bw-cm-head' });
  if (demo) head.append(h('span', { class: 'bw-badge-demo' }, '⚠ Số liệu minh hoạ, không phải kết quả thật'));
  else if (P.label) head.append(h('span', { class: 'bw-badge-demo', style: { borderStyle: 'solid' } }, P.label));
  const diagBtn = h('span', { class: 'bw-cm-diag', 'data-hotspot': 'diag', 'data-label': 'Đường chéo (nhận đúng)' }, '↘ Đường chéo = nhận đúng');
  head.append(diagBtn);
  const table = h('table', { class: 'bw-cm' });
  const thead = h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'bw-cm__corner' }, h('span', {}, 'Làm ↓'), h('span', {}, 'Máy nhận →')),
    cols.map((c) => h('th', { scope: 'col', 'data-hotspot': `col-${c}`, 'data-label': `Cột ${NAME[c]}`, class: 'bw-cm__col' }, NAME[c])), h('th', { scope: 'col' }, 'Đúng')));
  const cells = [], accs = [];
  const tbody = h('tbody');
  G.forEach((g, i) => {
    const tr = h('tr');
    tr.append(h('th', { scope: 'row', 'data-hotspot': `row-${g}`, 'data-label': `Hàng ${g}`, class: 'bw-cm__row', style: { '--chip': COMMANDS[g].color } }, g));
    cells[i] = cols.map((c, j) => {
      const td = h('td', { class: `bw-cm__cell${c === g ? ' is-diag' : ''}`, 'data-hotspot': `cell-${g}-${c}`, 'data-label': `Làm ${g}, máy nhận ${NAME[c]}`, tabindex: '0' }, h('span', {}, '0'));
      td.addEventListener('click', () => explain(i, j));
      td.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !f.root.classList.contains('is-hotspot')) explain(i, j); });
      tr.append(td); return td;
    });
    const acc = h('td', { class: 'bw-cm__acc' }, '—'); accs[i] = acc; tr.append(acc);
    tbody.append(tr);
  });
  table.append(thead, tbody);
  const note = h('p', { class: 'bw-cm-note', 'aria-live': 'polite' }, 'Chạm vào một ô để xem ý nghĩa.');
  const total = h('div', { class: 'bw-card' }, h('span', { class: 'bw-card__k' }, 'Độ chính xác chung = ô đúng ÷ tổng số lần'), h('span', { class: 'bw-card__v' }, '—'));
  f.stage.append(head, h('div', { class: 'bw-cm-wrap' }, table), note);
  f.readout.append(total);
  const maxRow = Math.max(1, ...M.map((r) => r.reduce((a, b) => a + b, 0)));
  let shown = M.map((r) => r.map(() => 0));
  const explain = (i, j) => {
    if (f.root.classList.contains('is-hotspot')) return;
    const g = G[i], c = cols[j], n = shown[i][j];
    note.textContent = c === g ? `Làm ${g} và máy nhận đúng ${g}: ${n} lần.` : c === 'NONE' ? `Làm ${g} nhưng máy không nhận lệnh nào: ${n} lần.` : `Làm ${g} nhưng máy nhận ${c}: ${n} lần (nhầm).`;
  };
  // trial order per row (seeded)
  const seq = M.map((row, i) => {
    const list = []; row.forEach((n, j) => { for (let k = 0; k < n; k++) list.push(j); });
    const r = rng(17 + i); for (let k = list.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [list[k], list[m]] = [list[m], list[k]]; }
    return list;
  });
  const draw = (upto) => { // upto[i] = number of trials shown in row i
    shown = M.map((row, i) => { const v = row.map(() => 0); seq[i].slice(0, upto[i]).forEach((j) => v[j]++); return v; });
    let ok = 0, all = 0;
    shown.forEach((row, i) => {
      const n = row.reduce((a, b) => a + b, 0);
      row.forEach((v, j) => {
        const td = cells[i][j];
        td.firstChild.textContent = String(v);
        const heat = v / maxRow;
        td.style.setProperty('--heat', heat.toFixed(3));
        td.classList.toggle('is-zero', v === 0);
      });
      const d = G.indexOf(G[i]); const right = row[cols.indexOf(G[i])] || 0;
      accs[i].textContent = n ? `${fmt((right / n) * 100)}%` : '—';
      ok += right; all += n;
    });
    total.lastChild.textContent = all ? `${ok}/${all} = ${fmt((ok / all) * 100, 1)}%` : '—';
  };
  const beats = G.map((g, i) => ({ id: `row-${i + 1}`, i, dur: 2600, caption: `Cử chỉ ${g}: thử ${seq[i].length} lần, mỗi lần thả một chấm vào ô "máy nhận được gì".${demo ? ' (minh hoạ)' : ''}` }));
  beats.push({ id: 'totals', i: G.length, dur: 2200, caption: 'Cột "Đúng" = ô đường chéo ÷ số lần thử của hàng. Ô ngoài đường chéo cho biết cặp nào hay bị nhầm.' });
  beats.push({ id: 'end', i: G.length, dur: 400, caption: demo ? 'Đây là số liệu minh hoạ. Kết quả thật phải do nhóm tự đo và ghi chép.' : 'Bấm vào ô bất kỳ để xem giải thích.' });
  const render = ({ beat, t01 }) => {
    const upto = G.map((_, i) => (i < beat.i ? seq[i].length : i === beat.i ? Math.floor(seq[i].length * clamp(t01 * 1.1, 0, 1)) : 0));
    draw(upto);
    G.forEach((_, i) => tbody.children[i].classList.toggle('is-cur', i === beat.i));
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P, hotspotAt: () => tl.total });
}
