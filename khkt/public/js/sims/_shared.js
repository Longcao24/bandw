// Shared helpers for every sim: DOM/SVG builders, the beat timeline + controls toolbar,
// reduced-motion handling, hotspot mode, code view, variable table, 3D arm model, speech.
// No DOM access at module top level (tests import this file in node).

export const NS = 'http://www.w3.org/2000/svg';
export const hasDOM = () => typeof document !== 'undefined' && typeof window !== 'undefined';

// ---------- tiny builders ----------
function applyAttrs(node, attrs, isSvg) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  return node;
}
function append(node, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
export function h(tag, attrs = {}, ...kids) { return append(applyAttrs(document.createElement(tag), attrs, false), kids); }
export function s(tag, attrs = {}, ...kids) { return append(applyAttrs(document.createElementNS(NS, tag), attrs, true), kids); }
export function attr(node, attrs) { return applyAttrs(node, attrs, node.namespaceURI === NS); }

// ---------- math / format ----------
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const DEG = Math.PI / 180;
/** Vietnamese number: decimal comma, real minus sign. */
export function fmt(v, d = 0) {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v).toFixed(d);
  const z = Number(r) === 0 ? r.replace('-', '') : r;
  return z.replace('.', ',').replace(/^-/, '−');
}
export const signed = (v, d = 0) => (v > 0 && Number(v.toFixed(d)) !== 0 ? '+' : '') + fmt(v, d);
export const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
export const asciiBytes = (str) => [...str].map((c) => hex2(c.charCodeAt(0)));

// ---------- motion ----------
export function isReduced(ctx) {
  if (ctx && typeof ctx.reducedMotion === 'boolean') return ctx.reducedMotion;
  if (!hasDOM()) return false;
  if (document.documentElement.classList.contains('reduce-motion')) return true;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
export const raf = (f) => (hasDOM() ? requestAnimationFrame(f) : setTimeout(() => f(Date.now()), 16));
export const caf = (id) => (hasDOM() ? cancelAnimationFrame(id) : clearTimeout(id));

/** Continuous rAF loop with time delta (ms). Returns {start, stop, running}. */
export function ticker(onTick) {
  let id = 0, last = 0, on = false;
  const loop = (ts) => {
    if (!on) return;
    const dt = last ? Math.min(100, ts - last) : 16;
    last = ts;
    onTick(dt, ts);
    id = raf(loop);
  };
  return {
    start() { if (on) return; on = true; last = 0; id = raf(loop); },
    stop() { on = false; caf(id); },
    get running() { return on; },
  };
}

let uid = 0;
export const nextId = (p = 'bw') => `${p}-${++uid}`;

// ---------- sim frame ----------
/**
 * Builds the standard frame inside `el`.
 * opts: { id, title, alt (text alternative), side:boolean, viewBox:[w,h], wide:boolean }
 */
export function frame(el, opts) {
  const { id, title, alt = '', side = false } = opts;
  const panes = opts.panes || [opts.viewBox || [640, 400]];
  el.innerHTML = '';
  const root = h('div', { class: `bw-sim bw-sim--${id}${side ? ' has-side' : ''}`, 'data-sim': id });
  const paneAlts = opts.paneAlts || [];
  const svgs = panes.map(([w, hh, x0 = 0, y0 = 0], i) => s('svg', {
    viewBox: `${x0} ${y0} ${w} ${hh}`, class: 'bw-sim__svg', role: 'img', style: { aspectRatio: `${w} / ${hh}` },
    'aria-label': i === 0 ? `${title}. ${paneAlts[0] || alt}` : (paneAlts[i] || title), preserveAspectRatio: 'xMidYMid meet', 'font-family': 'inherit',
  }));
  const paneEls = svgs.map((sv, i) => h('div', { class: 'bw-sim__pane', style: { flexGrow: String(panes[i][0]), flexBasis: `${Math.round(panes[i][0] * 0.62)}px` } }, sv));
  const stage = h('div', { class: `bw-sim__stage${panes.length > 1 ? ' is-multi' : ''}` }, paneEls);
  const sidePanel = side ? h('div', { class: 'bw-sim__side' }) : null;
  const body = h('div', { class: 'bw-sim__body' }, stage, sidePanel);
  const readout = h('div', { class: 'bw-sim__readout' });
  const panel = h('div', { class: 'bw-sim__panel' });
  const caption = h('p', { class: 'bw-sim__caption' });
  const altText = h('p', { class: 'bw-sr-only' }, alt);
  root.append(body, readout, panel, caption, altText);
  el.append(root);
  const defs = svgs.map((sv) => sv.appendChild(s('defs')));
  return {
    root, svg: svgs[0], svgs, stage, side: sidePanel, readout, panel, caption, defs: defs[0], defsAll: defs,
    setCaption(text) { caption.textContent = text || ''; },
    destroy() { root.remove(); },
  };
}

/** Arrow-head markers (colour follows the stroke via context-stroke where supported; fallback fill by var). */
export function arrowMarker(defs, color, idHint = 'arw') {
  const id = nextId(idHint);
  defs.append(s('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
    s('path', { d: 'M0,0 L10,5 L0,10 z', fill: color })));
  return `url(#${id})`;
}
export function glowFilter(defs) {
  const id = nextId('glow');
  defs.append(s('filter', { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
    s('feGaussianBlur', { stdDeviation: 6, result: 'b' }),
    s('feMerge', {}, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))));
  return `url(#${id})`;
}
export const pts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
export const pathD = (arr) => arr.length ? 'M' + arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') : '';
export function arcPath(cx, cy, r, a0, a1) {
  // angles in degrees, 0 = up, clockwise positive
  const p = (a) => [cx + r * Math.sin(a * DEG), cy - r * Math.cos(a * DEG)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}`;
}
export function sectorPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.sin(a * DEG), cy - r * Math.cos(a * DEG)];
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const [a, b, c, d] = [p(r1, a0), p(r1, a1), p(r0, a1), p(r0, a0)];
  return `M${a[0]},${a[1]} A${r1},${r1} 0 ${large} 1 ${b[0]},${b[1]} L${c[0]},${c[1]} A${r0},${r0} 0 ${large} 0 ${d[0]},${d[1]} Z`;
}
/** Ring progress (0..1) as an SVG circle using stroke-dasharray. */
export function ring(parent, { cx, cy, r, width = 10, color = 'var(--c-primary)', track = 'var(--c-surface-2)' }) {
  const C2 = 2 * Math.PI * r;
  const bg = s('circle', { cx, cy, r, fill: 'none', stroke: track, 'stroke-width': width });
  const fg = s('circle', { cx, cy, r, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-dasharray': `0 ${C2}`, transform: `rotate(-90 ${cx} ${cy})` });
  parent.append(bg, fg);
  return { bg, fg, set(v) { const L = clamp(v, 0, 1) * C2; fg.setAttribute('stroke-dasharray', `${L} ${C2}`); }, color(c) { fg.setAttribute('stroke', c); } };
}

// ---------- timeline + controls ----------
/**
 * Beat timeline. beats: [{ id, dur(ms), caption }]. render({T, i, beat, t01, total}) draws a frame.
 * Every beat id is a checkpoint; runTo('end') = end of the last beat.
 */
export class Timeline {
  constructor({ beats, render, ctx = {}, loop = false }) {
    this.ctx = ctx; this.renderFn = render; this.loop = loop;
    this.speed = Number(ctx.speed) || 1; this.reduced = isReduced(ctx);
    this.playing = false; this.T = 0; this.listeners = new Set(); this._stop = null; this._lastBeat = -1;
    this.enabled = true;
    this.setBeats(beats);
    this._tick = ticker((dt) => this._advance(dt));
  }
  setBeats(beats) {
    this.beats = beats.map((b) => ({ ...b }));
    let t = 0;
    for (const b of this.beats) { b.start = t; t += Math.max(1, b.dur); b.end = t; }
    this.total = t; this.T = Math.min(this.T, this.total); this._lastBeat = -1;
  }
  on(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  _emit(type) { for (const f of this.listeners) f(type, this); }
  indexAt(T) {
    const b = this.beats;
    for (let i = 0; i < b.length; i++) if (T <= b[i].end) return i;
    return b.length - 1;
  }
  render() {
    const i = this.indexAt(this.T), beat = this.beats[i];
    const t01 = clamp((this.T - beat.start) / (beat.end - beat.start), 0, 1);
    this.renderFn({ T: this.T, i, beat, t01, total: this.total });
    if (i !== this._lastBeat) {
      this._lastBeat = i;
      this.ctx.onEvent?.('beat', { id: beat.id, index: i, caption: beat.caption });
      this._emit('beat');
    }
    this._emit('time');
  }
  _advance(dt) {
    let T = this.T + dt * this.speed;
    if (this._stop && T >= this._stop.at) {
      T = this._stop.at; const r = this._stop.resolve; this._stop = null;
      this.T = T; this.pause(); this.render(); r(); return;
    }
    if (T >= this.total) {
      if (this.loop) T = T % this.total;
      else { this.T = this.total; this.pause(); this.render(); this.ctx.onEvent?.('ended', {}); return; }
    }
    this.T = T; this.render();
  }
  play() {
    if (this.playing) return;
    if (this.T >= this.total - 0.5) { this.T = 0; this._lastBeat = -1; }
    this.playing = true; this._tick.start(); this._emit('state');
    this.ctx.onEvent?.('play', {});
  }
  pause() { if (!this.playing) return; this.playing = false; this._tick.stop(); this._emit('state'); this.ctx.onEvent?.('pause', {}); }
  toggle() { this.playing ? this.pause() : this.play(); }
  step() {
    this.pause();
    let i = this.indexAt(this.T);
    if (this.T >= this.beats[i].end - 0.5 && i < this.beats.length - 1) i++;
    this.seek(this.beats[i].end);
  }
  back() {
    this.pause();
    const i = this.indexAt(this.T);
    const target = this.T > this.beats[i].start + 1 ? (i > 0 ? this.beats[i - 1].end : 0) : (i > 1 ? this.beats[i - 2].end : 0);
    this.seek(target);
  }
  reset() { this.pause(); this._stop = null; this.seek(0); }
  seek(T) { this.T = clamp(T, 0, this.total); this.render(); }
  seekBeat(id, where = 'end') { const b = this.beats.find((x) => x.id === id); if (b) this.seek(where === 'start' ? b.start : b.end); }
  has(id) { return id === 'end' || this.beats.some((b) => b.id === id); }
  targetOf(id) {
    if (id === 'end') return this.total;
    const b = this.beats.find((x) => x.id === id);
    return b ? b.end : this.total;
  }
  runTo(id) {
    const at = this.targetOf(id);
    if (this.reduced) { this.pause(); this.seek(at); return Promise.resolve(); }
    if (this.T > at - 0.5) { this.T = 0; this._lastBeat = -1; }
    return new Promise((resolve) => {
      if (this._stop) this._stop.resolve();
      this._stop = { at, resolve };
      this.playing = false; this.play();
    });
  }
  setSpeed(v) { this.speed = v; this._emit('state'); }
  destroy() { this._tick.stop(); this.listeners.clear(); if (this._stop) { this._stop.resolve(); this._stop = null; } }
}

/** Standard toolbar: ▶ Phát / ⏸ Tạm dừng, ⏮ Lùi, ⏭ Bước tiếp, ↺ Phát lại, tốc độ, beat dots, scrubber. */
export function controls(tl, f, { speeds = [0.5, 1, 1.5] } = {}) {
  const playBtn = h('button', { type: 'button', class: 'bw-btn bw-btn--play', 'aria-label': 'Phát' });
  const backBtn = h('button', { type: 'button', class: 'bw-btn', 'aria-label': 'Bước trước', title: 'Bước trước' }, '⏮');
  const stepBtn = h('button', { type: 'button', class: 'bw-btn', 'aria-label': 'Bước tiếp', title: 'Bước tiếp' }, '⏭', h('span', { class: 'bw-btn__lbl' }, ' Bước tiếp'));
  const replayBtn = h('button', { type: 'button', class: 'bw-btn', 'aria-label': 'Phát lại', title: 'Phát lại' }, '↺');
  const speedSel = h('select', { class: 'bw-speed', 'aria-label': 'Tốc độ' }, speeds.map((v) => h('option', { value: v, selected: v === tl.speed }, `${fmt(v, v % 1 ? 1 : 0)}×`)));
  const dots = h('div', { class: 'bw-dots', role: 'group', 'aria-label': 'Các bước' });
  const prog = h('div', { class: 'bw-prog' }, h('div', { class: 'bw-prog__fill' }));
  // Many short beats (e.g. main-loop has 25) would pile their dots on top of each other on a phone; a
  // "dense" track hides the dot circles on narrow screens and shows "Bước k/N" instead (see sims.css).
  const stepNum = h('span', { class: 'bw-stepnum', 'aria-hidden': 'true' });
  const track = h('div', { class: 'bw-ctrl__track' }, prog, dots, stepNum);
  const bar = h('div', { class: 'bw-ctrl', role: 'toolbar', 'aria-label': 'Điều khiển hoạt hình', 'data-sim-controls': '' },
    h('div', { class: 'bw-ctrl__main' }, playBtn, backBtn, stepBtn, replayBtn, speedSel), track);
  const buildDots = () => {
    dots.innerHTML = '';
    track.classList.toggle('is-dense', tl.beats.length > 10);
    tl.beats.forEach((b, i) => {
      dots.append(h('button', {
        type: 'button', class: 'bw-dot', 'aria-label': `Bước ${i + 1}: ${b.caption || b.id}`, title: b.caption || b.id,
        style: { left: `${(b.start / tl.total) * 100}%`, width: `${((b.end - b.start) / tl.total) * 100}%` },
        onclick: () => { const was = tl.playing; tl.pause(); tl.seek(tl.reduced ? b.end : b.start + 0.01); if (was && !tl.reduced) tl.play(); },
      }));
    });
  };
  const sync = (type) => {
    if (type === 'rebuild') buildDots();
    playBtn.textContent = tl.playing ? '⏸' : '▶';
    playBtn.append(h('span', { class: 'bw-btn__lbl' }, tl.playing ? ' Tạm dừng' : (tl.T >= tl.total - 0.5 ? ' Xem lại' : ' Phát')));
    playBtn.setAttribute('aria-label', tl.playing ? 'Tạm dừng' : 'Phát');
    playBtn.setAttribute('aria-pressed', tl.playing ? 'true' : 'false');
    prog.firstChild.style.width = `${(tl.T / tl.total) * 100}%`;
    const cur = tl.indexAt(tl.T);
    [...dots.children].forEach((d, i) => { d.classList.toggle('is-done', i < cur || tl.T >= tl.total - 0.5); d.classList.toggle('is-cur', i === cur); });
    stepNum.textContent = `Bước ${cur + 1}/${tl.beats.length}`;
    if (type === 'beat' && f) f.setCaption(tl.beats[cur].caption);
  };
  playBtn.onclick = () => tl.toggle();
  stepBtn.onclick = () => tl.step();
  backBtn.onclick = () => tl.back();
  replayBtn.onclick = () => { tl.reset(); if (!tl.reduced) tl.play(); };
  speedSel.onchange = () => tl.setSpeed(Number(speedSel.value));
  buildDots();
  const off = tl.on(sync);
  sync('beat'); sync('state');
  let enabled = true;
  const keyHandler = (e) => {
    if (!enabled) return; // locked (e.g. sim-predict waiting for an answer)
    if (e.target.closest('input,select,textarea,button')) { if (e.key !== ' ' || e.target !== playBtn) return; }
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); tl.toggle(); }
    else if (e.key === 'ArrowRight' && !e.target.closest('[data-hotspot]')) { tl.step(); }
    else if (e.key === 'ArrowLeft' && !e.target.closest('[data-hotspot]')) { tl.back(); }
  };
  if (f) { f.root.addEventListener('keydown', keyHandler); if (!f.root.hasAttribute('tabindex')) f.root.tabIndex = -1; }
  return {
    el: bar, rebuild: () => sync('rebuild'),
    setEnabled(on) { enabled = !!on; for (const b of [playBtn, backBtn, stepBtn, replayBtn, speedSel, ...dots.children]) b.disabled = !on; bar.classList.toggle('is-locked', !on); },
    destroy() { off(); f?.root.removeEventListener('keydown', keyHandler); },
  };
}

/**
 * Standard handle for a timeline sim. Wires controls into frame, autoplay, hotspot mode, destroy.
 * opts: { f, tl, ctx, props, hotspotAt?: () => number(T), onHotspot?(on) , extraDestroy?() }
 */
export function timelineHandle({ f, tl, ctx = {}, props = {}, hotspotAt, extraDestroy, controlsEl }) {
  const ctl = controls(tl, f);
  (controlsEl || f.root).insertBefore(ctl.el, f.caption.nextSibling);
  if (props.controls === false || ctx.controls === false) ctl.el.hidden = true;
  tl.render();
  f.setCaption(tl.beats[tl.indexAt(tl.T)].caption);
  if (props.autoplay && !tl.reduced) tl.play();
  if (tl.reduced) f.root.classList.add('is-reduced');
  return {
    play: () => tl.play(), pause: () => tl.pause(), step: () => tl.step(), reset: () => tl.reset(),
    runTo: (id) => tl.runTo(id), seek: (ms) => tl.seek(ms), get duration() { return tl.total; },
    setControlsEnabled: (on) => ctl.setEnabled(on),
    setSpeed: (v) => tl.setSpeed(Number(v) || 1),
    setHotspotMode(on, onPick) {
      if (on) { tl.pause(); if (hotspotAt) tl.seek(hotspotAt()); }
      hotspotMode(f.root, f.svg, on, onPick);
      ctl.setEnabled(!on);
    },
    destroy() { tl.destroy(); ctl.destroy(); extraDestroy?.(); hotspotMode(f.root, f.svg, false); f.destroy(); },
    timeline: tl,
  };
}

/** Handle for interactive (non-timeline) sims. */
export function staticHandle({ f, start, stop, extraDestroy }) {
  // Interactive sims run a live clock; pause it while the sim is (almost) off-screen or the tab is hidden.
  let visible = true, wanted = true, io = null;
  const sync = () => { if (visible && wanted && !(hasDOM() && document.visibilityState === 'hidden')) start?.(); else stop?.(); };
  if (hasDOM() && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver((en) => { for (const e of en) visible = e.intersectionRatio >= 0.2; sync(); }, { threshold: [0, 0.2, 0.5] });
    io.observe(f.root);
  }
  const onVis = () => sync();
  if (hasDOM()) document.addEventListener('visibilitychange', onVis);
  return {
    play() { wanted = true; sync(); }, pause() { wanted = false; stop?.(); }, step() {}, reset() {},
    runTo() { return Promise.resolve(); }, setControlsEnabled() {}, setSpeed() {},
    setHotspotMode(on, onPick) { hotspotMode(f.root, f.svg, on, onPick); },
    destroy() { stop?.(); io?.disconnect(); if (hasDOM()) document.removeEventListener('visibilitychange', onVis); extraDestroy?.(); hotspotMode(f.root, f.svg, false); f.destroy(); },
  };
}

// ---------- hotspots ----------
const HS = new WeakMap();
export function hotspotMode(root, svg, on, onPick) {
  const prev = HS.get(root);
  if (prev) { prev.forEach(({ node, click, key }) => { node.removeEventListener('click', click); node.removeEventListener('keydown', key); node.removeAttribute('tabindex'); node.removeAttribute('role'); node.removeAttribute('aria-label'); }); HS.delete(root); }
  root.classList.toggle('is-hotspot', !!on);
  root.querySelectorAll('svg.bw-sim__svg').forEach((sv) => sv.setAttribute('role', on ? 'group' : 'img'));
  if (!on) return;
  const list = [];
  root.querySelectorAll('[data-hotspot]').forEach((node) => {
    const id = node.getAttribute('data-hotspot');
    const click = (e) => { e.stopPropagation(); e.preventDefault(); onPick?.(id); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onPick?.(id); } };
    node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button');
    node.setAttribute('aria-label', node.getAttribute('data-label') || id);
    node.addEventListener('click', click); node.addEventListener('keydown', key);
    list.push({ node, click, key });
  });
  HS.set(root, list);
}

// ---------- pointer drag helper ----------
export function drag(node, { onStart, onMove, onEnd }) {
  let active = false;
  const down = (e) => { active = true; node.setPointerCapture?.(e.pointerId); onStart?.(e); onMove?.(e); e.preventDefault(); };
  const move = (e) => { if (active) { onMove?.(e); e.preventDefault(); } };
  const up = (e) => { if (!active) return; active = false; onEnd?.(e); };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return () => { node.removeEventListener('pointerdown', down); node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up); };
}
/** Pointer event → SVG viewBox coordinates. */
export function svgPoint(svg, e) {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

/** Labelled range slider with a visible <output>. */
export function slider({ label, min, max, step = 1, value, unit = '', fmtFn, onInput }) {
  const id = nextId('sl');
  const out = h('output', { for: id, class: 'bw-slider__out' });
  const input = h('input', { id, type: 'range', min, max, step, value, class: 'bw-slider__input' });
  const show = () => { out.textContent = (fmtFn ? fmtFn(Number(input.value)) : fmt(Number(input.value), step < 1 ? 1 : 0)) + unit; };
  input.addEventListener('input', () => { show(); onInput?.(Number(input.value)); });
  show();
  const el = h('div', { class: 'bw-slider' }, h('label', { for: id, class: 'bw-slider__lbl' }, label), input, out);
  return { el, input, get value() { return Number(input.value); }, set(v) { input.value = v; show(); } };
}
export function toggle({ label, checked = false, onChange }) {
  const input = h('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange?.(input.checked));
  return { el: h('label', { class: 'bw-toggle' }, input, h('span', {}, label)), input };
}
export function chipButtons(items, { value, onPick, label = 'Chọn' }) {
  const wrap = h('div', { class: 'bw-chips', role: 'radiogroup', 'aria-label': label });
  const btns = items.map((it) => {
    const b = h('button', { type: 'button', class: 'bw-chip', role: 'radio', 'aria-checked': it.value === value ? 'true' : 'false', style: it.color ? { '--chip': it.color } : null, 'data-v': it.value }, it.label);
    b.onclick = () => { set(it.value); onPick?.(it.value); };
    wrap.append(b); return b;
  });
  const set = (v) => btns.forEach((b) => b.setAttribute('aria-checked', b.dataset.v === String(v) ? 'true' : 'false'));
  return { el: wrap, set };
}

// ---------- code view ----------
const KW = {
  cpp: new Set('if else while for return const static float int bool void uint32_t uint8_t int16_t char true false nullptr auto class enum struct public private break continue unsigned String'.split(' ')),
  java: new Set('if else while for return final static float int boolean void String public private class enum new null true false try catch this'.split(' ')),
};
function tokenizeLine(line, lang) {
  const out = []; const kw = KW[lang] || KW.cpp;
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?f?\b|0x[0-9A-Fa-f]+)|([A-Za-z_]\w*)|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[1]) out.push(['com', m[1]]);
    else if (m[2] || m[3]) out.push(['str', m[2] || m[3]]);
    else if (m[4]) out.push(['num', m[4]]);
    else if (m[5]) {
      const rest = line.slice(re.lastIndex);
      out.push([kw.has(m[5]) ? 'kw' : /^\s*\(/.test(rest) ? 'fn' : /^[A-Z][A-Z0-9_]+$/.test(m[5]) ? 'const' : 'id', m[5]]);
    } else out.push(['', m[6] || m[7]]);
  }
  return out;
}
export function codeView(code, { lang = 'cpp', label = '', hotspots = {} } = {}) {
  const lines = code.replace(/\s+$/, '').split('\n');
  const pre = h('pre', { class: 'bw-code__pre', tabindex: '0' });
  const lineEls = lines.map((ln, i) => {
    const row = h('span', { class: 'bw-code__line', 'data-line': i + 1 }, h('span', { class: 'bw-code__no', 'aria-hidden': 'true' }, String(i + 1)));
    const txt = h('span', { class: 'bw-code__txt' });
    for (const [cls, t] of tokenizeLine(ln, lang)) txt.append(cls ? h('span', { class: `tk-${cls}` }, t) : t);
    if (!ln) txt.append(' ');
    row.append(txt); pre.append(row); return row;
  });
  // hotspot groups: { id: { label, lines:[a,b] } } → wrap via data attribute on lines
  for (const [id, hs] of Object.entries(hotspots)) {
    for (let n = hs.lines[0]; n <= hs.lines[1]; n++) lineEls[n - 1]?.classList.add('bw-code__hsline');
    const first = lineEls[hs.lines[0] - 1];
    if (first) { first.setAttribute('data-hotspot', id); first.setAttribute('data-label', hs.label); }
  }
  const el = h('figure', { class: 'bw-code' }, label ? h('figcaption', { class: 'bw-code__label' }, label) : null, pre);
  let cur = [];
  return {
    el, lines: lineEls, count: lines.length,
    highlight(ns = [], kind = 'run') {
      cur.forEach((n) => lineEls[n - 1]?.classList.remove('is-run', 'is-ok', 'is-no'));
      cur = ns.slice();
      cur.forEach((n) => lineEls[n - 1]?.classList.add(kind === 'ok' ? 'is-ok' : kind === 'no' ? 'is-no' : 'is-run'));
      if (ns.length) this.scrollTo(ns[0]);
    },
    scrollTo(n) {
      const row = lineEls[n - 1]; if (!row) return;
      const top = row.offsetTop - pre.clientHeight / 2 + row.offsetHeight / 2;
      if (pre.scrollHeight > pre.clientHeight) pre.scrollTop = Math.max(0, top);
    },
  };
}

// ---------- variable table ----------
export function varTable(names, { title = 'Biến', types = {} } = {}) {
  const body = h('tbody');
  const cells = {};
  for (const n of names) {
    const v = h('td', { class: 'bw-vars__v' }, '—');
    cells[n] = { v, last: undefined };
    body.append(h('tr', {}, h('th', { scope: 'row' }, h('code', {}, n), types[n] ? h('span', { class: 'bw-vars__t' }, ` ${types[n]}`) : null), v));
  }
  const el = h('table', { class: 'bw-vars' }, h('caption', {}, title), body);
  return {
    el,
    set(values, flash = true) {
      for (const [k, val] of Object.entries(values)) {
        const c = cells[k]; if (!c) continue;
        const txt = val === undefined ? '—' : typeof val === 'number' ? fmt(val, Number.isInteger(val) ? 0 : 2) : String(val);
        if (txt !== c.last) {
          c.v.textContent = txt; c.last = txt;
          if (flash) { c.v.classList.remove('is-flash'); void c.v.offsetWidth; c.v.classList.add('is-flash'); }
        }
      }
    },
  };
}

// ---------- 3D arm model (forearm + band + board + hand) ----------
// World: X right, Y forward (away from the viewer, along the forearm), Z up.
// roll > 0 = right side down (→ FOOD), pitch > 0 = hand tips down (→ HELP). Pivot at the elbow for pitch.
function prism(n, rx, rz, y0, y1, scale1 = 1, ox = 0, oz = 0) {
  const ring = (y, k) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2 + Math.PI / n; return [ox + Math.cos(a) * rx * k, y, oz + Math.sin(a) * rz * k]; });
  const A = ring(y0, scale1), B = ring(y1, 1), faces = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([A[i], A[j], B[j], B[i]]); }
  faces.push(B.slice().reverse()); faces.push(A.slice());
  return faces;
}
function box(x0, x1, y0, y1, z0, z1) {
  const p = (x, y, z) => [x, y, z];
  return [
    [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], // top
    [p(x0, y1, z0), p(x1, y1, z0), p(x1, y0, z0), p(x0, y0, z0)], // bottom
    [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], // back
    [p(x1, y1, z0), p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1)], // front
    [p(x0, y1, z0), p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1)], // left
    [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], // right
  ];
}
const ELBOW = -2.1;
function armMesh() {
  const parts = [];
  const BIAS = { arm: 0, hand: 0, band: -0.25, board: -0.5, chip: -0.6 };
  const add = (faces, color, tag) => {
    const all = faces.flat(); const c = [0, 1, 2].map((k) => all.reduce((a, p) => a + p[k], 0) / all.length);
    faces.forEach((f) => {
      const a = f[0], b = f[1], d = f[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const fc = [0, 1, 2].map((k) => f.reduce((acc, p) => acc + p[k], 0) / f.length);
      const out = n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]);
      parts.push({ f: out < 0 ? f.slice().reverse() : f, color, tag, bias: BIAS[tag] || 0 });
    });
  };
  add(prism(12, 0.46, 0.34, ELBOW, -0.05, 1.1), '#efc3a0', 'arm');
  add(prism(12, 0.5, 0.38, -0.72, -0.16), '#3b4252', 'band');
  add(box(-0.3, 0.3, -0.7, -0.18, 0.33, 0.46), '#1f6fd8', 'board');
  add(box(-0.12, 0.12, -0.56, -0.34, 0.46, 0.52), '#d7dbe2', 'chip');
  add(box(-0.44, 0.44, -0.05, 0.85, -0.15, 0.13), '#f1c7a5', 'hand');
  [-0.33, -0.11, 0.11, 0.33].forEach((x, i) => add(box(x - 0.095, x + 0.095, 0.85, [1.45, 1.6, 1.55, 1.38][i], -0.12, 0.09), '#f1c7a5', 'hand'));
  add(box(-0.66, -0.44, 0.05, 0.62, -0.12, 0.08), '#efc0a0', 'hand');
  return parts;
}
export function rotPose([x, y, z], roll, pitch, ry = 0) {
  // roll about forearm (Y) axis, then pitch about X at elbow
  const r = roll * DEG, p = pitch * DEG;
  let x1 = x * Math.cos(r) + z * Math.sin(r), z1 = -x * Math.sin(r) + z * Math.cos(r), y1 = y - ry;
  const y2 = y1 * Math.cos(p) + z1 * Math.sin(p), z2 = -y1 * Math.sin(p) + z1 * Math.cos(p);
  return [x1, y2 + ry, z2];
}
export function camera({ yaw = 22, elev = 24, scale = 60, cx = 320, cy = 200, persp = 9 } = {}) {
  // Camera sits behind the elbow, raised by `elev`, turned by `yaw`; farther points appear higher.
  const cyw = Math.cos(yaw * DEG), syw = Math.sin(yaw * DEG), ce = Math.cos(elev * DEG), se = Math.sin(elev * DEG);
  const depth = ([x, y, z]) => { const Y = x * syw + y * cyw; return Y * ce - z * se; };
  return {
    depth,
    project([x, y, z]) {
      const X = x * cyw - y * syw, Y = x * syw + y * cyw;
      const D = Y * ce - z * se, Z2 = Y * se + z * ce;
      const k = persp / (persp + D);
      return [cx + X * scale * k, cy - Z2 * scale * k];
    },
    view: [-syw * ce, -cyw * ce, se], // unit vector pointing toward the viewer
  };
}
const LIGHT = (() => { const v = [-0.4, -0.5, 0.78]; const m = Math.hypot(...v); return v.map((a) => a / m); })();
function shade(hexc, k) {
  const n = parseInt(hexc.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.round(clamp(c * k, 0, 255)).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
/**
 * Pseudo-3D arm. Returns { g, set(roll, pitch, extra), boardScreen, axisScreen }.
 * opts: camera opts + { axes:boolean, gravity:boolean, labels:boolean, axisLen }
 */
export function arm3d(parent, defs, opts = {}) {
  const cam = camera(opts);
  const g = s('g', { class: 'bw-arm' });
  const meshG = s('g', { 'stroke-linejoin': 'round' });
  const overlay = s('g', { class: 'bw-arm__overlay' });
  g.append(meshG, overlay); parent.append(g);
  const mesh = armMesh();
  const polys = mesh.map(() => meshG.appendChild(s('polygon', { 'stroke-width': 0.6 })));
  const mk = (c) => arrowMarker(defs, c, 'ax');
  const axes = opts.axes ? ['x', 'y', 'z'].map((k) => {
    const color = `var(--viz-${k})`;
    const line = s('line', { stroke: color, 'stroke-width': opts.axisWidth || 4, 'stroke-linecap': 'round', 'marker-end': mk(color) });
    const lbl = s('text', { fill: color, 'font-size': opts.axisFont || 20, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, k.toUpperCase());
    const grp = s('g', { 'data-hotspot': `axis-${k}`, 'data-label': `Trục ${k.toUpperCase()}` }, line, lbl);
    overlay.append(grp); return { line, lbl, grp };
  }) : null;
  let grav = null;
  if (opts.gravity) {
    const c = 'var(--viz-g)';
    const line = s('line', { stroke: c, 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': mk(c) });
    const lbl = s('text', { fill: c, 'font-size': 18, 'font-weight': 700 }, 'g');
    grav = { line, lbl, grp: s('g', { 'data-hotspot': 'gravity', 'data-label': 'Trọng lực' }, line, lbl) };
    overlay.append(grav.grp);
  }
  const boardCenter = [0, -0.44, 0.5];
  const api = {
    g, cam, overlay,
    set(roll, pitch) {
      const items = mesh.map((m, i) => {
        const P = m.f.map((p) => rotPose(p, roll, pitch, ELBOW));
        // normal
        const a = P[0], b = P[1], c = P[2];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const nl = Math.hypot(...n) || 1; n = n.map((q) => q / nl);
        const facing = n[0] * cam.view[0] + n[1] * cam.view[1] + n[2] * cam.view[2];
        const depth = P.reduce((acc, q) => acc + cam.depth(q), 0) / P.length + mesh[i].bias;
        return { i, P, n, facing, depth };
      });
      items.sort((p, q) => q.depth - p.depth);
      items.forEach((it, k) => {
        const poly = polys[it.i], m = mesh[it.i];
        if (it.facing <= 0.001) { poly.setAttribute('visibility', 'hidden'); return; }
        const lam = 0.62 + 0.45 * Math.max(0, it.n[0] * LIGHT[0] + it.n[1] * LIGHT[1] + it.n[2] * LIGHT[2]);
        const fill = shade(m.color, lam);
        attr(poly, { points: pts(it.P.map((q) => cam.project(q))), fill, stroke: shade(m.color, lam * 0.8), visibility: 'visible' });
        meshG.appendChild(poly);
      });
      const o = rotPose(boardCenter, roll, pitch, ELBOW);
      const O = cam.project(o);
      api.boardScreen = O;
      const L = opts.axisLen || 1.25;
      if (axes) {
        // Drawn axis directions follow the accelerometer convention used by poseToAccel/firmware tests
        // (+1 g on the axis that points UP): +X toward the wrist's left side, +Y toward the elbow, +Z up.
        // So tilting left lowers +X (x < 0) and lowering the forearm raises +Y (y > 0).
        const dirs = [[-1, 0, 0], [0, -1, 0], [0, 0, 1]];
        axes.forEach((ax, k) => {
          const d = rotPose(dirs[k], roll, pitch, 0); // directions rotate without pivot offset
          const tip = cam.project([o[0] + d[0] * L, o[1] + d[1] * L, o[2] + d[2] * L]);
          const lt = cam.project([o[0] + d[0] * (L + 0.28), o[1] + d[1] * (L + 0.28), o[2] + d[2] * (L + 0.28)]);
          attr(ax.line, { x1: O[0], y1: O[1], x2: tip[0], y2: tip[1] });
          attr(ax.lbl, { x: lt[0], y: lt[1] });
        });
      }
      if (grav) {
        const tip = cam.project([o[0], o[1], o[2] - 1.35]);
        attr(grav.line, { x1: O[0], y1: O[1], x2: tip[0], y2: tip[1] });
        attr(grav.lbl, { x: tip[0] + 10, y: tip[1] });
      }
      return api;
    },
  };
  return api;
}

// ---------- gesture chips & speech ----------
export function cmdChip(parent, { x, y, cmd, color, size = 18, w }) {
  const width = w || Math.max(64, cmd.length * size * 0.72 + 26);
  const g = s('g', { class: 'bw-cmdchip', transform: `translate(${x},${y})` });
  const rect = s('rect', { x: -width / 2, y: -size * 0.95, width, height: size * 1.9, rx: size * 0.95, fill: color, stroke: 'rgba(0,0,0,.18)' });
  const txt = s('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size, 'font-weight': 700, fill: 'var(--c-text-on-light, #21242c)', 'font-family': 'var(--mono, monospace)' }, cmd);
  g.append(rect, txt); parent.append(g);
  return { g, rect, txt, set(c, col) { txt.textContent = c; if (col) rect.setAttribute('fill', col); } };
}

export function viVoice() {
  if (!hasDOM() || !('speechSynthesis' in window)) return null;
  const vs = window.speechSynthesis.getVoices() || [];
  return vs.find((v) => /^vi(-|_|$)/i.test(v.lang)) || null;
}
/** Calls cb(voiceOrNull) now and whenever voices change. Returns unsubscribe. */
export function watchVoice(cb) {
  if (!hasDOM() || !('speechSynthesis' in window)) { cb(null); return () => {}; }
  const f = () => cb(viVoice());
  f();
  window.speechSynthesis.addEventListener?.('voiceschanged', f);
  return () => window.speechSynthesis.removeEventListener?.('voiceschanged', f);
}
export function speakVi(text, { rate = 0.9, onend } = {}) {
  const v = viVoice(); if (!v) return false;
  try {
    window.speechSynthesis.cancel(); // like QUEUE_FLUSH: a new phrase interrupts the old one
    const u = new SpeechSynthesisUtterance(text); u.lang = 'vi-VN'; u.voice = v; u.rate = rate;
    if (onend) u.onend = onend;
    window.speechSynthesis.speak(u); return true;
  } catch { return false; }
}
export function listenButton(text, { label = '🔊 Nghe' } = {}) {
  const b = h('button', { type: 'button', class: 'bw-btn bw-btn--listen' }, label);
  let phrase = text;
  const off = watchVoice((v) => {
    b.disabled = !v;
    b.textContent = v ? label : 'Trình duyệt chưa có giọng tiếng Việt';
    b.title = v ? `Đọc: ${phrase}` : 'Trình duyệt chưa có giọng tiếng Việt';
  });
  b.onclick = () => speakVi(phrase);
  return { el: b, setText(t) { phrase = t; }, destroy: off };
}

/** Linear map helper for charts. */
export const scale = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

// ---------- 2D wrist pictograms ----------
/** Wrist seen from behind (looking along the forearm): cross-section + band + board + hand edge. set(roll). */
export function wristCross(parent, { cx, cy, r = 70, board = true, label = true } = {}) {
  const g = s('g', { class: 'bw-wrist' });
  const rot = s('g');
  const k = r / 70;
  // hand behind (edge-on, slightly higher) with thumb
  rot.append(s('path', { d: `M${-78 * k},${-22 * k} q0,-26 ${26 * k},-30 l${100 * k},0 q${26 * k},4 ${26 * k},30 q0,16 ${-20 * k},18 l${-110 * k},0 q${-22 * k},-2 ${-22 * k},-18 z`, fill: '#e9b893', stroke: '#c98e66', 'stroke-width': 1.5, transform: `translate(0,${-26 * k})` }));
  rot.append(s('ellipse', { cx: -82 * k, cy: -40 * k, rx: 16 * k, ry: 12 * k, fill: '#e9b893', stroke: '#c98e66', 'stroke-width': 1.5 }));
  // forearm cross-section
  rot.append(s('ellipse', { cx: 0, cy: 0, rx: 74 * k, ry: 54 * k, fill: '#f1c7a5', stroke: '#c98e66', 'stroke-width': 2 }));
  rot.append(s('ellipse', { cx: 0, cy: 0, rx: 80 * k, ry: 60 * k, fill: 'none', stroke: '#3b4252', 'stroke-width': 9 * k }));
  if (board) {
    rot.append(s('rect', { x: -34 * k, y: -78 * k, width: 68 * k, height: 18 * k, rx: 3 * k, fill: '#1f6fd8', stroke: '#124a96' }));
    rot.append(s('rect', { x: -12 * k, y: -84 * k, width: 24 * k, height: 8 * k, rx: 1.5 * k, fill: '#d7dbe2', stroke: '#9aa1ad' }));
    if (label) rot.append(s('text', { x: 0, y: -64 * k, 'text-anchor': 'middle', 'font-size': 11 * k, 'font-weight': 700, fill: '#fff' }, 'IMU'));
  }
  g.append(rot); parent.append(g);
  g.setAttribute('transform', `translate(${cx},${cy})`);
  const boardY = -69 * k;
  return {
    g, rot,
    set(roll) { rot.setAttribute('transform', `rotate(${roll})`); },
    /** screen position of the board centre for a roll angle */
    boardAt(roll) { const a = roll * DEG; return [cx - boardY * Math.sin(a), cy + boardY * Math.cos(a)]; },
  };
}

/** Side view: upper arm stub + forearm (with band/board) + hand; pitch tips the forearm at the elbow. */
export function armSide(parent, { ex, ey, len = 210, k = 1 } = {}) {
  const g = s('g', { class: 'bw-armside' });
  const fore = s('g');
  fore.append(s('rect', { x: -10, y: -26 * k, width: len, height: 52 * k, rx: 24 * k, fill: '#f1c7a5', stroke: '#c98e66', 'stroke-width': 2 }));
  fore.append(s('rect', { x: len - 74 * k, y: -31 * k, width: 40 * k, height: 62 * k, rx: 8 * k, fill: '#3b4252' }));
  fore.append(s('rect', { x: len - 70 * k, y: -44 * k, width: 32 * k, height: 14 * k, rx: 3, fill: '#1f6fd8', stroke: '#124a96' }));
  const hand = s('g', { transform: `translate(${len - 8},0)` });
  hand.append(s('path', { d: `M0,${-22 * k} q${40 * k},-6 ${70 * k},2 q${30 * k},6 ${40 * k},14 q${4 * k},8 ${-6 * k},10 l${-40 * k},0 q${-6 * k},10 ${-30 * k},12 q${-24 * k},2 ${-34 * k},-4 z`, fill: '#e9b893', stroke: '#c98e66', 'stroke-width': 2 }));
  fore.append(hand);
  g.append(s('circle', { cx: 0, cy: 0, r: 30 * k, fill: '#efc3a0', stroke: '#c98e66', 'stroke-width': 2 }), fore);
  parent.append(g);
  g.setAttribute('transform', `translate(${ex},${ey})`);
  return {
    g, fore, hand,
    set(pitch) { fore.setAttribute('transform', `rotate(${pitch})`); },
    boardAt(pitch) { const a = pitch * DEG, bx = len - 54 * k, by = -37 * k; return [ex + bx * Math.cos(a) - by * Math.sin(a), ey + bx * Math.sin(a) + by * Math.cos(a)]; },
    handAt(pitch) { const a = pitch * DEG, bx = len + 60 * k, by = 0; return [ex + bx * Math.cos(a) - by * Math.sin(a), ey + bx * Math.sin(a) + by * Math.cos(a)]; },
  };
}
