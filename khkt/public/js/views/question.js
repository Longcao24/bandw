// /question (and #/question[/<id>]): every defense question in one searchable list. Data comes from
// content/defense-index.js (the same index the AI grader uses). Each item expands to: answer box (+ vi-VN
// dictation), "Chấm bằng AI", model answer + self-rating, and a link to the lesson that teaches it.
import { el, fmtNumber } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { announce } from '../a11y.js';
import { createGrader, scoreBadge } from '../grading/panel.js';
import { fmtScore } from '../grading/api.js';
import { icon } from '../icons.js';

const FILTER_KEY = 'bw.v1.qfilter';
const STATUS_OPTS = [
  ['all', 'Mọi trạng thái'], ['new', 'Chưa luyện'], ['done', 'Đã luyện'], ['ai', 'Đã chấm AI'], ['low', 'Điểm AI dưới 7'], ['again', 'Tự đánh giá: cần ôn'],
];

function loadFilter() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) || 'null') || {}; } catch { return {}; }
}
function saveFilter(f) {
  try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* private mode */ }
}
const domId = (id) => 'q-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '-');

/** Practice status of one question: { key: 'new'|'done'|'ai', best, card } */
export function statusOf(store, id) {
  const g = store.grade ? store.grade(id) : null;
  const card = store.progress.cards[id] || null;
  if (g) return { key: 'ai', best: g.best, card };
  if (card) return { key: 'done', best: null, card };
  return { key: 'new', best: null, card: null };
}

export function render(root, params, { course, store }) {
  const page = el('div.page.qbank');
  page.append(el('div.boot', { role: 'status' }, el('span.spinner', { 'aria-hidden': 'true' }), ' Đang tải ngân hàng câu hỏi…'));
  root.append(page);
  let destroyed = false;
  const graders = new Map();
  let unsub = null;

  import('../../content/defense-index.js').then((idx) => { if (!destroyed) build(idx); }).catch((e) => {
    console.error(e);
    if (!destroyed) page.replaceChildren(el('h1', { tabindex: '-1' }, 'Chưa tải được câu hỏi'), el('p', null, 'Em thử tải lại trang nhé.'));
  });

  function build(idx) {
    const items = idx.list();
    const total = items.length;
    const f = { u: '', t: '', s: 'all', q: '', ...loadFilter() };

    // ---------- header ----------
    const statsBox = el('p.meta-line.q-stats');
    const head = el('header.page-head.q-head', null,
      el('h1', { tabindex: '-1' }, 'Câu hỏi phản biện'),
      el('p.lead', null, `${fmtNumber(total)} câu giám khảo có thể hỏi. Mở một câu, tự trả lời (gõ hoặc nói), rồi để AI chấm và chỉ ra ý còn thiếu.`),
      statsBox);

    // ---------- controls ----------
    const search = el('input.search.q-search', { type: 'search', id: 'q-search', placeholder: 'Tìm câu hỏi: “watchdog”, “nghieng”, “pin”…', autocomplete: 'off', enterkeyhint: 'search' });
    search.value = f.q || '';
    const unitSel = el('select#q-unit', null, el('option', { value: '' }, 'Mọi chương'),
      course.units.map((u, i) => {
        const n = items.filter((it) => it.unitId === u.id).length;
        return n ? el('option', { value: u.id }, `Ch. ${i + 1}: ${u.title} (${n})`) : null;
      }));
    unitSel.value = f.u || '';
    const topicSel = el('select#q-topic', null, el('option', { value: '' }, 'Mọi chủ đề'),
      idx.topics().map((t) => el('option', { value: t.id }, `${t.label} (${t.count})`)));
    topicSel.value = f.t || '';
    const statusSel = el('select#q-status', null, STATUS_OPTS.map(([v, l]) => el('option', { value: v }, l)));
    statusSel.value = f.s || 'all';
    const randomBtn = el('button.btn.sm.q-random', { type: 'button' }, icon('shuffle', 16), 'Luyện ngẫu nhiên');
    const resetBtn = el('button.btn.ghost.sm.q-reset', { type: 'button' }, 'Xoá bộ lọc');
    const shown = el('p.q-shown', { role: 'status', 'aria-live': 'polite' });
    const controls = el('section.q-controls', { 'aria-label': 'Tìm và lọc câu hỏi' },
      el('div.q-field.q-field-search', null, el('label.sr-only', { for: 'q-search' }, 'Tìm kiếm (gõ có dấu hay không dấu đều được)'), search),
      el('div.q-field', null, el('label.sr-only', { for: 'q-unit' }, 'Chương'), unitSel),
      el('div.q-field', null, el('label.sr-only', { for: 'q-topic' }, 'Chủ đề'), topicSel),
      el('div.q-field', null, el('label.sr-only', { for: 'q-status' }, 'Trạng thái'), statusSel),
      el('div.q-ctl-row', null, shown, resetBtn, randomBtn));

    // ---------- list ----------
    const list = el('ol.q-list', { 'aria-label': 'Danh sách câu hỏi phản biện' });
    const rows = new Map();
    for (const it of items) {
      const row = makeRow(it);
      rows.set(it.id, row);
      list.append(row.li);
    }
    const empty = el('div.empty.q-empty', { hidden: true }, el('p', null, 'Không có câu nào khớp. Em thử bỏ bớt bộ lọc nhé.'),
      el('button.btn', { type: 'button', onclick: () => resetFilters() }, 'Xoá bộ lọc'));

    page.replaceChildren(head, controls, list, empty);
    page.querySelector('h1').focus();

    function makeRow(it) {
      const bodyId = domId(it.id) + '-body';
      const statusEl = el('span.q-status');
      const toggle = el('button.q-toggle', { type: 'button', 'aria-expanded': 'false', 'aria-controls': bodyId },
        el('span.q-num', { 'aria-hidden': 'true' }, String(it.n)),
        el('span.q-main', null,
          el('span.q-text', { html: inline(it.question) }),
          el('span.q-meta', null, [`Chương ${it.unitIndex || '?'}`, it.tag || it.topic.label, it.src === 'bank' ? 'Đề thi thử' : null].filter(Boolean).join(' · '))),
        statusEl,
        el('span.q-chev', { 'aria-hidden': 'true' }, icon('chevron-down', 18)));
      const body = el('div.q-body', { id: bodyId, hidden: true, role: 'region', 'aria-label': `Câu ${it.n}` });
      const li = el('li.q-item', { id: domId(it.id), dataset: { id: it.id } }, el('h2.q-h', null, toggle), body);
      let built = false;
      const row = { it, li, toggle, body, statusEl, open: false, paint, expand, collapse };
      function paint() {
        const st = statusOf(store, it.id);
        li.dataset.status = st.key;
        const again = st.card && st.card.r === 'again';
        statusEl.replaceChildren(st.key === 'ai' ? scoreBadge(st.best)
          : st.key === 'done' ? el('span.q-st', { class: again ? 'again' : 'done', title: again ? 'Cần ôn' : 'Đã luyện' }, icon(again ? 'repeat' : 'circle-half', 18), el('span.sr-only', null, again ? 'Cần ôn' : 'Đã luyện'))
            : el('span.q-st.new', { title: 'Chưa luyện' }, icon('circle', 18), el('span.sr-only', null, 'Chưa luyện')));
      }
      function buildBody() {
        built = true;
        const lessonLink = it.lessonId
          ? el('a.btn.sm.ghost.q-lesson', { href: it.href }, icon('book-open', 16), it.embedded ? 'Đi tới bài học' : 'Ôn bài liên quan',
            el('span.q-lesson-t', null, `: ${it.lessonTitle}`))
          : el('a.btn.sm.ghost.q-lesson', { href: it.href }, icon('book-open', 16), 'Đi tới chương');
        const grader = createGrader(it, { store, onResult: () => { paint(); updateStats(); applyFilters(false); } });
        graders.set(it.id, grader);
        const modelId = domId(it.id) + '-model';
        const showModel = el('button.btn.sm.q-show', { type: 'button', 'aria-expanded': 'false', 'aria-controls': modelId }, icon('eye', 16), el('span', null, 'Xem câu trả lời mẫu'));
        const rated = el('p.fc-rated', { role: 'status', hidden: true });
        const rateBtn = (r, label) => el('button.btn.sm' + (r === 'good' ? '.success' : ''), { type: 'button', onclick: (e) => {
          const pts = store.rateCard(it.id, r);
          for (const b of e.currentTarget.parentNode.children) { b.classList.remove('chosen'); b.setAttribute('aria-pressed', 'false'); }
          e.currentTarget.classList.add('chosen'); e.currentTarget.setAttribute('aria-pressed', 'true');
          rated.hidden = false; rated.textContent = (r === 'good' ? 'Tuyệt! Đã ghi là trả lời tốt.' : 'Đã ghi: câu này cần ôn lại.') + (pts ? ` +${pts} điểm` : '');
          paint(); updateStats(); applyFilters(false);
        } }, label);
        const model = el('div.q-model', { id: modelId, hidden: true },
          el('div.fc-answer', { tabindex: '-1' }, el('div.fc-label', null, 'Câu trả lời mẫu'), el('div', { html: blocks(it.modelAnswer) })),
          el('div.fc-label', null, 'Ý chính cần có'),
          el('ul.q-kp', null, it.keyPoints.map((k) => el('li', { html: inline(k) }))),
          it.step.explanation ? el('p.ex-sub.fc-tip', null, icon('lightbulb', 16), el('span', { html: inline(it.step.explanation) })) : null,
          el('div.fc-label', null, 'Em tự thấy mình trả lời thế nào?'),
          el('div.fc-rate', null, rateBtn('good', [icon('thumbs-up', 16), 'Đã trả lời tốt']), rateBtn('again', [icon('repeat', 16), 'Cần ôn lại'])), rated);
        showModel.addEventListener('click', () => {
          const open = model.hidden;
          model.hidden = !open;
          showModel.setAttribute('aria-expanded', String(open));
          showModel.replaceChildren(icon(open ? 'eye-off' : 'eye', 16), el('span', null, open ? 'Ẩn câu trả lời mẫu' : 'Xem câu trả lời mẫu'));
          if (open) model.querySelector('.fc-answer').focus();
        });
        body.append(
          el('p.q-where', null, it.lessonId ? `Chương ${it.unitIndex} · ${it.lessonTitle}` : `Chương ${it.unitIndex}`,
            it.src === 'bank' ? ' · câu của đề thi thử' : ''),
          grader.el,
          el('div.q-actions', null, showModel, lessonLink),
          model);
      }
      function expand({ focus = false } = {}) {
        if (!built) buildBody();
        body.hidden = false; row.open = true; li.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        if (focus) graders.get(it.id)?.focus();
      }
      function collapse() {
        body.hidden = true; row.open = false; li.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
      toggle.addEventListener('click', () => (row.open ? collapse() : expand()));
      paint();
      return row;
    }

    function updateStats() {
      let done = 0, ai = 0, sum = 0;
      for (const it of items) {
        const st = statusOf(store, it.id);
        if (st.key !== 'new') done++;
        if (st.key === 'ai') { ai++; sum += st.best; }
      }
      const bar = el('span.q-stats-bar', { role: 'progressbar', 'aria-label': 'Đã luyện', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done },
        el('span', { style: { width: `${total ? (done / total) * 100 : 0}%` } }));
      statsBox.replaceChildren(...[
        el('span', null, bar, `Đã luyện ${done}/${total}`),
        el('span', null, `Đã chấm AI ${ai}`),
        ai ? el('span', null, `Điểm AI trung bình ${fmtScore(sum / ai)}/10`) : null].filter(Boolean));
    }

    function visible(it) {
      if (f.u && it.unitId !== f.u) return false;
      if (f.t && it.topic.id !== f.t) return false;
      if (f.s && f.s !== 'all') {
        const st = statusOf(store, it.id);
        if (f.s === 'new' && st.key !== 'new') return false;
        if (f.s === 'done' && st.key === 'new') return false;
        if (f.s === 'ai' && st.key !== 'ai') return false;
        if (f.s === 'low' && !(st.key === 'ai' && st.best < 7)) return false;
        if (f.s === 'again' && !(st.card && st.card.r === 'again')) return false;
      }
      return idx.matches(it, f.q);
    }
    let lastShown = -1;
    function applyFilters(say = true) {
      let n = 0;
      for (const row of rows.values()) {
        // keep an open item visible while the learner is working on it (status filters change under them)
        const v = visible(row.it) || (!say && row.open);
        row.li.hidden = !v;
        if (v) n++;
      }
      empty.hidden = n > 0;
      const text = n === total ? `Đang hiện cả ${total} câu` : `Đang hiện ${n}/${total} câu`;
      if (say || n !== lastShown) shown.textContent = text;
      lastShown = n;
      saveFilter(f);
      resetBtn.hidden = !(f.u || f.t || f.q || (f.s && f.s !== 'all'));
      return n;
    }
    function resetFilters() {
      f.u = ''; f.t = ''; f.s = 'all'; f.q = '';
      search.value = ''; unitSel.value = ''; topicSel.value = ''; statusSel.value = 'all';
      applyFilters(); search.focus();
    }
    let qTimer = null;
    search.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { f.q = search.value; applyFilters(); }, 150); });
    unitSel.addEventListener('change', () => { f.u = unitSel.value; applyFilters(); });
    topicSel.addEventListener('change', () => { f.t = topicSel.value; applyFilters(); });
    statusSel.addEventListener('change', () => { f.s = statusSel.value; applyFilters(); });
    resetBtn.addEventListener('click', resetFilters);
    randomBtn.addEventListener('click', () => {
      const pool = [...rows.values()].filter((r) => !r.li.hidden);
      if (!pool.length) { announce('Không có câu nào để chọn'); return; }
      const fresh = pool.filter((r) => statusOf(store, r.it.id).key === 'new');
      const weak = pool.filter((r) => { const st = statusOf(store, r.it.id); return (st.key === 'ai' && st.best < 7) || (st.card && st.card.r === 'again'); });
      const from = fresh.length ? fresh : weak.length ? weak : pool;
      const pick = from[Math.floor(Math.random() * from.length)];
      openRow(pick, true);
      announce(`Câu ${pick.it.n}: ${pick.toggle.querySelector('.q-text').textContent}`);
    });
    function openRow(row, focus) {
      row.li.hidden = false;
      row.expand({ focus: false });
      row.li.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (focus) graders.get(row.it.id)?.focus();
      else row.toggle.focus();
    }

    updateStats();
    applyFilters(false);
    unsub = store.on((reason) => {
      if (reason !== 'merge' && reason !== 'reset') return;
      for (const r of rows.values()) r.paint();
      updateStats(); applyFilters(false);
    });

    if (params && params.id) {
      const row = rows.get(params.id);
      if (row) { setTimeout(() => { if (!destroyed) openRow(row, false); }, 0); }
    }
  }

  return {
    title: 'Câu hỏi phản biện',
    destroy() { destroyed = true; if (unsub) unsub(); for (const g of graders.values()) g.destroy(); },
  };
}
