// Small SVG charts for the mock exam (strings; colors from CSS vars so dark mode works). Pure.
import { escapeHtml as esc } from '../util.js';

export const GOAL = 70; // % that counts as "vững"
export const level = (pct) => (pct >= GOAL ? 'good' : pct >= 50 ? 'mid' : 'low');
const LEVEL_TEXT = { good: 'vững', mid: 'cần ôn thêm', low: 'cần ôn lại' };

/**
 * Horizontal bars, one row per unit. rows = [{ label:'Ch. 3', name:'Cảm biến IMU', c, t }].
 * Value text is printed next to every bar (color is never the only signal).
 */
export function unitBarsSvg(rows, { title = 'Điểm theo chương' } = {}) {
  const W = 360, rowH = 30, top = 8, labelW = 52, barX = 56, barW = 200;
  const H = top + rows.length * rowH + 22;
  const goalX = barX + (barW * GOAL) / 100;
  const parts = [];
  rows.forEach((r, i) => {
    const pct = r.t ? Math.round((r.c / r.t) * 100) : 0;
    const y = top + i * rowH;
    const w = Math.max(r.c ? 4 : 0, (barW * pct) / 100);
    parts.push(`<g class="xb-row xb-${level(pct)}"><title>${esc(`${r.label} · ${r.name}: ${r.c}/${r.t} câu (${pct}%)`)}</title>`
      + `<text x="0" y="${y + 19}" font-size="14" font-weight="700" class="xb-label">${esc(r.label)}</text>`
      + `<rect x="${barX}" y="${y + 6}" width="${barW}" height="16" rx="8" class="xb-track"/>`
      + `<rect x="${barX}" y="${y + 6}" width="${w.toFixed(1)}" height="16" rx="8" class="xb-fill"/>`
      + `<text x="${barX + barW + 8}" y="${y + 19}" font-size="14" class="xb-val">${r.c}/${r.t} · ${pct}%</text></g>`);
  });
  parts.push(`<line x1="${goalX}" y1="${top}" x2="${goalX}" y2="${top + rows.length * rowH}" class="xb-goal" stroke-dasharray="3 3"/>`
    + `<text x="${goalX}" y="${H - 6}" font-size="11" text-anchor="middle" class="xb-goal-t">mục tiêu ${GOAL}%</text>`);
  const summary = rows.map((r) => `${r.label} ${r.c}/${r.t} (${LEVEL_TEXT[level(r.t ? (r.c / r.t) * 100 : 0)]})`).join('; ');
  return `<svg class="xb-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img" aria-label="${esc(`${title}: ${summary}`)}">${parts.join('')}</svg>`;
}

/** Score trend (oldest → newest). points = [{ pct, label }] */
export function trendSvg(points, { title = 'Điểm các lần thi gần đây' } = {}) {
  const W = 360, H = 150, L = 34, R = 12, T = 14, B = 26;
  const n = points.length;
  const x = (i) => (n <= 1 ? (L + W - R) / 2 : L + ((W - L - R) * i) / (n - 1));
  const y = (p) => T + ((H - T - B) * (100 - p)) / 100;
  const grid = [0, 50, 100].map((p) => `<line x1="${L}" y1="${y(p)}" x2="${W - R}" y2="${y(p)}" class="xt-grid"/><text x="${L - 6}" y="${y(p) + 4}" font-size="11" text-anchor="end" class="xt-axis">${p}%</text>`).join('');
  const goal = `<line x1="${L}" y1="${y(GOAL)}" x2="${W - R}" y2="${y(GOAL)}" class="xb-goal" stroke-dasharray="4 4"/>`;
  const line = n > 1 ? `<polyline points="${points.map((p, i) => `${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(' ')}" class="xt-line" fill="none"/>` : '';
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="${i === n - 1 ? 6 : 4.5}" class="xt-dot xb-${level(p.pct)}"><title>${esc(`${p.label}: ${p.pct}%`)}</title></circle>`).join('');
  const last = n ? `<text x="${Math.min(W - R, x(n - 1)).toFixed(1)}" y="${(y(points[n - 1].pct) - 10).toFixed(1)}" font-size="12" font-weight="700" text-anchor="${n > 1 ? 'end' : 'middle'}" class="xt-last">${points[n - 1].pct}%</text>` : '';
  const caption = `<text x="${L}" y="${H - 6}" font-size="11" class="xt-axis">cũ hơn</text><text x="${W - R}" y="${H - 6}" font-size="11" text-anchor="end" class="xt-axis">gần nhất</text>`;
  const label = `${title}: ${points.map((p) => p.pct + '%').join(', ') || 'chưa có'}`;
  return `<svg class="xt-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="inherit" role="img" aria-label="${esc(label)}">${grid}${goal}${line}${dots}${last}${caption}</svg>`;
}

/** Score ring (big percentage) for the results hero. */
export function scoreRingSvg(pct, size = 148) {
  const r = (size - 16) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(100, pct)) / 100;
  return `<svg class="xr-ring xb-${level(pct)}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`
    + `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="xr-bg" stroke-width="14" fill="none"/>`
    + `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="xr-fg" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`
    + `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-size="${Math.round(size / 4.2)}" font-weight="700" class="xr-text">${Math.round(pct)}%</text></svg>`;
}
