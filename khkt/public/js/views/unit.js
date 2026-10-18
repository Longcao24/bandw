// Unit page: tinted header + lesson list with mastery status.
import { el } from '../util.js';
import { ring, findUnit, STATUS, countExercises, unitColorVar, unitIndex } from './_ui.js';
import * as notfound from './notfound.js';

export function render(root, { unitId }, { course, store }) {
  const unit = findUnit(course, unitId);
  if (!unit) return notfound.render(root, {}, {});
  const s = store.unitStats(unit);
  const n = unitIndex(course, unit);
  const page = el('div.page.unit-page', { style: { '--unit': unitColorVar(unit) } });
  page.append(el('nav.crumbs', { 'aria-label': 'Đường dẫn' }, el('a', { href: '#/' }, 'Trang chủ'), ' › ', el('span', null, `Chương ${n}`)));
  page.append(el('header.unit-head', null,
    el('span.unit-head-icon', { 'aria-hidden': 'true' }, unit.icon),
    el('div.unit-head-text', null, el('p.eyebrow', null, `Chương ${n}`), el('h1', { tabindex: '-1' }, unit.title), el('p.lead', null, unit.description)),
    el('div.unit-head-ring', null, ring(s, 84, { color: unitColorVar(unit) }), el('small', null, `${s.mastered}/${s.total} bài thành thạo`))));

  const list = el('ol.lesson-list');
  unit.lessons.forEach((lesson, i) => {
    const st = store.lessonStatus(unit, lesson);
    const meta = STATUS[st];
    const href = `#/unit/${unit.id}/lesson/${lesson.id}`;
    list.append(el('li.lesson-row', { class: `st-${st}` },
      el('span.lesson-status', { title: meta.label }, el('span', { 'aria-hidden': 'true' }, meta.icon), el('span.sr-only', null, meta.label)),
      el('div.lesson-info', null,
        el('a.lesson-title', { href }, `Bài ${i + 1}. ${lesson.title}`),
        el('p.lesson-meta', null, `⏱ ${lesson.minutes} phút · ${countExercises(lesson)} bài tập`, st !== 'new' ? el('span.status-pill', { class: `st-${st}` }, meta.label) : null),
        lesson.goal ? el('p.lesson-goal', null, lesson.goal) : null),
      el('a.btn', { href, class: st === 'mastered' ? '' : 'primary', 'aria-label': `${meta.btn}: ${lesson.title}` }, meta.btn)));
  });
  page.append(list);
  const hasDefense = (unit.defense && unit.defense.length) || unit.lessons.some((l) => l.steps.some((x) => x.type === 'flashcard'));
  if (hasDefense) page.append(el('div.unit-foot', null, el('a.btn.lg', { href: `#/practice/${unit.id}` }, '🎤 Luyện phản biện chương này')));
  root.append(page);
  return { title: unit.title, destroy() {} };
}
