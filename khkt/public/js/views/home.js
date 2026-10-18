// Home: hero with course progress + continue button, unit grid, quick links.
import { el, fmtNumber } from '../util.js';
import { lessonKey } from '../core/ids.js';
import { ring, progressBar, findUnit, findLesson, unitColorVar } from './_ui.js';

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
  const hero = el('section.hero', null,
    el('div.hero-text', null,
      el('p.eyebrow', null, '🎓 Ôn thi KHKT · Dự án BandW'),
      el('h1', { tabindex: '-1' }, course.title),
      el('p.lead', null, course.description),
      el('div.hero-progress', null,
        progressBar(stats.mastered, stats.total, { label: 'Số bài thành thạo' }),
        el('p.hero-progress-label', null, el('strong', null, `${stats.mastered}/${stats.total}`), ' bài thành thạo')),
      el('div.hero-actions', null,
        cont ? el('a.btn.primary.lg', { href: cont.href }, `${cont.label} →`) : el('a.btn.primary.lg', { href: '#/practice' }, '🎤 Luyện phản biện'),
        cont ? el('span.hero-sub', null, cont.sub) : null)),
    el('div.hero-stats', { 'aria-label': 'Thành tích' },
      stat('⚡', fmtNumber(store.points), 'điểm năng lượng'),
      stat('🔥', String(p.streak?.cur || 0), 'ngày liên tiếp'),
      stat('🎬', `${Object.keys(p.videos).length}/8`, 'video đã xem')));
  page.append(hero);
  const lastExam = store.examHistory()[0];
  page.append(el('a.exam-cta', { href: '#/exam' },
    el('span.exam-cta-icon', { 'aria-hidden': 'true' }, '📝'),
    el('span', null, el('strong', null, 'Thi thử trước ngày thi'),
      el('small', null, lastExam ? `Lần gần nhất: ${Math.round((lastExam.s / lastExam.n) * 100)}%. Làm thêm một đề để xem em tiến bộ thế nào!` : 'Đề 15 hoặc 30 phút có giờ, chấm điểm theo chương, và phòng phản biện với giám khảo ảo.')),
    el('span.btn.primary', { 'aria-hidden': 'true' }, 'Vào thi thử →')));

  const grid = el('section.unit-grid', { 'aria-label': 'Các chương' });
  course.units.forEach((u, i) => {
    const s = store.unitStats(u);
    const placeholder = u._placeholder;
    grid.append(el('a.unit-card', { href: `#/unit/${u.id}`, style: { '--unit': unitColorVar(u) }, 'aria-label': `Chương ${i + 1}: ${u.title}. ${s.mastered}/${s.total} bài thành thạo` },
      el('div.unit-card-strip', { 'aria-hidden': 'true' }),
      el('div.unit-card-body', null,
        el('div.unit-card-top', null, el('span.unit-icon', { 'aria-hidden': 'true' }, u.icon), el('span.unit-num', null, `Chương ${i + 1}`), placeholder ? el('span.tag', null, 'Đang soạn') : null),
        el('h2.unit-card-title', null, u.title),
        el('p.unit-card-desc', null, u.description),
        el('div.unit-card-foot', null, ring(s, 56, { color: unitColorVar(u) }), el('span.unit-card-count', null, `${s.mastered}/${s.total} bài thành thạo`)))));
  });
  page.append(el('h2.section-title', null, 'Lộ trình học'), grid);

  page.append(el('section.quick-links', { 'aria-label': 'Lối tắt' },
    quick('#/exam', '📝', 'Thi thử', 'Đề có giờ + phản biện thử'),
    quick('#/practice', '🎤', 'Luyện phản biện', 'Thẻ câu hỏi của giám khảo'),
    quick('#/videos', '🎬', 'Thư viện video', '8 video hoạt hình có thuyết minh'),
    quick('#/glossary', '📖', 'Thuật ngữ', 'Tra nhanh từ chuyên môn')));
  root.append(page);
  return { title: 'Trang chủ', destroy() {} };
}

function stat(icon, value, label) {
  return el('div.stat', null, el('span.stat-icon', { 'aria-hidden': 'true' }, icon), el('span.stat-value', null, value), el('span.stat-label', null, label));
}
function quick(href, icon, title, sub) {
  return el('a.quick', { href }, el('span.quick-icon', { 'aria-hidden': 'true' }, icon), el('span', null, el('strong', null, title), el('small', null, sub)));
}
