// tinyml-training: how much data, and from whom? Train the tiny model on 1–6 people × 1–10 takes, then test
// on 2 people it never saw (fair) or on the same people (unfair). Shows train vs test accuracy and the
// confusion matrix. Synthetic data from _tinyml.js; numbers illustrate the method, not BandW's real accuracy.
import { frame, s, h, fmt, slider, toggle, staticHandle } from './_shared.js';
import { dataset, sample, train, evaluate, CLASSES, CLASS_LABEL, TRAIN_PEOPLE, TEST_PEOPLE } from './_tinyml.js';

export const meta = {
  id: 'tinyml-training',
  title: 'Huấn luyện và kiểm tra mô hình',
  timeline: false,
  checkpoints: [],
  hotspots: [
    { id: 'train-bar', label: 'Độ chính xác trên dữ liệu huấn luyện' },
    { id: 'test-bar', label: 'Độ chính xác trên tập kiểm tra' },
    { id: 'matrix', label: 'Ma trận nhầm lẫn của tập kiểm tra' },
  ],
  defaults: { people: 1, takes: 1, samePeople: false },
};

const SHORT = { NONE: 'Không', WATER: 'WATER', FOOD: 'FOOD', NO: 'NO', HELP: 'HELP' };

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const st = { people: Math.min(6, Math.max(1, P.people | 0)), takes: Math.min(10, Math.max(1, P.takes | 0)), same: !!P.samePeople };
  const f = frame(el, {
    id: meta.id, title: meta.title, panes: [[260, 300], [360, 300]],
    alt: 'Bên trái: hai cột độ chính xác, trên dữ liệu huấn luyện và trên tập kiểm tra. Bên phải: ma trận nhầm lẫn 5 × 5 của tập kiểm tra, hàng là cử chỉ thật, cột là mô hình đoán. Dữ liệu tổng hợp.',
  });
  const [A, B] = f.svgs;
  A.append(s('text', { x: 130, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'Độ chính xác'));
  const BY = 250, BH = 190;
  A.append(s('line', { x1: 20, x2: 240, y1: BY, y2: BY, stroke: 'var(--c-border)', 'stroke-width': 2 }));
  const bar = (id, label, x, color) => {
    const g = s('g', { 'data-hotspot': id, 'data-label': meta.hotspots.find((m) => m.id === id).label });
    g.append(s('rect', { x, y: BY - BH, width: 80, height: BH, class: 'panel-bg' }));
    const r = s('rect', { x, width: 80, rx: 4, fill: color });
    const v = s('text', { x: x + 40, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, class: 'bw-mono' });
    g.append(r, v, s('text', { x: x + 40, y: BY + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label));
    A.append(g);
    return { set(p) { const hh = p * BH; r.setAttribute('y', BY - hh); r.setAttribute('height', hh); v.setAttribute('y', BY - hh - 6); v.textContent = `${fmt(p * 100)}%`; } };
  };
  const trainBar = bar('train-bar', 'Huấn luyện', 30, 'var(--viz-y)');
  const testBar = bar('test-bar', 'Kiểm tra', 150, 'var(--c-primary)');
  const testWho = s('text', { x: 190, y: BY + 38, 'text-anchor': 'middle', 'font-size': 11.5, class: 't-muted' }); A.append(testWho);

  B.append(s('text', { x: 180, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'Tập kiểm tra: thật (hàng) → đoán (cột)'));
  const mG = s('g', { 'data-hotspot': 'matrix', 'data-label': 'Ma trận nhầm lẫn của tập kiểm tra' }); B.append(mG);
  const MX = 80, MY = 56, CW = 52, CH = 40;
  CLASSES.forEach((c, i) => {
    mG.append(s('text', { x: MX + i * CW + CW / 2, y: MY - 8, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700 }, SHORT[c]));
    mG.append(s('text', { x: MX - 6, y: MY + i * CH + CH / 2 + 4, 'text-anchor': 'end', 'font-size': 11.5, 'font-weight': 700 }, SHORT[c]));
  });
  const cells = CLASSES.map((_, i) => CLASSES.map((__, j) => {
    const r = s('rect', { x: MX + j * CW + 1, y: MY + i * CH + 1, width: CW - 2, height: CH - 2, rx: 4 });
    const t = s('text', { x: MX + j * CW + CW / 2, y: MY + i * CH + CH / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'bw-mono' });
    mG.append(r, t); return { r, t };
  }));

  const note = h('div', { class: 'bw-card' }, h('span', { class: 'bw-card__k' }, 'Nhận xét'), h('span', { class: 'bw-card__v' }));
  f.readout.append(note);

  const render = () => {
    const people = TRAIN_PEOPLE.slice(0, st.people);
    const trainSet = dataset(people, st.takes);
    // Unfair test: other takes of the SAME people. Fair test: two people never seen in training.
    const testSet = st.same
      ? people.flatMap((ps) => CLASSES.flatMap((c) => [0, 1, 2, 3].map((k) => sample(c, ps, st.takes + k))))
      : dataset(TEST_PEOPLE, 4);
    const model = train(trainSet);
    const tr = evaluate(model, trainSet).accuracy, te = evaluate(model, testSet);
    trainBar.set(tr); testBar.set(te.accuracy);
    testWho.textContent = st.same ? '(chính những người đã huấn luyện)' : `(người mới #${TEST_PEOPLE.join(', #')})`;
    te.cm.forEach((row, i) => {
      const n = row.reduce((a, v) => a + v, 0) || 1;
      row.forEach((v, j) => {
        const k = v / n;
        cells[i][j].r.setAttribute('fill', v === 0 ? 'var(--c-surface-2)' : i === j ? 'var(--c-success-bg, var(--viz-neutral))' : 'var(--c-danger-bg)');
        cells[i][j].r.setAttribute('opacity', v === 0 ? 1 : (0.45 + 0.55 * k).toFixed(2));
        cells[i][j].t.textContent = v ? String(v) : '';
      });
    });
    const gap = tr - te.accuracy;
    const total = trainSet.length;
    let msg, cls;
    if (st.same) { msg = `Kiểm tra trên người cũ cho ${fmt(te.accuracy * 100)}%: con số đẹp nhưng không công bằng, vì mô hình đã “quen” những người này.`; cls = 'is-warn'; }
    else if (gap > 0.05) { msg = `Chỉ ${total} mẫu: thuộc bài (${fmt(tr * 100)}%) nhưng gặp người mới chỉ ${fmt(te.accuracy * 100)}%. Cần thêm người, thêm mẫu.`; cls = 'is-bad'; }
    else { msg = `${total} mẫu từ ${st.people} người: người mới đạt ${fmt(te.accuracy * 100)}%, gần bằng lúc huấn luyện. Nhớ: đây là dữ liệu tổng hợp, dữ liệu thật sẽ khó hơn.`; cls = 'is-ok'; }
    note.lastChild.textContent = msg; note.className = `bw-card ${cls}`;
  };

  const slP = slider({ label: 'Số người huấn luyện', min: 1, max: 6, step: 1, value: st.people, onInput: (v) => { st.people = v; render(); } });
  const slT = slider({ label: 'Mẫu mỗi cử chỉ, mỗi người', min: 1, max: 10, step: 1, value: st.takes, onInput: (v) => { st.takes = v; render(); } });
  const tg = toggle({ label: 'Kiểm tra trên chính người đã huấn luyện (không công bằng)', checked: st.same, onChange: (v) => { st.same = v; render(); } });
  f.panel.append(slP.el, slT.el, tg.el);
  f.setCaption(`Mỗi “người” có biên độ, tốc độ và hiệu chuẩn hơi khác nhau. ${CLASSES.map((c) => CLASS_LABEL[c]).join(', ')}: 5 lớp, trong đó “Không làm gì” gồm nghỉ, đi bộ, nghiêng nhẹ, chúc tay 1 lần, nâng tay.`);
  render();
  return staticHandle({ f });
}
