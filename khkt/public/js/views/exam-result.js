// Mock-exam results: score ring + Khan-style message, per-unit SVG bars, weak units with direct lesson
// links, and a question-by-question review (learner's answer vs correct answer + explanation).
import { el, svgNode } from '../util.js';
import { createExercise } from '../exercises/_frame.js';
import { inline, blocks } from '../render/markdown.js';
import { NAMED_DIAGRAMS } from '../diagrams/index.js';
import { correctText, answerText } from '../exam/grade.js';
import { loadDetail, fmtDuration, fmtDate, cheer } from '../exam/session.js';
import { unitBarsSvg, scoreRingSvg, level, GOAL } from '../exam/chart.js';
import { examData, unitInfo, lessonInfo } from '../exam/data.js';
import { modeName, modeHref } from './exam.js';
import { prefersReducedMotion } from '../a11y.js';

export function render(root, { attemptId }, ctx) {
  const { course, store } = ctx;
  const page = el('div.page.exam-result');
  root.append(page);
  let destroyed = false;
  const open = new Map(); // review index → exercise controllers
  const summary = store.examHistory().find((h) => h.id === attemptId) || null;
  const detail = loadDetail(store.storage, attemptId);

  if (!summary && !detail) {
    page.append(el('section.empty', null, el('h1', { tabindex: '-1' }, 'Không tìm thấy kết quả này'),
      el('p', null, 'Có thể kết quả thuộc một mã học tập khác, hoặc đã cũ hơn 30 lần thi gần nhất.'), el('a.btn.primary', { href: '#/exam' }, 'Về Thi thử')));
    return { title: 'Kết quả thi thử', destroy() {} };
  }
  page.append(el('div.boot', { role: 'status' }, el('span.spinner', { 'aria-hidden': 'true' }), ' Đang chấm bài…'));
  examData(course).then((data) => { if (!destroyed) build(data); });

  function build(data) {
    const mode = (summary && summary.m) || detail.mode;
    const isDefense = mode === 'defense';
    const s = summary ? summary.s : Object.values(detail.ok || {}).filter(Boolean).length;
    const n = summary ? summary.n : Object.keys(detail.ok || {}).length;
    const pct = n ? Math.round((s / n) * 100) : 0;
    const d = summary ? summary.d : detail.d;
    const at = summary ? summary.at : detail.at;
    const perUnit = summary ? summary.u : {};
    if (!summary && detail && !isDefense) {
      for (const q of detail.qs) {
        if (detail.ok[q.id] === undefined) continue;
        const u = perUnit[q.unitId] || (perUnit[q.unitId] = [0, 0]);
        u[1] += 1; if (detail.ok[q.id]) u[0] += 1;
      }
    }
    const ch = cheer(pct);
    const meta = { m: mode, uu: (summary && summary.uu) || (detail && detail.unitId) };
    const again = isDefense ? '#/exam/defense' : modeHref(mode, meta.uu);

    const hero = el('section.exam-score', { 'aria-labelledby': 'xr-h' },
      el('div.exam-score-ring', null, svgNode(scoreRingSvg(pct))),
      el('div.exam-score-text', null,
        el('p.eyebrow', null, `${modeName(course, meta)} · ${fmtDate(at)}`),
        el('h1#xr-h', { tabindex: '-1' }, `${ch.icon} ${ch.title}`),
        el('p.exam-score-big', null, isDefense ? `Em nói được ${s}/${n} ý chính` : `Em làm đúng ${s}/${n} câu`),
        el('p.lead', null, ch.text),
        el('div.exam-score-pills', null,
          el('span.pill', null, `⏱ ${fmtDuration(d)}${detail && detail.limitSec ? ` / ${Math.round(detail.limitSec / 60)} phút` : ''}`),
          detail && detail.auto ? el('span.pill.again', null, '⏰ Nộp tự động khi hết giờ') : null,
          detail && detail.flags && detail.flags.length ? el('span.pill', null, `🚩 ${detail.flags.length} câu đã đánh dấu`) : null)),
      el('div.complete-actions', null,
        el('a.btn.primary.lg', { href: again }, '↺ Làm đề mới'),
        el('a.btn.lg', { href: '#/exam' }, 'Về Thi thử')));
    page.replaceChildren(hero);
    hero.querySelector('h1').focus({ preventScroll: true });

    // ---- per unit ----
    const unitRows = course.units.filter((u) => perUnit[u.id]).map((u) => {
      const ui = unitInfo(course, u.id);
      return { id: u.id, label: ui.short, name: u.title, icon: u.icon, c: perUnit[u.id][0], t: perUnit[u.id][1] };
    });
    if (unitRows.length) {
      page.append(el('section.exam-units', { 'aria-labelledby': 'xu-h' },
        el('h2#xu-h', null, isDefense ? 'Ý chính theo chương' : 'Điểm theo chương'),
        el('figure.exam-bars', null, svgNode(unitBarsSvg(unitRows, { title: 'Điểm theo chương' })),
          el('figcaption', null, `Vạch gạch: mục tiêu ${GOAL}%. Xanh = vững, cam = cần ôn thêm, đỏ = cần ôn lại.`))));
    }

    // ---- weak units → lessons containing the missed questions ----
    const ok = (detail && detail.ok) || {};
    const missedByUnit = new Map();
    if (detail && !isDefense) {
      for (const q of detail.qs) {
        if (ok[q.id] !== false) continue;
        if (!missedByUnit.has(q.unitId)) missedByUnit.set(q.unitId, new Map());
        const lm = missedByUnit.get(q.unitId);
        lm.set(q.lessonId, (lm.get(q.lessonId) || 0) + 1);
      }
    }
    const weak = unitRows.filter((r) => (r.c / r.t) * 100 < GOAL).sort((a, b) => a.c / a.t - b.c / b.t);
    if (weak.length) {
      const list = el('div.exam-weak-list');
      const more = el('div.exam-weak-list');
      weak.forEach((r, wi) => {
        const pctU = Math.round((r.c / r.t) * 100);
        const lessons = [...(missedByUnit.get(r.id) || new Map())].map(([lid, cnt]) => ({ info: lessonInfo(course, r.id, lid), cnt })).filter((x) => x.info);
        (wi < 3 ? list : more).append(el('article.exam-weak', { class: `xb-${level(pctU)}` },
          el('div.exam-weak-head', null, el('span.exam-weak-icon', { 'aria-hidden': 'true' }, r.icon),
            el('div', null, el('strong', null, `${unitInfo(course, r.id).label}: ${r.name}`), el('small', null, `${r.c}/${r.t} · ${pctU}%`))),
          lessons.length
            ? el('ul.exam-weak-lessons', null, lessons.map((x) => el('li', null, el('a', { href: x.info.href }, `📖 ${x.info.title}`), el('span.tag', null, `${x.cnt} câu sai`))))
            : el('p', null, el('a', { href: `#/unit/${r.id}` }, 'Ôn lại chương này →')),
          el('a.btn.sm', { href: isDefense ? `#/practice/${r.id}` : `#/exam/unit/${r.id}` }, isDefense ? '🎤 Luyện thẻ chương này' : '📚 Làm 10 câu chương này')));
      });
      page.append(el('section.exam-weak-sec', { 'aria-labelledby': 'xw-h' },
        el('h2#xw-h', null, '🎯 Nên ôn tiếp'),
        el('p.ex-sub', null, isDefense
          ? (weak.length > 3 ? 'Bắt đầu với 3 chương em nói được ít ý chính nhất. Luyện lại thẻ phản biện của chương đó.' : 'Các chương em nói được ít ý chính, dưới mục tiêu. Luyện lại thẻ phản biện của chương đó.')
          : (weak.length > 3 ? 'Bắt đầu với 3 chương yếu nhất, kèm bài học chứa câu em làm sai.' : 'Các chương dưới mục tiêu, kèm bài học chứa câu em làm sai.')), list,
        weak.length > 3 ? el('details.exam-weak-more', null, el('summary', null, `Các chương khác cần ôn (${weak.length - 3})`), more) : null));
    } else if (unitRows.length) {
      page.append(el('section.exam-allgood', null, el('strong', null, '🎉 Mọi chương đều đạt mục tiêu!'), ' Thử ', el('a', { href: '#/exam/defense' }, 'Phản biện thử'), ' để luyện nói.'));
    }

    // ---- review ----
    if (!detail) {
      page.append(el('p.exam-note', { role: 'note' }, 'ℹ️ Bài làm chi tiết chỉ lưu trên máy đã làm bài. Ở máy này em xem được điểm và điểm theo chương.'));
      return;
    }
    if (isDefense) { page.append(defenseReview(detail, data)); return; }
    const flags = new Set(detail.flags || []);
    const wrongCount = detail.qs.filter((q) => ok[q.id] === false).length;
    const filterBtns = [['all', `Tất cả (${detail.qs.length})`], ['wrong', `Sai (${wrongCount})`], ['flag', `Đánh dấu (${flags.size})`]]
      .map(([k, t]) => el('button.chip', { type: 'button', 'data-f': k, 'aria-pressed': String(k === (wrongCount ? 'wrong' : 'all')) }, t));
    const list = el('ol.exam-review');
    const items = detail.qs.map((q, i) => {
      const item = data.index.get(q.id);
      if (!item) return null;
      const right = ok[q.id] === true;
      const ans = detail.ans[q.id];
      const step = item.step;
      const ui = unitInfo(course, q.unitId);
      const det = el('details.exam-rv', { class: right ? 'rv-ok' : 'rv-bad' });
      const sum = el('summary', null,
        el('span.rv-mark', { 'aria-hidden': 'true' }, right ? '✓' : ans === undefined ? '–' : '✗'),
        el('span.rv-num', null, `Câu ${i + 1}`),
        el('span.rv-prompt', { html: inline(step.prompt) }),
        el('span.sr-only', null, right ? ', đúng' : ans === undefined ? ', chưa làm' : ', sai'),
        flags.has(q.id) ? el('span.rv-flag', { title: 'Đã đánh dấu' }, '🚩') : null,
        el('span.tag', null, `${ui.icon} ${ui.short}`));
      const body = el('div.rv-body');
      det.append(sum, body);
      det.addEventListener('toggle', () => {
        if (det.open && !open.has(i)) {
          const labelOf = hotspotLabels(step);
          const ex = createExercise(step, { mode: 'exam', uid: `rv${i}-${detail.id}`, reducedMotion: prefersReducedMotion() });
          ex.review(ans === undefined ? null : ans);
          const lesson = lessonInfo(course, q.unitId, q.lessonId);
          const chosenEl = el('span', { class: right ? 'ok' : 'bad' }, answerText(step, ans === undefined ? null : ans, labelOf));
          const correctEl = right ? null : el('span.ok', null, correctText(step, labelOf));
          if (step.type === 'hotspot') {
            // Sim/inline-SVG hotspots only know their Vietnamese labels once the exercise has mounted.
            ex.labeler().then((domLabel) => {
              if (!domLabel || destroyed) return;
              const lab = (id) => { const d = domLabel(id); return d && d !== id ? d : labelOf(id); };
              chosenEl.textContent = answerText(step, ans === undefined ? null : ans, lab);
              if (correctEl) correctEl.textContent = correctText(step, lab);
            });
          }
          const correctBox = el('div.rv-correct', null,
            el('p', null, el('strong', null, 'Em chọn: '), chosenEl),
            right ? null : el('p', null, el('strong', null, 'Đáp án đúng: '), correctEl),
            right ? null : el('button.btn.sm', { type: 'button', onclick: (e) => {
              const again = createExercise(step, { mode: 'exam', uid: `rvc${i}-${detail.id}`, reducedMotion: prefersReducedMotion() });
              again.showCorrect();
              e.currentTarget.replaceWith(el('div.rv-correct-view', null, el('p.ex-sub', null, '✓ Đáp án đúng trên hình:'), again.el));
              open.get(i).push(again);
            } }, '👁 Xem đáp án đúng trên hình'));
          body.append(ans === undefined ? el('p.rv-skipped', null, '⚪ Em chưa trả lời câu này. Đây là đáp án đúng:') : null, ex.el, correctBox,
            lesson ? el('p.rv-lesson', null, el('a', { href: lesson.href }, `📖 Ôn bài: ${lesson.title} →`)) : null);
          open.set(i, [ex]);
        }
      });
      const li = el('li', { 'data-ok': right ? '1' : '0', 'data-flag': flags.has(q.id) ? '1' : '0' }, det);
      list.append(li);
      return li;
    }).filter(Boolean);
    const applyFilter = (f) => {
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
      filterBtns.forEach((b) => b.classList.toggle('active', b.dataset.f === f));
      for (const li of items) li.hidden = (f === 'wrong' && li.dataset.ok === '1') || (f === 'flag' && li.dataset.flag !== '1');
    };
    filterBtns.forEach((b) => b.addEventListener('click', () => applyFilter(b.dataset.f)));
    page.append(el('section.exam-review-sec', { 'aria-labelledby': 'xv-h' },
      el('h2#xv-h', null, 'Xem lại từng câu'),
      el('p.ex-sub', null, 'Bấm vào một câu để xem bài làm của em, đáp án đúng và giải thích.'),
      el('div.chips', { role: 'group', 'aria-label': 'Lọc câu hỏi' }, filterBtns), list));
    applyFilter(wrongCount ? 'wrong' : 'all');
  }

  function defenseReview(detail, data) {
    const list = el('ol.exam-review');
    detail.qs.forEach((q, i) => {
      const item = data.index.get(q.id);
      if (!item) return;
      const r = (detail.ans && detail.ans[q.id]) || {};
      const ticks = new Set(r.k || []);
      const kp = item.step.keyPoints || [];
      const det = el('details.exam-rv', { class: ticks.size >= Math.ceil(kp.length / 2) ? 'rv-ok' : 'rv-bad' },
        el('summary', null, el('span.rv-mark', { 'aria-hidden': 'true' }, `${ticks.size}/${kp.length}`), el('span.rv-num', null, `Câu ${i + 1}`), el('span.rv-prompt', { html: inline(item.step.prompt) })),
        el('div.rv-body', null,
          r.t ? el('div.rv-notes', null, el('strong', null, 'Ghi chú của em: '), r.t) : null,
          el('div.fc-answer', null, el('div.fc-label', null, 'Câu trả lời mẫu'), el('div', { html: blocks(item.step.modelAnswer) })),
          el('ul.def-points.readonly', null, kp.map((k, j) => el('li', { class: ticks.has(j) ? 'on' : '' }, el('span', { 'aria-hidden': 'true' }, ticks.has(j) ? '✓ ' : '○ '), el('span', { html: inline(k) }), el('span.sr-only', null, ticks.has(j) ? ' (đã nói được)' : ' (chưa nói)')))),
          item.lessonId ? el('p.rv-lesson', null, el('a', { href: lessonInfo(course, q.unitId, item.lessonId)?.href || `#/unit/${q.unitId}` }, '📖 Ôn bài liên quan →')) : null));
      list.append(el('li', null, det));
    });
    return el('section.exam-review-sec', { 'aria-labelledby': 'xv-h' }, el('h2#xv-h', null, 'Xem lại từng câu'), list);
  }

  return {
    title: 'Kết quả thi thử',
    destroy() { destroyed = true; for (const arr of open.values()) arr.forEach((x) => x.destroy()); },
  };
}

function hotspotLabels(step) {
  if (step.type !== 'hotspot') return (id) => id;
  const t = step.target || {};
  const named = t.name && NAMED_DIAGRAMS[t.name] ? NAMED_DIAGRAMS[t.name].hotspots : [];
  const map = new Map(named.map((h) => [h.id, h.label || h.id]));
  return (id) => map.get(id) || id;
}
