// Unit page: compact header + one lesson list (whole row clickable, state icon, chevron).
import { el } from '../util.js';
import { findUnit, STATUS, countExercises, unitIndex, progressBar } from './_ui.js';
import { icon } from '../icons.js';
import * as notfound from './notfound.js';

export function render(root, { unitId }, { course, store }) {
  const unit = findUnit(course, unitId);
  if (!unit) return notfound.render(root, {}, {});
  const s = store.unitStats(unit);
  const n = unitIndex(course, unit);
  const page = el('div.page.unit-page');
  page.append(el('nav.crumbs', { 'aria-label': 'Đường dẫn' }, el('a', { href: '#/' }, icon('chevron-left', 16), 'Lộ trình học')));
  const bar = progressBar(s.mastered, s.total, { label: 'Số bài thành thạo trong chương' });
  if (s.total && s.mastered === s.total) bar.classList.add('done');
  page.append(el('header.unit-head', null,
    el('p.eyebrow', null, `Chương ${n}`),
    el('h1', { tabindex: '-1' }, unit.title),
    el('p.lead', null, unit.description),
    el('div.unit-head-progress', null, bar, el('small', null, `${s.mastered}/${s.total} bài thành thạo`))));

  const list = el('ol.lesson-list');
  unit.lessons.forEach((lesson, i) => {
    const st = store.lessonStatus(unit, lesson);
    const meta = STATUS[st];
    const href = `#/unit/${unit.id}/lesson/${lesson.id}`;
    list.append(el('li.lesson-row', { class: `st-${st}` },
      el('a.lesson-link', { href },
        el('span.lesson-status', { title: meta.label }, icon(meta.icon, 22)),
        el('span.lesson-info', null,
          el('span.lesson-title', null, el('span.lesson-num', null, `${i + 1}.`), lesson.title),
          el('span.lesson-meta', null, `${lesson.minutes} phút · ${countExercises(lesson)} bài tập · ${meta.label}`),
          lesson.goal ? el('span.lesson-goal', null, lesson.goal) : null),
        el('span.lesson-chev', { 'aria-hidden': 'true' }, icon('chevron-right', 18)))));
  });
  page.append(list);
  const hasDefense = (unit.defense && unit.defense.length) || unit.lessons.some((l) => l.steps.some((x) => x.type === 'flashcard'));
  if (hasDefense) page.append(el('div.unit-foot', null, el('a.btn', { href: `#/practice/${unit.id}` }, icon('mic', 18), 'Luyện phản biện chương này')));
  root.append(page);
  return { title: unit.title, destroy() {} };
}
