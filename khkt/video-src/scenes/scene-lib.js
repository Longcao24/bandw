// BandW video scene library: deterministic SVG drawing driven by window.BW_SCENE.seek(t).
// No requestAnimationFrame, no Date.now(): every frame is a pure function of t and the cue timeline.

export const W = 1280, H = 720;
export const FONT = "'Avenir Next','Helvetica Neue',Arial,sans-serif";
export const MONO = "Menlo,'SF Mono',Consolas,monospace";

export const C = {
  bg: '#f7f8fa', surface: '#ffffff', surface2: '#f0f2f5', border: '#d6d8de',
  text: '#21242c', muted: '#5b616e', primary: '#1865f2', primarySoft: '#e8f0fe',
  success: '#0d7a35', successBright: '#1fab54', successBg: '#e3f5e8',
  danger: '#c4280f', dangerBg: '#fdecea', warn: '#9a5200', warnBg: '#fff3e0', energy: '#f2a900',
  x: '#e5484d', y: '#2f9e5b', z: '#0b7ae0', g: '#8e4ec6',
  enter: '#d92916', exit: '#b35c00', neutral: 'rgba(47,158,91,.15)', packet: '#1865f2',
  skin: '#f4c9a6', skinDark: '#d9a27c', strap: '#34405a', module: '#22304a', pcb: '#1f5f8b',
  codeBg: '#1f2433', codeText: '#e6e9ef', codeHl: 'rgba(242,169,0,.28)',
};
export const CMD = {
  WATER: { color: '#E4EFF9', ink: '#1d5b99', phrase: 'Tôi muốn uống nước.', label: '← Nghiêng tay trái' },
  FOOD: { color: '#F6EFCF', ink: '#8a6a00', phrase: 'Tôi muốn ăn.', label: '→ Nghiêng tay phải' },
  NO: { color: '#FCEAE5', ink: '#b2401f', phrase: 'Không.', label: '↔ Lắc cổ tay' },
  YES: { color: '#E3F2DF', ink: '#2c7a2c', phrase: 'Có.', label: '✌ Gõ 2 lần' },
  HELP: { color: '#F7C6C0', ink: '#a3241b', phrase: 'Tôi cần giúp đỡ.', label: '↕ Hạ cẳng tay rồi nâng lại, 2 lần' },
};

// ---------- math / easing ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, u) => a + (b - a) * u;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const ease = (u) => (u = clamp(u), u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
export const pop = (u) => { u = clamp(u); const s = 1.70158; return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); };
export const rad = (d) => d * Math.PI / 180;
export const fmt = (v, d = 2) => v.toFixed(d).replace('.', ',').replace(/^-0(,0+)?$/, '0$1');
export const pulse = (t, period = 1) => 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / period);

// ---------- svg primitives ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => `${k}="${typeof v === 'number' ? +v.toFixed(2) : esc(v)}"`).join(' ');

export function T(x, y, s, o = {}) {
  return `<text ${attrs({ x, y, 'font-size': o.size || 24, 'font-weight': o.w || 500, fill: o.fill || C.text,
    'text-anchor': o.anchor || 'start', 'font-family': o.mono ? MONO : FONT, opacity: o.op,
    'dominant-baseline': o.base || undefined, 'letter-spacing': o.ls, 'font-style': o.italic ? 'italic' : undefined })}>${esc(s)}</text>`;
}
export function R(x, y, w, h, o = {}) {
  return `<rect ${attrs({ x, y, width: Math.max(0, w), height: Math.max(0, h), rx: o.r ?? 0, fill: o.fill || 'none',
    stroke: o.stroke, 'stroke-width': o.sw, opacity: o.op, 'stroke-dasharray': o.dash, filter: o.shadow ? 'url(#sh)' : undefined })}/>`;
}
export function L(x1, y1, x2, y2, o = {}) {
  return `<line ${attrs({ x1, y1, x2, y2, stroke: o.stroke || C.text, 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash,
    'stroke-linecap': o.cap || 'round', opacity: o.op })}/>`;
}
export function Ci(cx, cy, r, o = {}) {
  return `<circle ${attrs({ cx, cy, r: Math.max(0, r), fill: o.fill || 'none', stroke: o.stroke, 'stroke-width': o.sw, opacity: o.op,
    'stroke-dasharray': o.dash, filter: o.shadow ? 'url(#sh)' : undefined })}/>`;
}
export function P(d, o = {}) {
  return `<path ${attrs({ d, fill: o.fill || 'none', stroke: o.stroke, 'stroke-width': o.sw, opacity: o.op, 'stroke-dasharray': o.dash,
    'stroke-linecap': o.cap || 'round', 'stroke-linejoin': 'round', filter: o.shadow ? 'url(#sh)' : undefined })}/>`;
}
export function G(inner, o = {}) {
  const tr = [];
  if (o.tx || o.ty) tr.push(`translate(${+(o.tx || 0).toFixed(2)} ${+(o.ty || 0).toFixed(2)})`);
  if (o.rot) tr.push(`rotate(${+o.rot.toFixed(3)} ${o.cx || 0} ${o.cy || 0})`);
  if (o.sc !== undefined && o.sc !== 1) tr.push(`scale(${+o.sc.toFixed(4)})`);
  return `<g ${attrs({ transform: tr.join(' ') || undefined, opacity: o.op === undefined ? undefined : clamp(o.op) })}>${inner}</g>`;
}
export function arrow(x1, y1, x2, y2, o = {}) {
  const sw = o.sw || 4, head = o.head || sw * 3.2, color = o.stroke || C.text;
  const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return '';
  const bx = x2 - Math.cos(a) * head * 0.9, by = y2 - Math.sin(a) * head * 0.9;
  const p1 = [x2 - Math.cos(a - 0.45) * head, y2 - Math.sin(a - 0.45) * head];
  const p2 = [x2 - Math.cos(a + 0.45) * head, y2 - Math.sin(a + 0.45) * head];
  return L(x1, y1, bx, by, { stroke: color, sw, dash: o.dash, op: o.op }) +
    P(`M${x2} ${y2} L${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]} Z`, { fill: color, op: o.op });
}
export function card(x, y, w, h, o = {}) { return R(x, y, w, h, { r: o.r ?? 18, fill: o.fill || C.surface, stroke: o.stroke || C.border, sw: o.sw ?? 1.5, shadow: o.shadow !== false, op: o.op }); }
export function pill(x, y, text, o = {}) {
  const size = o.size || 22, w = o.w || Math.max(60, textWidth(text, size) + size * 1.4), h = size * 1.75;
  const x0 = o.anchor === 'middle' ? x - w / 2 : x;
  return R(x0, y - h / 2, w, h, { r: h / 2, fill: o.fill || C.primarySoft, stroke: o.stroke, sw: o.sw }) +
    T(x0 + w / 2, y + size * 0.36, text, { size, w: o.weight || 700, fill: o.ink || C.primary, anchor: 'middle', mono: o.mono });
}
export function textWidth(s, size) { // rough width estimate for layout of pills/bubbles
  let w = 0; for (const ch of String(s)) w += /[mwMWĐ@%]/.test(ch) ? 0.85 : /[A-Z0-9]/.test(ch) ? 0.66 : /[il.,:;'|!]/.test(ch) ? 0.3 : ch === ' ' ? 0.3 : 0.55;
  return w * size;
}
export function chip(cmd, x, y, o = {}) {
  const c = CMD[cmd]; const size = o.size || 26;
  return pill(x, y, cmd, { size, fill: c.color, ink: '#21242c', anchor: o.anchor || 'middle', stroke: c.ink, sw: 2, mono: true, w: o.w });
}
export function bubble(x, y, w, h, text, o = {}) { // speech bubble with tail at bottom-left
  const size = o.size || 30;
  return G(P(`M${x + 18} ${y} h${w - 36} a18 18 0 0 1 18 18 v${h - 36} a18 18 0 0 1 -18 18 h${-w + 80} l-34 30 l6 -30 h-10 a18 18 0 0 1 -18 -18 v${-h + 36} a18 18 0 0 1 18 -18 z`,
    { fill: o.fill || C.surface, stroke: o.stroke || C.border, sw: 2, shadow: true }) +
    T(x + w / 2, y + h / 2 + size * 0.35, text, { size, w: 700, anchor: 'middle', fill: o.ink || C.text }), { op: o.op });
}
export function wrapText(s, maxChars) {
  const words = String(s).split(' '); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
export function para(x, y, s, o = {}) {
  const size = o.size || 26, lh = o.lh || size * 1.35;
  return wrapText(s, o.max || 40).map((ln, i) => T(x, y + i * lh, ln, { ...o, size })).join('');
}

// ---------- characters & devices ----------
// Band module with a friendly face (the BandW "character").
export function bandFace(cx, cy, s = 1, o = {}) {
  const w = 96 * s, h = 64 * s; const blink = o.blink ? 0.15 : 1;
  const led = o.led ? Ci(cx + w / 2 - 14 * s, cy - h / 2 + 13 * s, 5.5 * s, { fill: o.ledColor || '#4cd964', stroke: '#fff', sw: 1.5 * s }) : '';
  return R(cx - w / 2, cy - h / 2, w, h, { r: 16 * s, fill: C.module, stroke: '#141c2c', sw: 2 * s }) +
    R(cx - w / 2 + 8 * s, cy - h / 2 + 8 * s, w - 16 * s, h - 16 * s, { r: 10 * s, fill: '#2d3f62' }) +
    `<ellipse ${attrs({ cx: cx - 17 * s, cy: cy - 4 * s, rx: 6 * s, ry: 7.5 * s * blink, fill: '#fff' })}/>` +
    `<ellipse ${attrs({ cx: cx + 17 * s, cy: cy - 4 * s, rx: 6 * s, ry: 7.5 * s * blink, fill: '#fff' })}/>` +
    P(`M${cx - 11 * s} ${cy + 10 * s} Q${cx} ${cy + 19 * s} ${cx + 11 * s} ${cy + 10 * s}`, { stroke: '#fff', sw: 3 * s }) + led;
}
// Front view of the forearm cross-section (seen from behind the user's hand) with the band on top.
// roll in degrees: negative = tilt left (left side goes down), as in the firmware (roll < 0 → WATER).
export function armFront(cx, cy, roll = 0, o = {}) {
  const s = o.s || 1;
  let g = '';
  // hand silhouette behind (fingers pointing away), gives orientation cue
  g += P(`M${-118 * s} ${8 * s} C${-140 * s} ${-60 * s} ${-60 * s} ${-70 * s} 0 ${-70 * s} C${60 * s} ${-70 * s} ${140 * s} ${-60 * s} ${118 * s} ${8 * s} Z`, { fill: C.skinDark, op: 0.55 });
  g += `<ellipse ${attrs({ cx: 0, cy: 0, rx: 130 * s, ry: 62 * s, fill: C.skin, stroke: C.skinDark, sw: 3 * s })}/>`;
  g += P(`M${-136 * s} ${-6 * s} C${-150 * s} ${-28 * s} ${-160 * s} ${-26 * s} ${-170 * s} ${-14 * s} C${-178 * s} ${0} ${-160 * s} ${10 * s} ${-130 * s} ${16 * s}`, { fill: C.skin, stroke: C.skinDark, sw: 3 * s }); // thumb on the left
  // strap: thick ring outline
  g += `<ellipse ${attrs({ cx: 0, cy: 0, rx: 136 * s, ry: 68 * s, fill: 'none', stroke: C.strap, 'stroke-width': 12 * s })}/>`;
  g += G(bandFace(0, -70 * s, 0.95 * s, o), {});
  if (o.axes) {
    const ax = 0, ay = -70 * s;
    // +X points to the wrist's left side (seen from behind): tilting left lowers +X, so x reads negative,
    // matching the accelerometer convention (+1 g on the axis that points up) and the firmware tests.
    g += arrow(ax, ay, ax - 150 * s, ay, { stroke: C.x, sw: 5 * s }) + T(ax - 160 * s, ay + 9 * s, 'X', { size: 30 * s, w: 700, fill: C.x, anchor: 'end' });
    g += arrow(ax, ay, ax, ay - 140 * s, { stroke: C.z, sw: 5 * s }) + T(ax + 12 * s, ay - 128 * s, 'Z', { size: 30 * s, w: 700, fill: C.z });
    if (o.axisY) g += Ci(ax, ay, 13 * s, { fill: '#fff', stroke: C.y, sw: 4 * s }) + Ci(ax, ay, 4 * s, { fill: C.y }) + T(ax - 46 * s, ay + 44 * s, 'Y', { size: 30 * s, w: 700, fill: C.y });
  }
  return G(G(g, { rot: roll }), { tx: cx, ty: cy });
}
// Gravity g (down) plus what the accelerometer measures, a = −g (dashed, up), with a split into legs
// along board X and Z: a = x·X̂ + z·Ẑ. Signs match the readings because +X/+Z are drawn as in armFront.
export function gravityTriangle(cx, cy, roll, len = 170, o = {}) {
  const r = rad(roll); const xv = Math.sin(r), zv = Math.cos(r);
  // board axes in screen coords (SVG y down); board rotated by `roll` (SVG rotate, clockwise positive)
  const X = [-Math.cos(r), -Math.sin(r)];
  const top = [cx, cy - len]; // tip of a = −g
  const foot = [cx + X[0] * xv * len, cy + X[1] * xv * len];
  let s = '';
  s += arrow(cx, cy, cx, cy + len, { stroke: C.g, sw: 6 });
  s += L(cx, cy, top[0], top[1], { stroke: C.g, sw: 4, dash: '10 8' });
  s += L(cx, cy, foot[0], foot[1], { stroke: C.x, sw: 6, dash: '2 10' }) + L(foot[0], foot[1], top[0], top[1], { stroke: C.z, sw: 6, dash: '2 10' });
  s += Ci(cx, cy, 7, { fill: C.g });
  s += T(cx + 12, top[1] - 8, 'a đo được = −g', { size: 22, w: 700, fill: C.g });
  if (o.labels !== false) {
    s += T(cx + 14, cy + len - 6, 'g = 1 g', { size: 26, w: 700, fill: C.g });
    const side = foot[0] >= cx ? 1 : -1;
    const mx = (cx + foot[0]) / 2, my = (cy + foot[1]) / 2;
    s += T(mx + side * 14, my + 30, `x = ${fmt(xv)}`, { size: 26, w: 700, fill: C.x, anchor: side > 0 ? 'start' : 'end' });
    const zx = (foot[0] + top[0]) / 2, zy = (foot[1] + top[1]) / 2;
    s += T(zx + side * 20, zy, `z = ${fmt(zv)}`, { size: 26, w: 700, fill: C.z, anchor: side > 0 ? 'start' : 'end' });
  }
  return s;
}
// Side view: elbow at (ex,ey), forearm+hand rotating down by pitch (deg, positive = flex forward/down).
export function armSide(ex, ey, pitch = 0, o = {}) {
  const s = o.s || 1;
  let g = '';
  g += R(-30 * s, -38 * s, 300 * s, 76 * s, { r: 38 * s, fill: C.skin, stroke: C.skinDark, sw: 3 * s });
  g += P(`M${250 * s} ${-36 * s} h${70 * s} q${60 * s} 0 ${70 * s} ${26 * s} l${8 * s} ${10 * s} q${4 * s} ${16 * s} ${-14 * s} ${14 * s} h${-60 * s} l${0} ${22 * s} h${-74 * s} z`, { fill: C.skin, stroke: C.skinDark, sw: 3 * s });
  g += R(185 * s, -44 * s, 26 * s, 88 * s, { r: 8 * s, fill: C.strap });
  g += G(bandFace(198 * s, -64 * s, 0.7 * s, o), {});
  if (o.axes) {
    // +Y points toward the elbow, so lowering the forearm raises +Y and y reads positive (same as the site sims).
    g += arrow(198 * s, -64 * s, 40 * s, -64 * s, { stroke: C.y, sw: 5 * s }) + T(30 * s, -56 * s, 'Y', { size: 28 * s, w: 700, fill: C.y, anchor: 'end' });
    g += arrow(198 * s, -64 * s, 198 * s, -180 * s, { stroke: C.z, sw: 5 * s }) + T(210 * s, -168 * s, 'Z', { size: 28 * s, w: 700, fill: C.z });
  }
  return G(G(g, { rot: pitch }), { tx: ex, ty: ey }) + Ci(ex, ey, 10 * s, { fill: C.skinDark });
}
export function phone(x, y, w, h, inner = '', o = {}) {
  return R(x, y, w, h, { r: 34, fill: '#1c2230', shadow: true }) + R(x + 10, y + 14, w - 20, h - 28, { r: 24, fill: o.screen || '#ffffff' }) +
    R(x + w / 2 - 34, y + 22, 68, 10, { r: 5, fill: '#1c2230' }) + G(inner, { tx: x + 10, ty: y + 14 });
}
export function speaker(cx, cy, s = 1, level = 0, t = 0) {
  let g = P(`M${-34 * s} ${-18 * s} h${22 * s} l${30 * s} ${-26 * s} v${88 * s} l${-30 * s} ${-26 * s} h${-22 * s} z`, { fill: C.text });
  for (let i = 0; i < 3; i++) {
    const a = clamp(level * (0.6 + 0.4 * Math.sin(t * 9 - i * 1.3)));
    g += P(`M${(30 + i * 22) * s} ${-30 * s + i * -10 * s} Q${(52 + i * 26) * s} 0 ${(30 + i * 22) * s} ${30 * s + i * 10 * s}`, { stroke: C.primary, sw: 6 * s, op: a });
  }
  return G(g, { tx: cx, ty: cy });
}
export function chipIcon(cx, cy, w, h, label, o = {}) {
  let g = '';
  const pins = o.pins ?? 5;
  for (let i = 0; i < pins; i++) {
    const px = cx - w / 2 + (i + 0.5) * w / pins;
    g += R(px - 5, cy - h / 2 - 12, 10, 14, { r: 2, fill: '#9aa3b2' }) + R(px - 5, cy + h / 2 - 2, 10, 14, { r: 2, fill: '#9aa3b2' });
  }
  g += R(cx - w / 2, cy - h / 2, w, h, { r: 12, fill: o.fill || '#2b3245', stroke: o.stroke || '#141a26', sw: o.sw || 2 });
  g += Ci(cx - w / 2 + 14, cy - h / 2 + 14, 4, { fill: '#5b657a' });
  g += T(cx, cy + (o.sub ? -2 : 9), label, { size: o.size || 26, w: 700, fill: '#fff', anchor: 'middle' });
  if (o.sub) g += T(cx, cy + 26, o.sub, { size: 17, w: 500, fill: '#c6cddb', anchor: 'middle' });
  return g;
}
export function bleWaves(cx, cy, t, o = {}) {
  let g = '';
  const n = o.n || 3, period = o.period || 1.2, maxR = o.maxR || 90, dir = o.dir || 0;
  for (let i = 0; i < n; i++) {
    const ph = ((t / period + i / n) % 1);
    const r = 16 + ph * maxR, op = (1 - ph) * (o.op ?? 1);
    if (o.arc) {
      const a0 = rad(dir - 40), a1 = rad(dir + 40);
      g += P(`M${cx + Math.cos(a0) * r} ${cy + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${cx + Math.cos(a1) * r} ${cy + Math.sin(a1) * r}`, { stroke: o.color || C.packet, sw: 5, op });
    } else g += Ci(cx, cy, r, { stroke: o.color || C.packet, sw: 4, op });
  }
  return g;
}
export function btGlyph(cx, cy, s = 1, color = '#fff') {
  return P(`M${cx - 12 * s} ${cy - 12 * s} L${cx + 12 * s} ${cy + 12 * s} L${cx} ${cy + 24 * s} L${cx} ${cy - 24 * s} L${cx + 12 * s} ${cy - 12 * s} L${cx - 12 * s} ${cy + 12 * s}`, { stroke: color, sw: 4 * s });
}
export function packet(cx, cy, label, o = {}) {
  const size = o.size || 24, w = o.w || textWidth(label, size) + 36, h = size * 1.8;
  return G(R(cx - w / 2, cy - h / 2, w, h, { r: 10, fill: o.fill || C.packet, shadow: true }) +
    T(cx, cy + size * 0.36, label, { size, w: 700, fill: '#fff', anchor: 'middle', mono: true }), { op: o.op });
}
export function ring(cx, cy, r, p, o = {}) {
  p = clamp(p); const a = rad(-90 + 360 * p);
  const large = p > 0.5 ? 1 : 0;
  const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  return Ci(cx, cy, r, { stroke: o.track || '#e1e4ea', sw: o.sw || 14 }) +
    (p >= 0.999 ? Ci(cx, cy, r, { stroke: o.color || C.primary, sw: o.sw || 14 })
      : p > 0.001 ? P(`M${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${x} ${y}`, { stroke: o.color || C.primary, sw: o.sw || 14 }) : '');
}
export function led(cx, cy, on, o = {}) {
  const col = o.color || '#2fd06b';
  return (on ? Ci(cx, cy, (o.r || 16) * 2.1, { fill: col, op: 0.25 }) : '') + Ci(cx, cy, o.r || 16, { fill: on ? col : '#c9ced8', stroke: '#8a93a3', sw: 2 });
}
export function check(cx, cy, s = 1, color = C.successBright) {
  return Ci(cx, cy, 22 * s, { fill: color }) + P(`M${cx - 10 * s} ${cy} l${7 * s} ${8 * s} l${13 * s} ${-15 * s}`, { stroke: '#fff', sw: 5 * s });
}
export function cross(cx, cy, s = 1, color = C.danger) {
  return Ci(cx, cy, 22 * s, { fill: color }) + P(`M${cx - 8 * s} ${cy - 8 * s} l${16 * s} ${16 * s} M${cx + 8 * s} ${cy - 8 * s} l${-16 * s} ${16 * s}`, { stroke: '#fff', sw: 5 * s });
}
export function burst(cx, cy, u, color = C.energy, rMax = 90) {
  if (u <= 0 || u >= 1) return '';
  let g = ''; const r0 = 20 + u * rMax * 0.4, r1 = 30 + u * rMax;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    g += L(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, { stroke: color, sw: 6, op: 1 - u });
  }
  return g;
}

// ---------- charts ----------
// series: [{data:[[t,v],...], color, sw, label}], lines: [{v,color,dash,label}], bands: [{v0,v1,fill}]
export function chart(o) {
  const { x, y, w, h, t0, t1, v0, v1 } = o;
  const X = (t) => x + (t - t0) / (t1 - t0) * w, Y = (v) => y + h - (clamp(v, v0, v1) - v0) / (v1 - v0) * h;
  let g = R(x, y, w, h, { r: 10, fill: o.fill || '#fff', stroke: C.border, sw: 1.5 });
  for (const b of o.bands || []) g += R(x, Y(b.v1), w, Y(b.v0) - Y(b.v1), { fill: b.fill });
  if (o.zero !== false && v0 < 0 && v1 > 0) g += L(x, Y(0), x + w, Y(0), { stroke: '#b9bfca', sw: 1.5 });
  for (const ln of o.lines || []) {
    g += L(x, Y(ln.v), x + w, Y(ln.v), { stroke: ln.color, sw: ln.sw || 3, dash: ln.dash || '10 8', cap: 'butt' });
    if (ln.label) g += T(x + w - 8, Y(ln.v) + (ln.below ? 24 : -8), ln.label, { size: ln.size || 19, w: 700, fill: ln.color, anchor: 'end' });
  }
  for (const s of o.series || []) {
    const pts = s.data.filter(([t]) => t >= t0 && t <= (o.until ?? t1)).map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`);
    if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="${s.sw || 4}" stroke-linejoin="round" stroke-linecap="round" ${s.op ? `opacity="${s.op}"` : ''} ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
  }
  if (o.cursor !== undefined) g += L(X(o.cursor), y, X(o.cursor), y + h, { stroke: C.text, sw: 2, dash: '4 6', op: 0.6 });
  if (o.ylabel) g += T(x + 12, y + 28, o.ylabel, { size: 20, w: 700, fill: C.muted });
  if (o.xlabel) g += T(x + w, y + h + 28, o.xlabel, { size: 18, w: 500, fill: C.muted, anchor: 'end' });
  return { svg: g, X, Y };
}

// ---------- code ----------
const KW = /\b(if|else|return|while|for|const|static|float|int|bool|void|uint32_t|uint8_t|char|true|false|nullptr|public|class|enum|String|try|catch|null|new)\b/g;
function hlLine(s) {
  // minimal tokenizer: comments, strings, numbers, keywords
  const out = []; let rest = s;
  const ci = rest.indexOf('//');
  let comment = '';
  if (ci >= 0 && !/"[^"]*\/\/[^"]*"/.test(rest)) { comment = rest.slice(ci); rest = rest.slice(0, ci); }
  const parts = rest.split(/("[^"]*")/);
  for (const p of parts) {
    if (p.startsWith('"')) { out.push(`<tspan fill="#f2c16b">${esc(p)}</tspan>`); continue; }
    out.push(esc(p).replace(KW, '<tspan fill="#8fb4ff">$1</tspan>').replace(/\b(\d+(?:\.\d+)?f?)\b/g, '<tspan fill="#ff9f7a">$1</tspan>'));
  }
  if (comment) out.push(`<tspan fill="#8b93a7">${esc(comment)}</tspan>`);
  return out.join('');
}
export function codePanel(x, y, w, lines, o = {}) {
  const size = o.size || 19, lh = o.lh || size * 1.55, pad = 18, top = o.title ? 44 : 14;
  const h = o.h || top + lines.length * lh + pad;
  let g = R(x, y, w, h, { r: 16, fill: C.codeBg, shadow: true });
  if (o.title) g += T(x + pad, y + 30, o.title, { size: 17, w: 600, fill: '#9aa3b8' }) + L(x, y + 42, x + w, y + 42, { stroke: '#2d3448', sw: 2 });
  const hl = new Set(o.hl || []);
  lines.forEach((ln, i) => {
    const ly = y + top + i * lh;
    if (hl.has(i + 1)) g += R(x + 6, ly + 2, w - 12, lh, { r: 6, fill: o.hlColor || C.codeHl }) + R(x + 6, ly + 2, 5, lh, { r: 2, fill: C.energy });
    if (o.numbers !== false) g += T(x + pad + 14, ly + lh * 0.72, String(i + 1), { size: size * 0.82, mono: true, fill: '#5d667c', anchor: 'end' });
    g += `<text x="${x + pad + 30}" y="${(ly + lh * 0.72).toFixed(1)}" font-family="${MONO}" font-size="${size}" fill="${C.codeText}" xml:space="preserve">${hlLine(ln)}</text>`;
  });
  return g;
}
export function varTable(x, y, rows, o = {}) {
  const w = o.w || 300, rh = o.rh || 44, size = o.size || 21;
  let g = card(x, y, w, (o.title ? 46 : 8) + rows.length * rh + 8, { r: 14 });
  if (o.title) g += T(x + 18, y + 32, o.title, { size: 19, w: 700, fill: C.muted });
  rows.forEach(([name, val, flash], i) => {
    const ry = y + (o.title ? 46 : 8) + i * rh;
    if (flash) g += R(x + 6, ry + 2, w - 12, rh - 4, { r: 8, fill: C.energy, op: 0.25 * clamp(flash) });
    g += T(x + 18, ry + rh * 0.66, name, { size, mono: true, fill: C.muted });
    g += T(x + w - 18, ry + rh * 0.66, String(val), { size, mono: true, w: 700, fill: C.text, anchor: 'end' });
  });
  return g;
}

// ---------- state machine ----------
export const STATES = [
  { id: 'neutral', label: 'Chờ trung tính' }, { id: 'armed', label: 'Sẵn sàng' }, { id: 'candidate', label: 'Đang giữ' },
  { id: 'emit', label: 'Phát lệnh' }, { id: 'cooldown', label: 'Nghỉ 650 ms' },
];
export function stateMachine(cx, cy, active, o = {}) {
  const r = o.r || 170, nw = o.nw || 190, nh = o.nh || 64;
  const pos = STATES.map((s, i) => { const a = rad(-90 + i * 72); return [cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r]; });
  let g = '';
  for (let i = 0; i < 5; i++) {
    const [x1, y1] = pos[i], [x2, y2] = pos[(i + 1) % 5];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const sx = x1 + dx / len * 80, sy = y1 + dy / len * 44, ex = x2 - dx / len * 86, ey = y2 - dy / len * 48;
    const on = o.edge === i;
    g += arrow(sx, sy, ex, ey, { stroke: on ? C.energy : '#aab1bf', sw: on ? 6 : 4 });
  }
  STATES.forEach((s, i) => {
    const [x, y] = pos[i]; const on = s.id === active;
    const fill = on ? (s.id === 'emit' ? C.successBright : s.id === 'cooldown' ? '#7a8599' : C.primary) : C.surface;
    if (on) g += R(x - nw / 2 - 8, y - nh / 2 - 8, nw + 16, nh + 16, { r: 22, fill, op: 0.22 });
    g += R(x - nw / 2, y - nh / 2, nw, nh, { r: 16, fill, stroke: on ? fill : C.border, sw: 2.5, shadow: true });
    g += T(x, y + 9, s.label, { size: 24, w: 700, fill: on ? '#fff' : C.text, anchor: 'middle' });
  });
  return { svg: g, pos };
}

// ---------- faithful JS port of firmware/BandW_Sense/GestureDetector.h (same constants and logic) ----------
export const K = { TILT_ENTER_DEG: 22, TILT_EXIT_DEG: 12, PITCH_ENTER_DEG: 25, PITCH_EXIT_DEG: 12, AXIS_MARGIN_DEG: 8, MIN_PLANE_G: 0.4,
  SHAKE_DPS: 100, HOLD_MS: 250, DIP_MAX_MS: 700, HELP_WINDOW_MS: 2000, NEUTRAL_MS: 200, COOLDOWN_MS: 650, TAP_CONFIRM_MS: 150, TAP_QUIET_BEFORE_MS: 300,
  TAP_STILL_DPS: 50 };
const u32 = (v) => v >>> 0;
const angle = (x, z) => Math.atan2(x, z) * 57.2957795;
const wrap = (d) => { while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
export const pitchAngle = (x, y, z) => { const m = Math.hypot(x, y, z), s = m > 0 ? y / m : 0; return Math.asin(Math.max(-1, Math.min(1, s))) * 57.2957795; };
export class Detector {
  constructor() { Object.assign(this, { baseline: 0, filtered: 0, pitchBaseline: 0, filteredPitch: 0, initialized: false, armed: false, neutralTiming: false,
    neutralAt: 0, lastEmission: 0, candidateAt: 0, lastMotion: 0, shakeStart: 0, pulseAt: 0, tapAt: 0, lastStir: 0, dipStart: 0, firstDipAt: 0,
    candidate: 0, shakeSign: 0, shakePulses: 0, lastSign: 0, stirRun: 0, fastRun: 0, dipDir: 0, pairDir: 0, dips: 0, cooling: false, tapPending: false }); }
  emit(r, now) { Object.assign(this, { armed: false, neutralTiming: false, cooling: true, lastEmission: now, candidate: 0, shakePulses: 0, shakeSign: 0, lastSign: 0, tapPending: false, dipDir: 0, dips: 0 }); return r; }
  calibrate(x, y, z, now) { Object.assign(this, { baseline: angle(x, z), filtered: 0, initialized: true, pitchBaseline: pitchAngle(x, y, z), filteredPitch: 0,
    armed: false, neutralTiming: false, cooling: false, tapPending: false, candidate: 0, shakePulses: 0, shakeSign: 0, lastSign: 0, lastMotion: now,
    lastStir: u32(now - 1000), stirRun: 0, fastRun: 0, dipDir: 0, dips: 0 }); }
  update(x, y, z, gx, gy, gz, now, doubleTap = false) {
    if (!this.initialized) return null;
    const magnitude = Math.hypot(x, y, z), speed = Math.hypot(gx, gy, gz);
    const level = Math.hypot(x, z) >= K.MIN_PLANE_G;
    if (level) { const tilt = wrap(angle(x, z) - this.baseline); this.filtered += 0.22 * wrap(tilt - this.filtered); this.filtered = wrap(this.filtered); }
    if (magnitude > 0.5 && magnitude < 1.5) this.filteredPitch += 0.22 * ((pitchAngle(x, y, z) - this.pitchBaseline) - this.filteredPitch);
    if (speed > 70 || magnitude < 0.8 || magnitude > 1.2) this.lastMotion = now;
    this.stirRun = speed > K.TAP_STILL_DPS ? this.stirRun + 1 : 0;
    this.fastRun = speed > K.SHAKE_DPS ? this.fastRun + 1 : 0;
    if (this.stirRun >= 2) this.lastStir = now;
    if (this.fastRun >= 2) this.tapPending = false;
    if (this.cooling && u32(now - this.lastEmission) >= K.COOLDOWN_MS) this.cooling = false;
    const rest = level && Math.abs(this.filtered) < K.TILT_EXIT_DEG && Math.abs(this.filteredPitch) < K.PITCH_EXIT_DEG;
    if (!this.armed) {
      const neutral = !this.cooling && rest && speed < 40 && magnitude > 0.85 && magnitude < 1.15;
      if (neutral) { if (!this.neutralTiming) { this.neutralAt = now; this.neutralTiming = true; } if (u32(now - this.neutralAt) >= K.NEUTRAL_MS) this.armed = true; }
      else this.neutralTiming = false;
      return null;
    }
    if (this.shakePulses && u32(now - this.shakeStart) > 900) { this.shakePulses = 0; this.shakeSign = 0; }
    const sign = gy > K.SHAKE_DPS ? 1 : gy < -K.SHAKE_DPS ? -1 : 0;
    const sustained = sign && sign === this.lastSign; this.lastSign = sign;
    if (sustained && sign !== this.shakeSign && (!this.shakePulses || u32(now - this.pulseAt) >= 80)) {
      if (!this.shakePulses) this.shakeStart = now;
      this.shakeSign = sign; this.pulseAt = now; ++this.shakePulses;
      if (this.shakePulses >= 3) return this.emit('NO', now);
    }
    if (doubleTap && !this.tapPending && rest && u32(now - this.lastStir) >= K.TAP_QUIET_BEFORE_MS) { this.tapPending = true; this.tapAt = now; }
    if (this.tapPending && u32(now - this.tapAt) >= K.TAP_CONFIRM_MS) { this.tapPending = false; if (rest) return this.emit('YES', now); }
    // HELP = two quick forearm dips the same way (each ≤ DIP_MAX_MS, both within HELP_WINDOW_MS)
    const roll = Math.abs(this.filtered), pitch = Math.abs(this.filteredPitch);
    if (this.dips && u32(now - this.firstDipAt) > K.HELP_WINDOW_MS) this.dips = 0;
    if (!this.dipDir) {
      if (pitch > K.PITCH_ENTER_DEG && pitch >= roll + K.AXIS_MARGIN_DEG) {
        this.dipDir = this.filteredPitch < 0 ? -1 : 1; this.dipStart = now;
        if (this.dips && this.dipDir !== this.pairDir) this.dips = 0;
      }
    } else if (pitch < K.PITCH_EXIT_DEG) {
      if (u32(now - this.dipStart) > K.DIP_MAX_MS) this.dips = 0;
      else {
        if (!this.dips) { this.firstDipAt = this.dipStart; this.pairDir = this.dipDir; }
        if (++this.dips >= 2) return this.emit('HELP', now);
      }
      this.dipDir = 0;
    } else if (u32(now - this.dipStart) > K.DIP_MAX_MS) this.dips = 0;
    if (this.tapPending || !level || u32(now - this.lastMotion) < 150 || magnitude < 0.85 || magnitude > 1.15) { this.candidate = 0; return null; }
    const direction = roll > K.TILT_ENTER_DEG && roll >= pitch + K.AXIS_MARGIN_DEG ? (this.filtered < 0 ? -1 : 1) : 0;
    if (!direction) { this.candidate = 0; return null; }
    if (this.candidate !== direction) { this.candidate = direction; this.candidateAt = now; }
    if (u32(now - this.candidateAt) >= K.HOLD_MS) return this.emit(direction < 0 ? 'WATER' : 'FOOD', now);
    return null;
  }
}
// Simulate a pose profile: poseAt(tMs) → {roll, pitch, gy?, tap?}. Returns per-sample records (20 ms step).
export function simulate(poseAt, durMs, o = {}) {
  const d = new Detector(); const t0 = 1000; d.calibrate(0, 0, 1, t0);
  const out = []; let prevRoll = poseAt(0).roll, prevPitch = poseAt(0).pitch || 0;
  for (let ms = 0; ms <= durMs; ms += 20) {
    const p = poseAt(ms); const r = rad(p.roll), q = rad(p.pitch || 0);
    const x = Math.sin(r) * Math.cos(q), y = Math.sin(q), z = Math.cos(r) * Math.cos(q);
    const gyv = p.gy !== undefined ? p.gy : (p.roll - prevRoll) / 0.02; prevRoll = p.roll;
    const gxv = p.gx !== undefined ? p.gx : ((p.pitch || 0) - prevPitch) / 0.02; prevPitch = p.pitch || 0;
    const ev = d.update(x * (p.mag || 1), y * (p.mag || 1), z * (p.mag || 1), gxv, gyv, 0, t0 + 20 + ms, !!p.tap);
    out.push({ ms, roll: p.roll, pitch: p.pitch || 0, gy: gyv, filtered: d.filtered, filteredPitch: d.filteredPitch, armed: d.armed, cooling: d.cooling,
      candidate: d.candidate, candidateAt: d.candidateAt - t0 - 20, neutralTiming: d.neutralTiming, neutralAt: d.neutralAt - t0 - 20,
      shakePulses: d.shakePulses, tapPending: d.tapPending, tapAt: d.tapAt - t0 - 20, dips: d.dips, dipDir: d.dipDir, dipStart: d.dipStart - t0 - 20, event: ev, tap: !!p.tap, lastEmission: d.lastEmission - t0 - 20 });
  }
  return out;
}
export const sampleAt = (rec, ms) => rec[clamp(Math.floor(ms / 20), 0, rec.length - 1)];
export function stateOf(r, emitHoldMs = 450) {
  // mapping to the simplified 5-state model used on the site
  if (r.cooling) return (r.ms - r.lastEmission) < emitHoldMs * 0 + 120 ? 'emit' : 'cooldown';
  if (!r.armed) return 'neutral';
  return r.candidate ? 'candidate' : 'armed';
}

// ---------- scene runtime ----------
// shots: [{ marks:[...], draw(c) → svg }]. c = { t, lt, dur, u, mark, m(id), tl }
export function makeScene(def) {
  let timeline = [], meta = {};
  const stage = () => document.getElementById('stage');
  const findMark = (id) => timeline.find((m) => m.mark === id);
  const mk = (t) => (id) => { const m = findMark(id); if (!m) return { start: 0, end: 0, dur: 1, p: 0, lt: 0, on: false };
    return { start: m.start, end: m.end, dur: m.end - m.start, p: clamp((t - m.start) / (m.end - m.start)), lt: t - m.start, on: t >= m.start && t < m.end, after: t >= m.start }; };
  const shots = [{ marks: ['intro'], draw: (c) => titleCard(def, c) }, ...def.shots];
  function spans() {
    return shots.map((s) => { const ms = s.marks.map(findMark).filter(Boolean); return ms.length ? { s, start: ms[0].start, end: ms[ms.length - 1].end } : null; }).filter(Boolean);
  }
  function chrome(t, inner) {
    const chapters = timeline.filter((m) => m.chapter);
    const total = timeline.length ? timeline[timeline.length - 1].end : 1;
    let cur = null; for (const ch of chapters) if (t >= ch.start) cur = ch;
    let g = inner;
    if (cur && t < total) {
      g += pill(40, 44, cur.chapter, { size: 21, fill: '#ffffff', ink: C.primary, stroke: C.border, sw: 1.5 });
    }
    g += T(W - 40, 52, 'BandW · KHKT', { size: 20, w: 700, fill: C.muted, anchor: 'end', op: t < (timeline[0]?.end || 2) ? 0 : 0.9 });
    // chapter progress bar
    const bx = 40, bw = W - 80, by = H - 18;
    g += R(bx, by, bw, 6, { r: 3, fill: '#e1e4ea' }) + R(bx, by, bw * clamp(t / (total + 2.5)), 6, { r: 3, fill: C.primary });
    for (const ch of chapters) g += Ci(bx + bw * ch.start / (total + 2.5), by + 3, 6, { fill: t >= ch.start ? C.primary : '#c3c8d2', stroke: '#fff', sw: 2 });
    return g;
  }
  function render(t) {
    const total = timeline.length ? timeline[timeline.length - 1].end : 0;
    const list = spans();
    let body = '';
    if (t >= total) {
      const last = list[list.length - 1];
      const f = clamp((t - total) / 0.5);
      body = (f < 1 && last ? G(drawShot(last, total - 0.001), { op: 1 - f }) : '') + G(endCard(def, t - total), { op: f });
      return defs() + R(0, 0, W, H, { fill: C.bg }) + body + R(40, H - 18, W - 80, 6, { r: 3, fill: C.primary });
    }
    let idx = list.findIndex((sp) => t >= sp.start && t < sp.end);
    if (idx < 0) idx = 0;
    const sp = list[idx];
    const f = idx > 0 ? clamp((t - sp.start) / 0.45) : 1;
    if (f < 1) body += G(drawShot(list[idx - 1], sp.start - 0.001), { op: 1 - f });
    body += G(drawShot(sp, t), { op: f });
    return defs() + R(0, 0, W, H, { fill: C.bg }) + chrome(t, body);
  }
  function drawShot(sp, t) {
    const marks = sp.s.marks; let mark = marks[0];
    for (const id of marks) { const m = findMark(id); if (m && t >= m.start) mark = id; }
    return sp.s.draw({ t, lt: t - sp.start, dur: sp.end - sp.start, u: clamp((t - sp.start) / (sp.end - sp.start)), mark, m: mk(t), tl: timeline, meta });
  }
  window.BW_SCENE = {
    async init(tl, m = {}) { timeline = tl; meta = m; if (document.fonts) await document.fonts.ready; render(0); },
    seek(t) { stage().innerHTML = render(t); },
    def,
  };
}
function defs() {
  return `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity=".10"/></filter></defs>`;
}
function titleCard(def, c) {
  const u = easeOut(c.lt / 0.8);
  let g = R(0, 0, W, H, { fill: C.bg });
  g += Ci(1040, 180, 260, { fill: C.primarySoft }) + Ci(180, 640, 200, { fill: '#fff3e0' });
  g += G(armFront(0, 0, Math.sin(c.lt * 2.2) * 10, { s: 1.05, blink: (c.lt % 2.4) > 2.25 }), { tx: 1030, ty: 430 });
  g += G(T(90, 300, 'BandW · Video bài giảng', { size: 28, w: 700, fill: C.primary }) +
    para(90, 380, def.title, { size: 60, w: 700, max: 19, lh: 76 }) +
    T(90, 600, 'Giáo trình trực quan cho đội thi KHKT', { size: 26, w: 500, fill: C.muted }), { tx: (1 - u) * -40, op: u });
  return g;
}
function endCard(def, lt) {
  let g = R(0, 0, W, H, { fill: C.primary });
  g += G(bandFace(640, 280, 2.2, { blink: lt % 2 > 1.85 }), {});
  g += T(640, 470, 'BandW · KHKT', { size: 64, w: 700, fill: '#fff', anchor: 'middle' });
  g += T(640, 530, def.title, { size: 28, w: 500, fill: '#dbe6ff', anchor: 'middle' });
  return g;
}

// convenience: appear helper (fade + slide) for elements, u in [0,1]
export function appear(inner, u, dy = 20) { const e = easeOut(u); return G(inner, { ty: (1 - e) * dy, op: e }); }
export function caption(text, o = {}) { // large on-screen key line at bottom of content area
  const y = o.y || 640, size = o.size || 30;
  const w = textWidth(text, size) + 60;
  return G(R(W / 2 - w / 2, y - size * 1.05, w, size * 1.9, { r: 16, fill: o.fill || C.text, op: 0.92 }) + T(W / 2, y + size * 0.25, text, { size, w: 700, fill: '#fff', anchor: 'middle' }), { op: o.op });
}

// Finger of the other hand (for taps), tip at (x,y)
export function finger(x, y, s = 1) {
  return G(R(-22 * s, -190 * s, 44 * s, 200 * s, { r: 22 * s, fill: C.skin, stroke: C.skinDark, sw: 3 * s }) +
    R(-14 * s, -10 * s - 22 * s, 28 * s, 26 * s, { r: 10 * s, fill: '#fbe3d2', stroke: C.skinDark, sw: 2 * s }), { tx: x, ty: y, rot: 28, cx: 0, cy: 0 });
}
// Looping pictogram of one gesture. lt = local seconds. Returns svg centred at (cx, cy).
export function gestureFigure(cmd, cx, cy, lt, s = 1) {
  const cyc = (p) => (lt % p) / p;
  if (cmd === 'WATER' || cmd === 'FOOD') {
    const u = cyc(2.6), a = u < 0.25 ? ease(u / 0.25) : u < 0.7 ? 1 : u < 0.9 ? 1 - ease((u - 0.7) / 0.2) : 0;
    const roll = (cmd === 'WATER' ? -36 : 36) * a;
    const arc = a > 0.2 ? P(cmd === 'WATER' ? `M${cx - 60 * s} ${cy - 150 * s} A${170 * s} ${170 * s} 0 0 0 ${cx - 175 * s} ${cy - 40 * s}` : `M${cx + 60 * s} ${cy - 150 * s} A${170 * s} ${170 * s} 0 0 1 ${cx + 175 * s} ${cy - 40 * s}`, { stroke: C.primary, sw: 6 * s, op: 0.5, dash: '2 12' }) : '';
    return arc + armFront(cx, cy, roll, { s });
  }
  if (cmd === 'NO') {
    const u = cyc(2.2), on = u < 0.6; const roll = on ? 22 * Math.sin(u / 0.6 * Math.PI * 2 * 1.5) : 0;
    const marks = on ? [-1, 1].map((d) => P(`M${cx + d * 190 * s} ${cy - 60 * s} q${d * 20 * s} ${40 * s} 0 ${80 * s}`, { stroke: C.primary, sw: 6 * s, op: 0.6 })).join('') : '';
    return marks + armFront(cx, cy, roll, { s });
  }
  if (cmd === 'YES') {
    const u = cyc(2.0); const tapAt = [0.2, 0.42];
    let press = 0; for (const t0 of tapAt) press = Math.max(press, 1 - Math.min(1, Math.abs(u - t0) / 0.07));
    const lift = 70 * (1 - press) * s; let g = armFront(cx, cy, 0, { s });
    g += finger(cx + 30 * s + lift * 0.45, cy - 106 * s - lift, s);
    for (const t0 of tapAt) { const b = (u - t0) / 0.18; if (b > 0 && b < 1) g += burst(cx + 10 * s, cy - 110 * s, b, C.energy, 70 * s); }
    return g;
  }
  // HELP: side view, forearm lowered and raised back quickly, twice (two dips)
  const u = cyc(2.8);
  const dip = (u0) => { const v = (u - u0) / 0.2; return v <= 0 || v >= 1 ? 0 : Math.sin(Math.PI * v); };
  const a = Math.max(dip(0.08), dip(0.36));
  const n = u < 0.08 ? 0 : u < 0.36 ? 1 : 2;
  return armSide(cx - 190 * s, cy - 10 * s, 38 * a, { s: s * 0.95 }) +
    (a > 0.15 ? arrow(cx + 210 * s, cy - 40 * s, cx + 200 * s, cy + 90 * s, { stroke: C.primary, sw: 6 * s, op: 0.6 }) : '') +
    (n ? T(cx + 205 * s, cy - 70 * s, `×${n}`, { size: 34 * s, w: 700, fill: C.primary, anchor: 'middle' }) : '');
}

// Semicircular gauge. zones: [{from,to,fill}], value in [vmin,vmax]. Angle: vmin at left (180°) → vmax at right (0°).
export function gauge(cx, cy, r, vmin, vmax, value, o = {}) {
  const ang = (v) => rad(180 + (clamp(v, vmin, vmax) - vmin) / (vmax - vmin) * 180);
  const pt = (v, rr) => [cx + Math.cos(ang(v)) * rr, cy + Math.sin(ang(v)) * rr];
  const arc = (a, b, rr, col, sw) => { const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr); return P(`M${x1} ${y1} A${rr} ${rr} 0 0 1 ${x2} ${y2}`, { stroke: col, sw, cap: 'butt' }); };
  let g = arc(vmin, vmax, r, '#e6e9ef', o.sw || 34);
  for (const z of o.zones || []) g += arc(z.from, z.to, r, z.fill, o.sw || 34);
  for (const tk of o.ticks || []) { const [x1, y1] = pt(tk.v, r + 22), [x2, y2] = pt(tk.v, r - 22); g += L(x1, y1, x2, y2, { stroke: tk.color || C.text, sw: 3 });
    const [lx, ly] = pt(tk.v, r + 44); g += T(lx, ly + 7, tk.label ?? String(tk.v), { size: 20, w: 700, fill: tk.color || C.muted, anchor: 'middle' }); }
  const [nx, ny] = pt(value, r - 8);
  g += L(cx, cy, nx, ny, { stroke: o.needle || C.text, sw: 8 }) + Ci(cx, cy, 16, { fill: o.needle || C.text });
  return g;
}
