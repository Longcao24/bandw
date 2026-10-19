// Home: hero (title, continue button, thin course progress), quiet exam card, unit grid, quick links.
import { el } from '../util.js';
import { lessonKey } from '../core/ids.js';
import { progressBar, findUnit, findLesson } from './_ui.js';
import { icon } from '../icons.js';

export function render(root, _params, { course, store }) {
  const page = el('div.page.home');
  const stats = store.courseStats(course);
  const last = store.progress.last;
  let cont = null;
  if (last) {
    const u = findUnit(course, last.u), l = findLesson(u, last.l);
    const rec = u && l ? store.progress.lessons[lessonKey(u.id, l.id)] : null;
    if (u && l && !(rec && rec.d)) cont = { href: `#/unit/${u.id}/lesson/${l.id}`, label: 'Tiếp tục học', sub: `${u.title} · ${l.title}` };
    else if (u && l) {
      // The last lesson was finished: point at the next lesson after it that is not mastered yet.
      const flat = course.units.flatMap((uu) => uu.lessons.map((ll) => ({ u: uu, l: ll })));
      const at = flat.findIndex((x) => x.u === u && x.l === l);
      for (let k = 1; k <= flat.length; k++) {
        const x = flat[(at + k) % flat.length];
        if (store.lessonStatus(x.u, x.l) !== 'mastered') { cont = { href: `#/unit/${x.u.id}/lesson/${x.l.id}`, label: 'Học bài tiếp theo', sub: `${x.u.title} · ${x.l.title}` }; break; }
      }
    }
  }
  if (!cont) {
    // First lesson not yet mastered.
    outer: for (const u of course.units) for (const l of u.lessons) {
      if (store.lessonStatus(u, l) !== 'mastered') { cont = { href: `#/unit/${u.id}/lesson/${l.id}`, label: stats.mastered ? 'Học bài tiếp theo' : 'Bắt đầu học', sub: `${u.title} · ${l.title}` }; break outer; }
    }
  }
  const p = store.progress;
  const pctDone = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const hero = el('section.hero', null,
    el('h1', { tabindex: '-1' }, course.title),
    el('p.lead', null, course.description),
    el('div.hero-actions', null,
      cont ? el('a.btn.primary.lg', { href: cont.href }, cont.label, icon('arrow-right', 18)) : el('a.btn.primary.lg', { href: '#/practice' }, icon('mic', 18), 'Luyện phản biện'),
      cont ? el('span.hero-sub', null, 'Bài tiếp: ', el('strong', null, cont.sub)) : null),
    el('div.hero-progress', null,
      progressBar(stats.mastered, stats.total, { label: 'Số bài thành thạo' }),
      el('p.hero-progress-label', null, `${stats.mastered}/${stats.total} bài thành thạo · ${pctDone}%`)));
  page.append(hero);
  const lastExam = store.examHistory()[0];
  page.append(el('a.exam-cta', { href: '#/exam' },
    el('span.exam-cta-icon', { 'aria-hidden': 'true' }, icon('exam', 20)),
    el('span', null, el('strong', null, 'Thi thử trước ngày thi'),
      el('small', null, lastExam ? `Lần gần nhất: ${Math.round((lastExam.s / lastExam.n) * 100)}%. Làm thêm một đề để xem em tiến bộ thế nào.` : 'Đề 15 hoặc 30 phút có giờ, chấm theo chương, và phòng phản biện với giám khảo ảo.')),
    el('span.go', { 'aria-hidden': 'true' }, icon('chevron-right', 20))));

  const grid = el('section.unit-grid', { 'aria-label': 'Các chương' });
  course.units.forEach((u, i) => {
    const s = store.unitStats(u);
    const placeholder = u._placeholder;
    const done = s.total > 0 && s.mastered === s.total;
    const bar = progressBar(s.mastered, s.total, { label: `Chương ${i + 1}` });
    bar.classList.add('thin');
    if (done) bar.classList.add('done');
    grid.append(el('a.unit-card', { href: `#/unit/${u.id}`, 'aria-label': `Chương ${i + 1}: ${u.title}. ${s.mastered}/${s.total} bài thành thạo` },
      el('div.unit-card-top', null, el('span.unit-num', null, `Chương ${i + 1}`), placeholder ? el('span.tag', null, 'Đang soạn') : null,
        done ? el('span.unit-done', { title: 'Đã thành thạo' }, icon('check-circle', 18)) : null),
      el('h2.unit-card-title', null, u.title),
      el('p.unit-card-desc', null, u.description),
      el('div.unit-card-foot', null, bar, el('span.unit-card-count', null, `${s.mastered}/${s.total} bài`))));
  });
  page.append(el('div.section-head', null, el('h2', null, 'Lộ trình học'), el('small', null, `${course.units.length} chương · ${stats.total} bài`)), grid);

  page.append(el('section.quick-links', { 'aria-label': 'Lối tắt' },
    quick('#/practice', 'mic', 'Luyện phản biện', 'Thẻ câu hỏi của giám khảo'),
    quick('#/question', 'question', 'Ngân hàng câu hỏi', 'Mọi câu phản biện, AI chấm'),
    quick('#/videos', 'video', 'Thư viện video', `Đã xem ${Object.keys(p.videos).length}/8 video`),
    quick('#/glossary', 'book', 'Thuật ngữ', 'Tra nhanh từ chuyên môn')));
  root.append(page);
  return { title: 'Trang chủ', destroy() {} };
}

function quick(href, ic, title, sub) {
  return el('a.quick', { href }, el('span.quick-icon', { 'aria-hidden': 'true' }, icon(ic, 20)), el('span', null, el('strong', null, title), el('small', null, sub)));
}
