// Phản biện thử: a simulated judge panel asks 8 open questions. Per question: countdown (60/90 s) while the
// learner answers aloud (optional notes) → model answer + key-point checklist (self-tick = score) →
// optional "hỏi xoáy" follow-up. Resumable after a refresh; summary synced like any exam attempt.
import { el, svgNode } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { MODES, generateDefense, newAttemptId, followUpFor } from '../exam/generate.js';
import { loadCurrent, saveCurrent, clearCurrent, saveDetail, fmtClock } from '../exam/session.js';
import { examData, unitInfo } from '../exam/data.js';
import { modeName, modeHref } from './exam.js';
import { confirmDialog, announce, prefersReducedMotion } from '../a11y.js';

const JUDGES = ['Giám khảo 1', 'Giám khảo 2', 'Giám khảo 3'];
const FOLLOW_SEC = 45;

export function render(root, _params, ctx) {
  const { course, store } = ctx;
  const storage = store.storage;
  const page = el('div.page.narrow.exam-defense');
  page.append(el('div.boot', { role: 'status' }, el('span.spinner', { 'aria-hidden': 'true' }), ' Hội đồng đang vào chỗ…'));
  root.append(page);
  let destroyed = false;
  let timer = null;
  const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };

  examData(course).then((data) => {
    if (destroyed) return;
    const cur = loadCurrent(storage);
    if (cur && cur.mode === 'defense') run(cur, data); else intro(data, cur);
  });

  function intro(data, other) {
    let secs = 90;
    const timeChips = [60, 90].map((s) => el('button.chip', { type: 'button', 'aria-pressed': String(s === secs), class: s === secs ? 'active' : '', onclick: () => {
      secs = s; timeChips.forEach((c, i) => { const on = [60, 90][i] === s; c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on)); });
    } }, `${s} giây/câu`));
    const startBtn = el('button.btn.primary.lg', { type: 'button' }, '🎤 Vào phòng phản biện');
    const card = el('section.exam-intro', { 'aria-labelledby': 'xd-h' },
      el('div.def-panel-art', { 'aria-hidden': 'true' }, svgNode(panelSvg(-1))),
      el('p.eyebrow', null, 'Thi thử'),
      el('h1#xd-h', { tabindex: '-1' }, '🎤 Phản biện thử'),
      el('p.lead', null, `Hội đồng ảo hỏi ${MODES.defense.size} câu, trộn từ các chương và từ ngân hàng câu hỏi riêng của đề thi.`),
      el('ul.exam-rules', null,
        rule('🗣️', 'Trả lời THÀNH TIẾNG như trước hội đồng thật. Có thể gõ vài ý ghi chú.'),
        rule('⏳', 'Mỗi câu có đồng hồ đếm ngược. Hết giờ thì câu trả lời mẫu hiện ra.'),
        rule('✅', 'Đọc câu trả lời mẫu rồi tự đánh dấu những ý chính em đã nói được: đó là điểm của em.'),
        rule('🔥', 'Muốn khó hơn? Bấm "Giám khảo hỏi xoáy" để nhận thêm một câu hỏi bám đuổi.')),
      el('div.def-time', { role: 'group', 'aria-label': 'Thời gian mỗi câu' }, el('span', null, 'Thời gian mỗi câu:'), timeChips),
      other ? el('p.exam-conflict', { role: 'note' }, '⏳ Em đang có một bài làm dở (', el('a', { href: modeHref(other.mode, other.unitId) }, modeName(course, other)), '). Vào phòng phản biện sẽ bỏ bài đó.') : null,
      el('div.complete-actions', null, startBtn, el('a.btn.lg', { href: '#/exam' }, 'Để sau')));
    page.replaceChildren(card);
    card.querySelector('h1').focus();
    startBtn.addEventListener('click', async () => {
      if (other && !(await confirmDialog(`Bỏ bài đang làm dở (${modeName(course, other)})?`, { ok: 'Bỏ và bắt đầu', cancel: 'Huỷ', danger: true }))) return;
      const now = Date.now();
      const id = newAttemptId(now);
      const qs = generateDefense({ course, bank: data.bank, seed: id, size: MODES.defense.size, cards: store.progress.cards });
      const a = { v: 1, id, mode: 'defense', unitId: null, seed: id, startedAt: now, secs, qs, ans: {}, flags: [], cur: 0, phase: 'answer', qEnd: now + secs * 1000 };
      saveCurrent(storage, a);
      run(a, data);
    });
  }

  function run(a, data) {
    a.qs = a.qs.filter((q) => data.index.has(q.id));
    if (!a.qs.length) { clearCurrent(storage); intro(data, null); return; }
    const N = a.qs.length;
    const reduced = prefersReducedMotion();
    const persist = () => saveCurrent(storage, a);

    function show() {
      stopTimer();
      const i = a.cur;
      const q = a.qs[i];
      const step = data.index.get(q.id).step;
      const ui = unitInfo(course, q.unitId);
      const r = a.ans[q.id] || (a.ans[q.id] = { k: [], t: '' });
      const judge = i % JUDGES.length;
      const question = step.prompt.replace(/^Giám khảo hỏi:\s*/, '');

      const head = el('div.def-head', null,
        el('span.exam-count', null, `Câu ${i + 1}/${N}`),
        el('span.tag', null, `${ui.icon} ${ui.label}`),
        el('div.practice-progress', { role: 'progressbar', 'aria-label': 'Tiến độ phản biện', 'aria-valuemin': 0, 'aria-valuemax': N, 'aria-valuenow': i },
          el('div', { style: { width: `${(i / N) * 100}%` } })));
      const panel = el('div.def-panel', { 'aria-hidden': 'true' }, svgNode(panelSvg(judge)));
      const bubble = el('div.def-bubble', null, el('div.def-who', null, `${JUDGES[judge]} hỏi:`), el('h1.def-q', { tabindex: '-1', html: inline(question) }));
      const area = el('div.def-area');
      page.replaceChildren(head, panel, bubble, area);

      if (a.phase === 'answer') answerPhase(); else reviewPhase();
      bubble.querySelector('h1').focus({ preventScroll: true });
      announce(`Câu ${i + 1}. ${JUDGES[judge]} hỏi: ${bubble.querySelector('h1').textContent}`);

      function answerPhase() {
        const ring = el('div.def-timer', { role: 'timer', 'aria-label': 'Thời gian trả lời' });
        const notes = el('textarea.text-input.def-notes', { rows: 3, maxlength: 1000, placeholder: 'Ghi nhanh vài ý (không bắt buộc)…', 'aria-label': 'Ghi chú câu trả lời' });
        notes.value = r.t || '';
        notes.addEventListener('input', () => { r.t = notes.value.slice(0, 1000); persist(); });
        const done = el('button.btn.primary.lg', { type: 'button', onclick: () => toReview(false) }, '✋ Em trả lời xong');
        area.replaceChildren(el('div.def-answer', null, ring,
          el('div.def-answer-side', null, el('p.def-say', null, '🗣️ Hãy trả lời thành tiếng: ý chính → dẫn chứng (số liệu, dòng code) → giới hạn.'), notes, el('div.def-actions', null, done))));
        const paintRing = () => {
          const left = Math.ceil((a.qEnd - Date.now()) / 1000);
          ring.replaceChildren(svgNode(countdownSvg(Math.max(0, left), a.secs)));
          ring.setAttribute('aria-label', `Còn ${Math.max(0, left)} giây`);
          ring.classList.toggle('danger', left <= 10);
          if (left === 10) announce('Còn 10 giây');
          if (left <= 0) toReview(true);
        };
        paintRing();
        timer = setInterval(paintRing, reduced ? 1000 : 250);
      }
      function toReview(timeUp) {
        stopTimer();
        a.phase = 'review'; a.timeUp = !!timeUp; persist();
        reviewPhase();
        area.querySelector('.fc-answer').focus();
      }
      function reviewPhase() {
        const kp = step.keyPoints || [];
        const score = el('p.def-score', { 'aria-live': 'polite' });
        const paintScore = () => { score.textContent = `Em nói được ${r.k.length}/${kp.length} ý chính`; };
        const checks = el('ul.def-points', { 'aria-label': 'Những ý chính em đã nói được' }, kp.map((k, j) => {
          const id = `def-${a.id}-${i}-${j}`;
          const cb = el('input', { type: 'checkbox', id });
          cb.checked = r.k.includes(j);
          cb.addEventListener('change', () => {
            r.k = kp.map((_, x) => x).filter((x) => (x === j ? cb.checked : r.k.includes(x)));
            persist(); paintScore();
          });
          return el('li', null, cb, el('label', { for: id, html: inline(k) }));
        }));
        paintScore();
        const fu = followUpFor(step, data.followUps, data.genericFollowUp);
        const fuBox = el('div.def-follow');
        const fuBtn = fu ? el('button.btn.def-follow-btn', { type: 'button', onclick: () => followUp() }, '🔥 Giám khảo hỏi xoáy') : null;
        function followUp() {
          r.f = 1; persist();
          let end = Date.now() + FOLLOW_SEC * 1000;
          const t = el('span.def-follow-t', { role: 'timer' });
          const ans = el('div.def-follow-ans', { hidden: true }, el('div.fc-label', null, 'Gợi ý trả lời'), el('div', { html: blocks(fu.answer) }));
          const showBtn = el('button.btn.sm', { type: 'button', onclick: () => reveal() }, 'Xem gợi ý trả lời');
          const reveal = () => { stopTimer(); ans.hidden = false; showBtn.remove(); t.textContent = ''; };
          fuBox.replaceChildren(el('div.def-bubble.follow', null, el('div.def-who', null, `${JUDGES[(judge + 1) % 3]} hỏi thêm:`), el('p.def-fq', { html: inline(fu.prompt) })), t, showBtn, ans);
          fuBtn.remove();
          stopTimer();
          const tick = () => { const left = Math.ceil((end - Date.now()) / 1000); t.textContent = `⏳ ${fmtClock(Math.max(0, left))}`; if (left <= 0) reveal(); };
          tick(); timer = setInterval(tick, 1000);
          fuBox.querySelector('.def-fq').setAttribute('tabindex', '-1'); fuBox.querySelector('.def-fq').focus();
        }
        const last = i === N - 1;
        const next = el('button.btn.primary.lg', { type: 'button', onclick: () => {
          stopTimer();
          if (last) { finish(); return; }
          a.cur += 1; a.phase = 'answer'; a.timeUp = false; a.qEnd = Date.now() + a.secs * 1000; persist();
          show(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        } }, last ? '🏁 Xem kết quả' : 'Câu tiếp →');
        area.replaceChildren(...[
          a.timeUp ? el('p.def-timeup', { role: 'status' }, '⏰ Hết giờ! Ở phòng thi thật, giám khảo sẽ ngắt lời ở đây. Tập nói gọn hơn nhé.') : null,
          r.t ? el('div.rv-notes', null, el('strong', null, 'Ghi chú của em: '), r.t) : null,
          el('div.fc-answer', { tabindex: '-1' }, el('div.fc-label', null, 'Câu trả lời mẫu'), el('div', { html: blocks(step.modelAnswer) })),
          el('div.fc-label', null, 'Em đã nói được những ý nào? (tự đánh dấu, đây là điểm của em)'),
          checks, score,
          step.explanation ? el('p.ex-sub', null, '💡 ', el('span', { html: inline(step.explanation) })) : null,
          fuBtn, fuBox,
          el('div.def-actions', null, next)].filter(Boolean));
      }
    }

    function finish() {
      const at = Date.now();
      const perUnit = {};
      let s = 0, n = 0;
      for (const q of a.qs) {
        const kp = (data.index.get(q.id).step.keyPoints || []).length;
        const k = Math.min(kp, (a.ans[q.id]?.k || []).length);
        s += k; n += kp;
        const u = perUnit[q.unitId] || (perUnit[q.unitId] = [0, 0]);
        u[0] += k; u[1] += kp;
      }
      const d = Math.max(1, Math.round((at - a.startedAt) / 1000));
      saveDetail(storage, { id: a.id, mode: 'defense', unitId: null, at, d, qs: a.qs, ans: a.ans, flags: [], ok: {} });
      store.recordExam(a.id, { m: 'defense', at, s, n, d, u: perUnit });
      store.flush();
      clearCurrent(storage);
      location.hash = `#/exam/result/${a.id}`;
    }

    show();
  }

  return { title: 'Phản biện thử', destroy() { destroyed = true; stopTimer(); } };
}

function rule(icon, text) {
  return el('li', null, el('span.exam-rule-icon', { 'aria-hidden': 'true' }, icon), el('span', null, text));
}

/** Three judges behind a table; `speaking` (0–2) is highlighted, -1 = none. */
function panelSvg(speaking) {
  const xs = [70, 180, 290];
  const judges = xs.map((x, i) => {
    const on = i === speaking;
    return `<g class="def-judge${on ? ' on' : ''}">
      ${on ? `<circle cx="${x}" cy="44" r="34" class="def-halo"/>` : ''}
      <circle cx="${x}" cy="44" r="24" class="def-head-c"/>
      <circle cx="${x - 8}" cy="40" r="3" class="def-eye"/><circle cx="${x + 8}" cy="40" r="3" class="def-eye"/>
      <path d="M${x - 8} ${on ? 52 : 54} q8 ${on ? 8 : 3} 16 0" class="def-mouth"/>
      <path d="M${x - 30} 104 q30 -40 60 0 z" class="def-body"/>
      <rect x="${x - 34}" y="112" width="68" height="20" rx="4" class="def-plate"/>
      <text x="${x}" y="126" font-size="12" text-anchor="middle" class="def-plate-t">GK ${i + 1}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" font-family="inherit"><rect x="10" y="100" width="340" height="44" rx="8" class="def-table"/>${judges}</svg>`;
}

function countdownSvg(left, total) {
  const size = 132, r = 54, c = 2 * Math.PI * r, f = total ? left / total : 0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="66" cy="66" r="${r}" class="xr-bg" stroke-width="12" fill="none"/>
    <circle cx="66" cy="66" r="${r}" class="def-ring-fg" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 66 66)"/>
    <text x="66" y="66" dy="0.35em" text-anchor="middle" font-size="30" font-weight="700" class="xr-text">${left}</text>
    <text x="66" y="92" text-anchor="middle" font-size="12" class="xt-axis">giây</text></svg>`;
}
