// code-stepper: steps through any snippet; variable table, condition badge, console, optional visual panel.
import { h, s, attr, frame, fmt, clamp, easeOut, arrowMarker, codeView, varTable, Timeline, timelineHandle } from './_shared.js';

export const meta = {
  id: 'code-stepper',
  title: 'Chạy từng dòng lệnh',
  timeline: true,
  checkpoints: ['end'], // plus s1…sN (validated from props.steps)
  hotspots: [],
  defaults: { language: 'cpp', visual: 'none' },
};

const show = (v) => (typeof v === 'boolean' ? (v ? 'true' : 'false') : typeof v === 'number' ? fmt(v, Number.isInteger(v) ? 0 : 2) : String(v));

export function mount(el, props = {}, ctx = {}) {
  const P = { ...meta.defaults, ...props };
  const code = String(P.code || '// (chưa có mã)');
  const steps = (Array.isArray(P.steps) && P.steps.length ? P.steps : [{ line: 1 }]).slice(0, 30);
  const visual = ['boxes', 'branch', 'loop'].includes(P.visual) ? P.visual : 'none';
  const f = frame(el, { id: meta.id, title: P.title || meta.title, side: true, viewBox: [300, 200], alt: `Đoạn mã ${steps.length} bước; dòng đang chạy được tô sáng, bảng biến cập nhật sau mỗi bước.` });
  f.stage.innerHTML = '';
  f.stage.classList.add('is-code');
  const cv = codeView(code, { lang: P.language === 'java' ? 'java' : 'cpp', label: P.title || 'Đoạn mã' });
  f.stage.append(cv.el);
  // accumulate state per step
  const names = [];
  const states = [];
  let vars = {}, out = '';
  steps.forEach((st) => {
    for (const k of Object.keys(st.vars || {})) if (!names.includes(k)) names.push(k);
    vars = { ...vars, ...(st.vars || {}) };
    if (st.out != null) out += `${st.out}\n`;
    states.push({ vars: { ...vars }, out, changed: Object.keys(st.vars || {}) });
  });
  const table = names.length ? varTable(names, { title: 'Hộp biến' }) : null;
  const badge = h('div', { class: 'bw-state', hidden: true });
  const consoleEl = h('pre', { class: 'bw-console', 'aria-label': 'Kết quả in ra' });
  const hasOut = steps.some((st) => st.out != null);
  // visual panel
  let vsvg = null, drawVisual = () => {};
  if (visual !== 'none') {
    vsvg = s('svg', { viewBox: '0 0 300 190', class: 'bw-sim__svg', role: 'img', 'aria-label': visual === 'boxes' ? 'Các biến vẽ thành hộp có nhãn' : visual === 'branch' ? 'Ngã rẽ đúng/sai của câu lệnh if' : 'Vòng lặp và số lần lặp', style: { aspectRatio: '300 / 190', background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '10px' } });
    const defs = vsvg.appendChild(s('defs'));
    if (visual === 'boxes') {
      const per = Math.min(4, Math.max(1, names.length)), w = 280 / per;
      const boxes = names.slice(0, 8).map((n, i) => {
        const x = 10 + (i % per) * w, y = 20 + Math.floor(i / per) * 86;
        const g = s('g');
        g.append(s('text', { x: x + w / 2, y: y + 12, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'bw-mono' }, n));
        const r = s('rect', { x: x + 6, y: y + 20, width: w - 12, height: 48, rx: 8, fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 2 });
        const v = s('text', { x: x + w / 2, y: y + 52, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, class: 'bw-mono' });
        g.append(r, v); vsvg.append(g); return { n, r, v, y };
      });
      drawVisual = (st, t01) => boxes.forEach((b) => {
        const has = b.n in st.vars, ch = st.changed.includes(b.n);
        b.v.textContent = has ? show(st.vars[b.n]) : '?';
        attr(b.v, { transform: ch ? `translate(0,${-24 * (1 - easeOut(clamp(t01 * 2, 0, 1)))})` : '', opacity: ch ? clamp(t01 * 3, 0, 1) : 1 });
        attr(b.r, { stroke: ch ? 'var(--c-primary)' : 'var(--c-border)', fill: ch ? 'var(--c-primary-soft)' : 'var(--c-surface-2)' });
      });
    } else if (visual === 'branch') {
      const mk = arrowMarker(defs, 'var(--c-border)'), mkOn = arrowMarker(defs, 'var(--c-success)');
      const dia = s('path', { d: 'M150,20 L220,62 L150,104 L80,62 Z', fill: 'var(--c-surface-2)', stroke: 'var(--c-border)', 'stroke-width': 2 });
      const dt = s('text', { x: 150, y: 67, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'bw-mono' });
      const yes = s('path', { d: 'M80,62 L30,62 L30,150', fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 4, 'marker-end': mk });
      const no = s('path', { d: 'M220,62 L270,62 L270,150', fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 4, 'marker-end': mk });
      vsvg.append(dia, dt, yes, no, s('text', { x: 30, y: 178, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--c-success)' }, 'đúng'), s('text', { x: 270, y: 178, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, fill: 'var(--c-danger)' }, 'sai'));
      const ball = s('circle', { r: 9, fill: 'var(--c-primary)', opacity: 0 }); vsvg.append(ball);
      drawVisual = (st, t01, step) => {
        const c = step.cond;
        dt.textContent = c ? c.expr.slice(0, 18) : 'điều kiện?';
        [yes, no].forEach((p) => attr(p, { stroke: 'var(--c-border)', 'marker-end': mk }));
        if (!c) { ball.setAttribute('opacity', 0); return; }
        const p = c.value ? yes : no;
        attr(p, { stroke: c.value ? 'var(--c-success)' : 'var(--c-danger)', 'marker-end': mkOn });
        const L = p.getTotalLength ? p.getTotalLength() : 0, pt = L ? p.getPointAtLength(L * easeOut(clamp(t01 * 1.4, 0, 1))) : { x: 150, y: 62 };
        attr(ball, { cx: pt.x, cy: pt.y, opacity: 1 });
      };
    } else {
      const mk = arrowMarker(defs, 'var(--c-primary)');
      vsvg.append(s('circle', { cx: 150, cy: 88, r: 64, fill: 'none', stroke: 'var(--c-border)', 'stroke-width': 6 }));
      const arc = s('path', { fill: 'none', stroke: 'var(--c-primary)', 'stroke-width': 6, 'stroke-linecap': 'round', 'marker-end': mk });
      const cnt = s('text', { x: 150, y: 97, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, class: 'bw-mono' });
      const lbl = s('text', { x: 150, y: 184, 'text-anchor': 'middle', 'font-size': 13, class: 't-muted' }, 'số lần quay lại dòng này');
      vsvg.append(arc, cnt, lbl);
      drawVisual = (st, t01, step, idx) => {
        const n = steps.slice(0, idx + 1).filter((q) => q.line === step.line).length;
        cnt.textContent = `×${n}`;
        const a = (Math.min(0.999, t01) * 360) * Math.PI / 180;
        arc.setAttribute('d', `M150,24 A64,64 0 ${a > Math.PI ? 1 : 0} 1 ${150 + 64 * Math.sin(a)},${88 - 64 * Math.cos(a)}`);
      };
    }
  }
  if (vsvg) f.side.append(vsvg);
  f.side.append(badge);
  if (table) f.side.append(table.el);
  if (hasOut) f.side.append(h('div', {}, h('div', { class: 'bw-card__k' }, 'Màn hình in ra'), consoleEl));

  const beats = steps.map((st, i) => ({ id: `s${i + 1}`, i, dur: 1700, caption: st.note || `Bước ${i + 1}: chạy dòng ${st.line}.` }));
  beats.push({ id: 'end', i: steps.length - 1, dur: 500, caption: 'Hết đoạn mã. Bấm ↺ để chạy lại từ đầu.' });
  const render = ({ beat, t01 }) => {
    const i = beat.i, st = steps[i], state = states[i];
    cv.highlight([clamp(st.line, 1, cv.count)], st.cond ? (st.cond.value ? 'ok' : 'no') : 'run');
    table?.set(Object.fromEntries(names.map((n) => [n, n in state.vars ? show(state.vars[n]) : undefined])));
    badge.hidden = !st.cond;
    if (st.cond) { badge.textContent = `${st.cond.expr} → ${st.cond.value ? 'đúng ✓' : 'sai ✗'}`; badge.className = `bw-state ${st.cond.value ? 'is-ok' : 'is-bad'}`; }
    consoleEl.textContent = state.out.replace(/\n$/, '');
    drawVisual(state, beat.id === 'end' ? 1 : t01, st, i);
  };
  const tl = new Timeline({ beats, render, ctx });
  return timelineHandle({ f, tl, ctx, props: P });
}
