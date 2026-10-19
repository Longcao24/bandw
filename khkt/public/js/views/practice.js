// Defense practice: flashcards from lessons + unit.defense. Order: again → unrated → good (oldest first).
import { el } from '../util.js';
import { flashcardView } from '../exercises/flashcard.js';
import { findUnit, unitIndex, pageHeader } from './_ui.js';
import { announce } from '../a11y.js';
import { icon } from '../icons.js';

export const SESSION_SIZE = 10;

export function collectCards(course, unitId = null) {
  const out = [];
  for (const u of course.units) {
    if (unitId && u.id !== unitId) continue;
    for (const l of u.lessons) for (const s of l.steps) if (s.type === 'flashcard') out.push({ card: s, unit: u, lesson: l });
    for (const s of u.defense || []) out.push({ card: s, unit: u, lesson: null });
  }
  return out;
}

export function orderCards(items, cards) {
  const rank = (it) => {
    const c = cards[it.card.id];
    if (!c) return [1, 0];
    if (c.r === 'again') return [0, c.at || 0];
    return [2, c.at || 0];
  };
  return items.map((it, i) => ({ it, r: rank(it), i }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.it);
}

export function render(root, { unitId }, { course, store }) {
  const unit = unitId ? findUnit(course, unitId) : null;
  const page = el('div.page.narrow.practice');
  page.append(pageHeader('Luyện phản biện', unit ? `Câu hỏi giám khảo của Chương ${unitIndex(course, unit)}: ${unit.title}` : 'Tự trả lời thành tiếng, lật thẻ, rồi tự đánh giá. Thẻ "Cần ôn lại" sẽ quay lại trước.'));
  const chips = el('div.chips', { role: 'navigation', 'aria-label': 'Lọc theo chương' },
    el('a.chip', { href: '#/practice', class: unit ? '' : 'active', 'aria-current': unit ? undefined : 'page' }, 'Tất cả'),
    course.units.map((u, i) => el('a.chip', { href: `#/practice/${u.id}`, class: unit === u ? 'active' : '', 'aria-current': unit === u ? 'page' : undefined }, `Ch. ${i + 1}`)));
  page.append(chips);
  const all = collectCards(course, unit ? unit.id : null);
  const area = el('div.practice-area');
  page.append(area);
  root.append(page);

  if (!all.length) {
    area.append(el('div.empty', null, el('p', null, 'Chưa có thẻ phản biện nào ở đây. Các bài học đang được soạn thêm.'), el('a.btn', { href: '#/' }, 'Về trang chủ')));
    return { title: 'Luyện phản biện', destroy() {} };
  }
  const counts = () => {
    let good = 0, again = 0;
    for (const it of all) { const c = store.progress.cards[it.card.id]; if (c?.r === 'good') good++; else if (c?.r === 'again') again++; }
    return { good, again, fresh: all.length - good - again };
  };
  const c0 = counts();
  page.insertBefore(el('p.meta-line.practice-stats', null,
    el('span', null, `${all.length} thẻ`), el('span', null, `${c0.good} trả lời tốt`), el('span', null, `${c0.again} cần ôn`), el('span', null, `${c0.fresh} chưa luyện`)), area);

  let session = orderCards(all, store.progress.cards).slice(0, SESSION_SIZE);
  let i = 0;
  const tally = { good: 0, again: 0 };

  function showCard() {
    const { card, unit: u, lesson } = session[i];
    let rated = null;
    const nextBtn = el('button.btn.primary.lg', { type: 'button', disabled: true }, i === session.length - 1 ? 'Xem tổng kết' : 'Câu tiếp');
    const view = flashcardView(card, {
      showPrompt: true, previous: store.progress.cards[card.id],
      onRate: (r) => {
        if (rated) tally[rated]--;
        rated = r; tally[r]++;
        nextBtn.disabled = false;
        nextBtn.focus();
        return store.rateCard(card.id, r);
      },
    });
    nextBtn.addEventListener('click', () => { i++; if (i < session.length) showCard(); else summary(); });
    area.replaceChildren(el('div.practice-card', null,
      el('div.practice-meta', null, el('span', null, `Thẻ ${i + 1}/${session.length}`),
        el('span.practice-src', null, `${u.title}${lesson ? ' · ' + lesson.title : ''}`)),
      el('div.practice-progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': session.length, 'aria-valuenow': i },
        el('div', { style: { width: `${(i / session.length) * 100}%` } })),
      view.el, el('div.practice-next', null, nextBtn)));
    area.querySelector('.fc-question').setAttribute('tabindex', '-1');
    area.querySelector('.fc-question').focus();
  }
  function summary() {
    area.replaceChildren(el('section.complete', null,
      el('div.complete-badge', { 'aria-hidden': 'true' }, icon('mic', 28)),
      el('h2', { tabindex: '-1' }, 'Xong phiên luyện!'),
      el('p.lead', null, `${tally.good} thẻ trả lời tốt · ${tally.again} thẻ cần ôn lại`),
      el('p', null, tally.again ? 'Các thẻ cần ôn sẽ xuất hiện đầu tiên ở phiên sau.' : 'Tuyệt vời! Em hãy thử luyện với bạn trong vai giám khảo.'),
      el('div.complete-actions', null,
        el('button.btn.primary.lg', { type: 'button', onclick: () => { session = orderCards(all, store.progress.cards).slice(0, SESSION_SIZE); i = 0; tally.good = tally.again = 0; showCard(); } }, icon('rotate-ccw', 18), 'Phiên mới'),
        el('a.btn.lg', { href: '#/' }, 'Về trang chủ'))));
    area.querySelector('h2').focus();
    announce('Xong phiên luyện');
  }
  showCard();
  return { title: 'Luyện phản biện', destroy() {} };
}
