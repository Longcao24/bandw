// Timed mock exam: intro → questions (exam-mode renderers, no feedback) with timer, navigator grid and
// flags → confirm → grade → result. The attempt lives in localStorage so a refresh resumes it, timer included.
import { el } from '../util.js';
import { createExercise, TYPE_LABEL } from '../exercises/_frame.js';
import { MODES, generateExam, newAttemptId } from '../exam/generate.js';
import { scoreAttempt, isAnswerShape } from '../exam/grade.js';
import { loadCurrent, saveCurrent, clearCurrent, saveDetail, secondsLeft, fmtClock } from '../exam/session.js';
import { examData, unitInfo } from '../exam/data.js';
import { modeName, modeHref } from './exam.js';
import { unitColorVar } from './_ui.js';
import { confirmDialog, announce, toast, prefersReducedMotion } from '../a11y.js';

export function render(root, { mode, unitId }, ctx) {
  const { course, store } = ctx;
  const storage = store.storage;
  const page = el('div.page.exam-run');
  page.append(el('div.boot', { role: 'status' }, el('span.spinner', { 'aria-hidden': 'true' }), ' Đang chuẩn bị đề…'));
  root.append(page);
  let destroyed = false;
  const cleanups = [];
  const m = MODES[mode];
  const unit = unitId ? course.units.find((u) => u.id === unitId) : null;
  const title = mode === 'unit' && unit ? `Thi theo chương: ${unit.title}` : m.label;

  examData(course).then((data) => { if (!destroyed) start(data); }, (e) => {
    console.error(e);
    if (!destroyed) page.replaceChildren(el('section.empty', null, el('h1', { tabindex: '-1' }, 'Chưa tải được đề thi'), el('p', null, 'Em thử tải lại trang nhé.'), el('a.btn', { href: '#/exam' }, 'Về Thi thử')));
  });

  function start(data) {
    if (mode === 'unit' && !unit) { unitPicker(); return; }
    const cur = loadCurrent(storage);
    if (cur && cur.mode === mode && (mode !== 'unit' || cur.unitId === unitId)) { run(cur, data); return; }
    intro(data, cur);
  }

  function unitPicker() {
    page.replaceChildren(
      el('header.page-head', null, el('p.eyebrow', null, '📚 Thi thử theo chương'), el('h1', { tabindex: '-1' }, 'Em muốn kiểm tra chương nào?'),
        el('p.lead', null, `${MODES.unit.size} câu, ${MODES.unit.minutes} phút, rải đều các bài trong chương.`)),
      el('div.exam-unit-list', null, course.units.map((u, i) => el('a.exam-unit-card', { href: `#/exam/unit/${u.id}`, style: { '--unit': unitColorVar(u) } },
        el('span.exam-unit-icon', { 'aria-hidden': 'true' }, u.icon),
        el('span', null, el('small', null, `Chương ${i + 1}`), el('strong', null, u.title)),
        el('span.xh-go', { 'aria-hidden': 'true' }, '›')))),
      el('p', null, el('a', { href: '#/exam' }, '← Về Thi thử')));
    page.querySelector('h1').focus();
  }

  function intro(data, other) {
    const preview = generateExam({ course, bank: data.bank, mode, unitId, seed: 'preview' });
    const counts = {};
    for (const q of preview) counts[q.unitId] = (counts[q.unitId] || 0) + 1;
    const nVisual = preview.filter((q) => { const s = data.index.get(q.id)?.step; return s && (s.type === 'hotspot' || s.type === 'sim-predict' || s.visual); }).length;
    const startBtn = el('button.btn.primary.lg', { type: 'button' }, '▶ Bắt đầu làm bài');
    const card = el('section.exam-intro', { 'aria-labelledby': 'xi-h' },
      el('div.exam-intro-badge', { 'aria-hidden': 'true' }, m.icon),
      el('p.eyebrow', null, 'Thi thử'),
      el('h1#xi-h', { tabindex: '-1' }, title),
      el('p.exam-intro-meta', null, el('span.pill', null, `📋 ${preview.length} câu`), el('span.pill', null, `⏱ ${m.minutes} phút`), nVisual ? el('span.pill', null, `🖼 khoảng ${nVisual} câu có hình/mô phỏng`) : null),
      el('ul.exam-rules', null,
        rule('⏱', 'Đồng hồ đếm ngược. Hết giờ, bài tự được nộp.'),
        rule('🙈', 'Chưa hiện đúng/sai khi làm. Đáp án và giải thích hiện sau khi nộp.'),
        rule('🚩', 'Câu nào phân vân thì bấm "Đánh dấu xem lại" và quay lại sau bằng bảng câu hỏi.'),
        rule('💾', 'Lỡ tải lại trang cũng không mất bài: bài làm được lưu trên máy này.')),
      mode === 'unit' ? null : el('div.exam-cover', null, el('p.ex-sub', null, 'Đề rải đều các chương, ví dụ:'),
        el('div.exam-cover-chips', null, Object.entries(counts).map(([u, c]) => { const ui = unitInfo(course, u); return el('span.tag', { title: ui.title }, `${ui.icon} ${ui.short} × ${c}`); }))),
      other ? el('p.exam-conflict', { role: 'note' }, '⏳ Em đang có một bài làm dở (', el('a', { href: other.mode === 'defense' ? '#/exam/defense' : modeHref(other.mode, other.unitId) }, modeName(course, other)), '). Bắt đầu đề này sẽ bỏ bài đó.') : null,
      el('div.complete-actions', null, startBtn, el('a.btn.lg', { href: '#/exam' }, 'Để sau')));
    page.replaceChildren(card);
    card.querySelector('h1').focus();
    startBtn.addEventListener('click', async () => {
      if (other && !(await confirmDialog(`Bỏ bài đang làm dở (${modeName(course, other)}) để bắt đầu đề mới?`, { ok: 'Bỏ và bắt đầu', cancel: 'Huỷ', danger: true }))) return;
      const now = Date.now();
      const id = newAttemptId(now);
      const qs = generateExam({ course, bank: data.bank, mode, unitId, seed: id });
      const a = { v: 1, id, mode, unitId: mode === 'unit' ? unitId : null, seed: id, startedAt: now, limitSec: m.minutes * 60,
        deadline: now + m.minutes * 60 * 1000, qs, ans: {}, flags: [], cur: 0 };
      saveCurrent(storage, a);
      run(a, data);
    });
  }

  function run(a, data) {
    a.qs = a.qs.filter((q) => data.index.has(q.id)); // content renamed since: drop instead of crashing
    if (!a.qs.length) { clearCurrent(storage); intro(data, null); return; }
    a.cur = Math.min(a.cur, a.qs.length - 1);
    const N = a.qs.length;
    const reduced = prefersReducedMotion();
    const flags = new Set(a.flags);
    let ex = null;
    let submitting = false;
    let confirmAbort = null; // set while the "Nộp bài?" dialog is open
    const persist = () => { a.flags = [...flags]; saveCurrent(storage, a); };

    // ---- top bar ----
    const clock = el('span.exam-clock-v', null, '--:--');
    const clockBox = el('div.exam-clock', { role: 'timer', 'aria-label': 'Thời gian còn lại' }, el('span', { 'aria-hidden': 'true' }, '⏱'), clock);
    const timeFill = el('div');
    const counter = el('span.exam-count');
    const navToggle = el('button.btn.sm.exam-nav-toggle', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'exam-nav' });
    const submitTop = el('button.btn.sm.primary', { type: 'button', onclick: () => submit(false) }, 'Nộp bài');
    const bar = el('div.exam-bar', null,
      el('div.exam-bar-inner', null, el('span.exam-bar-title', null, `${m.icon} ${modeName(course, a)}`), clockBox, counter, navToggle, submitTop),
      el('div.exam-timebar', { 'aria-hidden': 'true' }, timeFill));

    // ---- navigator ----
    const grid = el('div.exam-grid', { role: 'list' });
    const navBtns = a.qs.map((q, i) => {
      const b = el('button.exam-cell', { type: 'button', onclick: () => { go(i); closeNavMobile(); } }, String(i + 1));
      grid.append(el('div', { role: 'listitem' }, b));
      return b;
    });
    const navStats = el('p.exam-nav-stats', { 'aria-live': 'polite' });
    const nav = el('aside#exam-nav.exam-nav', { 'aria-label': 'Bảng câu hỏi' },
      el('h2', null, 'Bảng câu hỏi'),
      el('ul.exam-legend', { 'aria-label': 'Chú thích' },
        el('li', null, el('span.exam-cell.sample.answered', { 'aria-hidden': 'true' }, ''), 'Đã làm'),
        el('li', null, el('span.exam-cell.sample', { 'aria-hidden': 'true' }, ''), 'Chưa làm'),
        el('li', null, el('span.exam-cell.sample.flagged', { 'aria-hidden': 'true' }, ''), 'Đánh dấu')),
      grid, navStats,
      el('button.btn.primary.exam-nav-submit', { type: 'button', onclick: () => submit(false) }, '✓ Nộp bài'));
    navToggle.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open); navToggle.setAttribute('aria-expanded', String(open));
      if (open) navBtns[a.cur].focus();
    });
    const closeNavMobile = () => { nav.classList.remove('open'); navToggle.setAttribute('aria-expanded', 'false'); };

    // ---- question area ----
    const qTitle = el('h1.exam-qtitle', { tabindex: '-1' });
    const qUnit = el('span.tag.exam-qunit');
    const flagBtn = el('button.btn.sm.exam-flag', { type: 'button', 'aria-pressed': 'false', onclick: () => {
      const id = a.qs[a.cur].id;
      if (flags.has(id)) flags.delete(id); else flags.add(id);
      persist(); paint();
      announce(flags.has(id) ? 'Đã đánh dấu câu này để xem lại' : 'Đã bỏ đánh dấu');
    } });
    const stage = el('div.exam-stage');
    const prevBtn = el('button.btn.lg', { type: 'button', onclick: () => go(a.cur - 1) }, '← Câu trước');
    const nextBtn = el('button.btn.primary.lg', { type: 'button' });
    const main = el('section.exam-main', { 'aria-labelledby': 'exam-qtitle' },
      el('div.exam-qhead', null, el('div', null, qTitle, qUnit), flagBtn),
      stage,
      el('div.exam-qnav', null, prevBtn, nextBtn));
    qTitle.id = 'exam-qtitle';
    page.replaceChildren(bar, el('div.exam-layout', null, main, nav));

    function paint() {
      const answered = a.qs.filter((q) => a.ans[q.id] !== undefined).length;
      a.qs.forEach((q, i) => {
        const b = navBtns[i];
        const isA = a.ans[q.id] !== undefined, isF = flags.has(q.id), isC = i === a.cur;
        b.className = 'exam-cell' + (isA ? ' answered' : '') + (isF ? ' flagged' : '') + (isC ? ' current' : '');
        b.setAttribute('aria-label', `Câu ${i + 1}${isA ? ', đã làm' : ', chưa làm'}${isF ? ', đã đánh dấu' : ''}${isC ? ', đang xem' : ''}`);
        if (isC) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      counter.textContent = `Câu ${a.cur + 1}/${N}`;
      navToggle.textContent = `☰ ${answered}/${N}`;
      navToggle.setAttribute('aria-label', `Bảng câu hỏi: đã làm ${answered} trên ${N} câu`);
      navStats.textContent = `Đã làm ${answered}/${N} · Đánh dấu ${flags.size}`;
      const f = flags.has(a.qs[a.cur].id);
      flagBtn.setAttribute('aria-pressed', String(f));
      flagBtn.classList.toggle('on', f);
      flagBtn.textContent = f ? '🚩 Đã đánh dấu' : '🏳️ Đánh dấu xem lại';
      prevBtn.disabled = a.cur === 0;
      if (a.cur === N - 1) { nextBtn.textContent = '✓ Nộp bài'; nextBtn.onclick = () => submit(false); }
      else { nextBtn.textContent = 'Câu tiếp →'; nextBtn.onclick = () => go(a.cur + 1); }
    }

    function show(i, focus = true) {
      if (ex) { ex.destroy(); ex = null; }
      a.cur = i;
      const q = a.qs[i];
      const item = data.index.get(q.id);
      const ui = unitInfo(course, q.unitId);
      qTitle.textContent = `Câu ${i + 1}`;
      qUnit.textContent = `${ui.icon} ${ui.label}`;
      ex = createExercise(item.step, {
        mode: 'exam', reducedMotion: reduced, uid: `xq${i}-${a.id}`,
        onAnswer: (v) => {
          if (v === null || v === undefined) delete a.ans[q.id]; else a.ans[q.id] = v;
          persist(); paint();
        },
      });
      stage.replaceChildren(ex.el);
      ex.el.setAttribute('aria-label', `Câu ${i + 1}: ${TYPE_LABEL[item.step.type] || 'Bài tập'}`);
      const saved = a.ans[q.id];
      if (saved !== undefined && isAnswerShape(item.step, saved)) ex.setAnswer(saved);
      persist(); paint();
      if (focus) qTitle.focus({ preventScroll: true });
    }
    function go(i) {
      if (i < 0 || i >= N) return;
      show(i);
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      announce(`Câu ${i + 1} trên ${N}`);
    }

    // ---- timer ----
    let warned5 = false, warned1 = false;
    function tick() {
      const left = secondsLeft(a);
      clock.textContent = fmtClock(left);
      const frac = Math.max(0, Math.min(1, left / a.limitSec));
      timeFill.style.width = `${frac * 100}%`;
      clockBox.classList.toggle('warn', left <= 300 && left > 60);
      clockBox.classList.toggle('danger', left <= 60);
      clockBox.setAttribute('aria-label', `Thời gian còn lại ${Math.floor(Math.max(0, left) / 60)} phút ${Math.max(0, left) % 60} giây`);
      if (left <= 300 && !warned5 && a.limitSec > 300) { warned5 = true; announce('Còn 5 phút'); toast('⏱ Còn 5 phút. Kiểm tra lại các câu đã đánh dấu nhé!'); }
      if (left <= 60 && !warned1) { warned1 = true; announce('Còn 1 phút'); toast('⏱ Còn 1 phút!'); }
      if (left <= 0) submit(true);
    }
    const timer = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => { if (confirmAbort) confirmAbort.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', onVis); if (ex) ex.destroy(); });

    async function submit(auto) {
      if (submitting) return;
      if (auto && confirmAbort) confirmAbort.abort(); // time is up: close the confirm dialog and submit now
      if (!auto) {
        if (confirmAbort) return;
        const answered = a.qs.filter((q) => a.ans[q.id] !== undefined).length;
        const missing = N - answered;
        const msg = `Em đã làm ${answered}/${N} câu.${missing ? ` Còn ${missing} câu chưa làm (tính là sai).` : ''}${flags.size ? ` Có ${flags.size} câu đánh dấu xem lại.` : ''} Nộp bài bây giờ?`;
        const ctl = new AbortController();
        confirmAbort = ctl;
        const ok = await confirmDialog(msg, { ok: 'Nộp bài', cancel: 'Làm tiếp', signal: ctl.signal });
        if (confirmAbort === ctl) confirmAbort = null;
        if (!ok || destroyed || submitting) return;
        if (secondsLeft(a) <= 0) auto = true;
      }
      submitting = true;
      const res = scoreAttempt(a, data.index);
      const at = Date.now();
      const d = Math.min(a.limitSec, Math.max(1, Math.round((at - a.startedAt) / 1000)));
      persist();
      saveDetail(storage, { id: a.id, mode: a.mode, unitId: a.unitId, at, d, limitSec: a.limitSec, qs: a.qs, ans: a.ans, flags: [...flags], ok: res.ok, auto: !!auto });
      store.recordExam(a.id, { m: a.mode, at, s: res.c, n: res.n, d, u: res.perUnit, uu: a.unitId || undefined });
      store.flush();
      clearCurrent(storage);
      if (auto) toast('⏰ Hết giờ! Bài đã được nộp tự động.', 4000);
      location.hash = `#/exam/result/${a.id}`;
    }

    show(a.cur, true);
    tick();
  }

  return {
    title,
    destroy() { destroyed = true; cleanups.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
  };
}

function rule(icon, text) {
  return el('li', null, el('span.exam-rule-icon', { 'aria-hidden': 'true' }, icon), el('span', null, text));
}
