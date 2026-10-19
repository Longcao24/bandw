// Thi thử (home): mode cards, resume banner, history with a trend chart.
import { el, svgNode } from '../util.js';
import { MODES } from '../exam/generate.js';
import { loadCurrent, secondsLeft, fmtDate, fmtDuration, fmtClock } from '../exam/session.js';
import { trendSvg, level } from '../exam/chart.js';
import { unitInfo } from '../exam/data.js';
import { icon } from '../icons.js';

export const modeHref = (m, unitId) => (m === 'unit' ? `#/exam/unit${unitId ? '/' + unitId : ''}` : `#/exam/${m}`);
export function modeName(course, e) {
  const base = MODES[e.m || e.mode]?.label || 'Thi thử';
  const u = e.uu || e.unitId;
  return (e.m || e.mode) === 'unit' && u ? `${base} · ${unitInfo(course, u).label}` : base;
}

export function render(root, _params, { course, store }) {
  const page = el('div.page.exam-home');
  page.append(el('header.page-head.exam-hero', null,
    el('h1', { tabindex: '-1' }, 'Thi thử'),
    el('p.lead', null, 'Làm bài có giờ, chưa xem đáp án cho đến khi nộp. Xong bài, em biết ngay chương nào đã vững, chương nào cần ôn và bài học nào nên xem lại.')));

  const cur = loadCurrent(store.storage);
  if (cur) {
    const left = secondsLeft(cur);
    const done = Object.keys(cur.ans || {}).length;
    const href = cur.mode === 'defense' ? '#/exam/defense' : modeHref(cur.mode, cur.unitId);
    page.append(el('section.exam-resume', { 'aria-label': 'Bài đang làm dở' },
      el('span.exam-resume-icon', { 'aria-hidden': 'true' }, icon('hourglass', 20)),
      el('div', null,
        el('strong', null, `Em đang làm dở: ${modeName(course, cur)}`),
        el('p', null, cur.mode === 'defense'
          ? `Câu ${Math.min(cur.cur + 1, cur.qs.length)}/${cur.qs.length}.`
          : `${done}/${cur.qs.length} câu đã trả lời${Number.isFinite(left) ? ` · còn ${fmtClock(Math.max(0, left))}` : ''}${Number.isFinite(left) && left <= 0 ? ' (hết giờ, bài sẽ được nộp)' : ''}.`)),
      el('a.btn.primary', { href }, 'Làm tiếp', icon('arrow-right', 16))));
  }

  const grid = el('section.exam-modes', { 'aria-label': 'Chọn kiểu thi' });
  grid.append(
    modeCard('full', 'exam', '#/exam/full', 'Đề tổng hợp', `${MODES.full.size} câu · ${MODES.full.minutes} phút`, 'Câu hỏi rải đều mọi chương, có cả câu hỏi hình và mô phỏng. Giống một bài kiểm tra cuối khoá.', true),
    modeCard('quick', 'zap', '#/exam/quick', 'Đề nhanh', `${MODES.quick.size} câu · ${MODES.quick.minutes} phút`, 'Khi chỉ có 15 phút: vẫn đủ các chương, mỗi chương một vài câu.'),
    modeCard('defense', 'mic', '#/exam/defense', 'Phản biện thử', `${MODES.defense.size} câu hỏi · 90 giây/câu`, 'Hội đồng giám khảo ảo hỏi, em trả lời thành tiếng, rồi tự chấm theo các ý chính. Có câu "hỏi xoáy".'));
  const unitPick = el('div.exam-unit-pick', { role: 'list', 'aria-label': 'Chọn chương' },
    course.units.map((u, i) => el('a.chip', { role: 'listitem', href: `#/exam/unit/${u.id}`, title: u.title, 'aria-label': `Thi theo Chương ${i + 1}: ${u.title}` }, `Ch. ${i + 1}`)));
  grid.append(el('article.exam-mode.mode-unit', null,
    el('div.exam-mode-top', null, el('span.exam-mode-icon', { 'aria-hidden': 'true' }, icon('layers', 20))),
    el('h2', null, 'Theo chương'),
    el('p.exam-mode-meta', null, `${MODES.unit.size} câu · ${MODES.unit.minutes} phút`),
    el('p', null, 'Học xong một chương? Làm 10 câu để kiểm tra ngay.'),
    unitPick));
  page.append(grid);

  // ---- history ----
  const hist = store.examHistory();
  const hsec = el('section.exam-history', { 'aria-labelledby': 'xh-h' }, el('h2#xh-h.section-title', null, 'Lịch sử thi thử'));
  if (!hist.length) {
    hsec.append(el('div.empty', null, el('p', null, 'Chưa có lần thi nào. Bắt đầu bằng Đề nhanh 15 phút nhé!'), el('a.btn.primary', { href: '#/exam/quick' }, 'Làm Đề nhanh')));
  } else {
    const graded = hist.filter((h) => h.m !== 'defense');
    const best = graded.length ? Math.max(...graded.map((h) => Math.round((h.s / h.n) * 100))) : null;
    hsec.append(el('p.meta-line.exam-hist-stats', null,
      el('span', null, `${hist.length} lần thi`),
      best !== null ? el('span', null, `Cao nhất ${best}%`) : null,
      el('span', null, 'Lưu theo mã học tập')));
    const pts = hist.slice(0, 12).reverse().map((h) => ({ pct: Math.round((h.s / h.n) * 100), label: `${fmtDate(h.at)} · ${modeName(course, h)}` }));
    hsec.append(el('figure.exam-trend', null, svgNode(trendSvg(pts)), el('figcaption', null, 'Điểm 12 lần gần nhất (tính cả Phản biện thử). Đường gạch là mục tiêu 70%.')));
    const list = el('ol.exam-hist-list');
    for (const h of hist) {
      const pct = Math.round((h.s / h.n) * 100);
      list.append(el('li', null, el('a.exam-hist-row', { href: `#/exam/result/${h.id}` },
        el('span.xh-score', { class: `xb-${level(pct)}` }, `${pct}%`),
        el('span.xh-main', null, el('strong', null, modeName(course, h)),
          el('small', null, `${fmtDate(h.at)} · ${h.m === 'defense' ? `${h.s}/${h.n} ý chính` : `${h.s}/${h.n} câu đúng`} · ${fmtDuration(h.d)}`)),
        el('span.xh-go', { 'aria-hidden': 'true' }, icon('chevron-right', 18)))));
    }
    hsec.append(list);
  }
  page.append(hsec);
  root.append(page);
  return { title: 'Thi thử', destroy() {} };
}

function modeCard(cls, ic, href, title, meta, desc, featured = false) {
  return el('a.exam-mode', { href, class: `mode-${cls}${featured ? ' featured' : ''}` },
    el('div.exam-mode-top', null, el('span.exam-mode-icon', { 'aria-hidden': 'true' }, icon(ic, 20)), featured ? el('span.tag', null, 'Gợi ý') : null),
    el('h2', null, title),
    el('p.exam-mode-meta', null, meta),
    el('p', null, desc),
    el('span.exam-mode-go', null, 'Bắt đầu', icon('arrow-right', 16)));
}
