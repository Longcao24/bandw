// Small DOM + data helpers. No DOM access at module top level.

/** el('button.btn.primary', {onclick, type:'button', 'aria-label': '…'}, 'text', childNode, [more]) */
export function el(tag, attrs, ...children) {
  const [head, ...classes] = tag.split('.');
  const [name, id] = head.split('#');
  const node = document.createElement(name || 'div');
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className += (node.className ? ' ' : '') + v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) node.style.setProperty(sk, sv); else node.style[sk] = sv; } }
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, String(v));
    }
  }
  append(node, children);
  return node;
}
function append(node, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function debounce(fn, ms) {
  let t = null;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...args); }, ms); };
  d.flush = (...args) => { if (t) { clearTimeout(t); t = null; } fn(...args); };
  d.cancel = () => { clearTimeout(t); t = null; };
  d.pending = () => t !== null;
  return d;
}

/** Deterministic PRNG from a string seed (xmur3 + mulberry32). */
export function seededRandom(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates; returns a new array. */
export function shuffle(arr, seed = 'x') {
  const rnd = seededRandom(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffled index permutation guaranteed not to be the identity (when n ≥ 2). */
export function shuffledIndices(n, seed) {
  const idx = [...Array(n).keys()];
  if (n < 2) return idx;
  let p = shuffle(idx, seed);
  let k = 0;
  while (p.every((v, i) => v === i) && k < 10) p = shuffle(idx, seed + ':' + ++k);
  if (p.every((v, i) => v === i)) p = [...idx.slice(1), idx[0]];
  return p;
}

export const fmtNumber = (n) => new Intl.NumberFormat('vi-VN').format(n);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function todayStr(d = new Date()) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function yesterdayStr(d = new Date()) {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return todayStr(y);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function svgNode(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export function timeAgo(ms) {
  if (!ms) return 'chưa bao giờ';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
}
