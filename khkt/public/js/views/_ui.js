// Shared view widgets: progress ring, status badges, lookups.
import { el, svgNode } from '../util.js';
import { GRADED } from '../progress/store.js';

export const STATUS = {
  new: { icon: 'circle', label: 'Chưa học', btn: 'Học' },
  started: { icon: 'circle-half', label: 'Đang học', btn: 'Học tiếp' },
  mastered: { icon: 'circle-done', label: 'Thành thạo', btn: 'Ôn lại' },
};

export const findUnit = (course, id) => course.units.find((u) => u.id === id) || null;
export const findLesson = (unit, id) => (unit ? unit.lessons.find((l) => l.id === id) || null : null);
export const unitIndex = (course, unit) => course.units.indexOf(unit) + 1;
export const countExercises = (lesson) => lesson.steps.filter((s) => GRADED.has(s.type)).length;
export const unitColorVar = (unit) => `var(--u-${unit.color || 'blue'})`;

/** SVG ring: mastered fraction (solid) + started fraction (light). */
export function ring({ mastered, started = 0, total }, size = 56, { label = true, color = 'var(--c-primary)' } = {}) {
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const fm = total ? mastered / total : 0, fs = total ? (mastered + started) / total : 0;
  const pct = Math.round(fm * 100);
  const node = svgNode(`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="7" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-started" stroke-width="7" fill="none" stroke-dasharray="${c * fs} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" style="stroke:${color}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="7" fill="none" stroke-linecap="${fm > 0 ? 'round' : 'butt'}" stroke-dasharray="${c * fm} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})" style="stroke:${color}"/>
    ${label ? `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-size="${Math.round(size / 4.2)}" font-weight="700" class="ring-text">${pct}%</text>` : ''}
  </svg>`);
  return node;
}

export function progressBar(value, max, { label } = {}) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return el('div.pbar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-label': label || 'Tiến độ' },
    el('div.pbar-fill', { style: { width: pct + '%' } }));
}

export function pageHeader(title, sub, extra = null) {
  return el('header.page-head', null, el('h1', { tabindex: '-1' }, title), sub ? el('p.lead', null, sub) : null, extra);
}
