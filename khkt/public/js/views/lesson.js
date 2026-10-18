// Lesson player: one step card at a time, segmented progress, sticky action bar, feedback, completion.
import { el } from '../util.js';
import { renderStep } from '../render/steps.js';
import { findUnit, findLesson, unitColorVar, unitIndex } from './_ui.js';
import { GRADED } from '../progress/store.js';
import { prefersReducedMotion, announce } from '../a11y.js';
import { blocks } from '../render/markdown.js';
import * as notfound from './notfound.js';

export function render(root, { unitId, lessonId }, ctx) {
  const { course, store } = ctx;
  const unit = findUnit(course, unitId);
  const lesson = findLesson(unit, lessonId);
  if (!unit || !lesson) return notfound.render(root, {}, ctx);
  const steps = lesson.steps;
  const N = steps.length;
  const reduced = prefersReducedMotion();
  const key = `${unit.id}.${lesson.id}`;
  const saved = store.progress.lessons[key];
  let index = saved && !saved.d ? Math.min(Math.max(0, saved.s || 0), N - 1) : 0;
  let maxSeen = index;
  const segState = new Array(N).fill('');
  for (let i = 0; i < index; i++) segState[i] = 'done';
  let current = null;
  let unsub = null;
  let sessionPoints = 0;
  let finished = false;

  const page = el('div.page.lesson', { style: { '--unit': unitColorVar(unit) } });
  const exit = el('a.icon-btn.lesson-exit', { href: `#/unit/${unit.id}`, 'aria-label': 'Thoát bài học' }, '✕');
  const back = el('button.btn.sm.ghost.lesson-back', { type: 'button', onclick: () => go(index - 1) }, '← Bước trước');
  const segs = el('div.segments', { role: 'list', 'aria-label': 'Các bước của bài' });
  const counter = el('span.step-counter', { 'aria-live': 'polite' });
  const top = el('div.lesson-top', null, exit, segs, counter);
  const titleRow = el('div.lesson-title-row', null,
    el('p.eyebrow', null, `${unit.icon} Chương ${unitIndex(course, unit)} · ${unit.title}`),
    el('h1.lesson-h1', { tabindex: '-1' }, lesson.title),
    lesson.goal && index === 0 ? el('p.lesson-goal-banner', null, '🎯 ', lesson.goal) : null);
  const stage = el('div.step-stage');
  const feedback = el('div.feedback', { role: 'status', 'aria-live': 'polite', hidden: true });
  const hintBtn = el('button.btn.ghost', { type: 'button', hidden: true, onclick: () => current?.exercise?.showHint() }, '💡 Gợi ý');
  const revealBtn = el('button.btn.ghost', { type: 'button', hidden: true, onclick: () => current?.exercise?.reveal() }, 'Xem đáp án');
  const skipBtn = el('button.btn.ghost', { type: 'button', hidden: true, onclick: () => next() }, 'Bỏ qua →');
  const primary = el('button.btn.primary.lg.action-primary', { type: 'button' }, 'Tiếp tục');
  const bar = el('div.action-bar', null, el('div.action-inner', null, el('div.action-left', null, back, hintBtn), el('div.action-right', null, revealBtn, skipBtn, primary)));
  page.append(top, titleRow, stage, feedback, bar);
  root.append(page);

  for (let i = 0; i < N; i++) {
    segs.append(el('button.seg', { type: 'button', role: 'listitem', 'aria-label': `Bước ${i + 1}`, onclick: () => { if (i <= maxSeen) go(i); } }));
  }
  function paintSegs() {
    [...segs.children].forEach((s, i) => {
      s.className = 'seg' + (segState[i] ? ` ${segState[i]}` : '') + (i === index && !finished ? ' current' : '') + (i <= maxSeen ? ' reachable' : '');
      s.disabled = i > maxSeen;
      const st = { done: 'đã xem', correct: 'làm đúng', revealed: 'đã xem đáp án', wrong: 'chưa đúng' }[segState[i]];
      s.setAttribute('aria-label', `Bước ${i + 1}${st ? ', ' + st : ''}${i === index ? ', đang xem' : ''}`);
      if (i === index) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
    counter.textContent = finished ? 'Hoàn thành' : `Bước ${index + 1}/${N}`;
  }

  function setFeedback(fb, ex) {
    if (!fb) { feedback.hidden = true; feedback.className = 'feedback'; feedback.replaceChildren(); return; }
    feedback.hidden = false;
    feedback.className = `feedback ${fb.kind}${reduced ? '' : ' slide-up'}`;
    const pts = fb.points ? el('span.fb-points', null, `+${fb.points} ⚡`) : null;
    feedback.replaceChildren(el('div.fb-inner', null, el('strong.fb-title', null, fb.title), pts, fb.text ? el('p', null, fb.text) : null));
    if (fb.kind === 'success' && ex && ex.step.explanation && !ex.el.querySelector('.ex-explain:not([hidden])')) {
      feedback.querySelector('.fb-inner').append(el('div', { html: blocks(ex.step.explanation) }));
    }
  }

  function updateBar() {
    const ex = current && current.exercise;
    hintBtn.hidden = true; revealBtn.hidden = true; skipBtn.hidden = true;
    back.disabled = index === 0;
    primary.disabled = false;
    if (!ex || !ex.state.graded) {
      primary.textContent = index === N - 1 ? 'Hoàn thành ✓' : 'Tiếp tục';
      primary.onclick = () => next();
      if (ex) {
        // flashcard: rating is optional, but mark segment when rated.
        if (ex.state.phase === 'done') segState[index] = 'done';
      }
      setFeedback(null);
      return;
    }
    const st = ex.state;
    hintBtn.hidden = !(st.hasHint && !st.hintShown && st.phase !== 'done');
    if (st.phase === 'answer') {
      primary.textContent = 'Kiểm tra';
      primary.disabled = !st.ready;
      primary.onclick = () => ex.check();
      skipBtn.hidden = !(segState[index] || index < maxSeen || st.broken);
      setFeedback(null);
    } else if (st.phase === 'wrong') {
      primary.textContent = 'Thử lại';
      primary.onclick = () => ex.retry();
      revealBtn.hidden = !st.canReveal;
      skipBtn.hidden = false;
      skipBtn.textContent = 'Tiếp tục →';
      setFeedback(st.feedback, ex);
    } else {
      primary.textContent = index === N - 1 ? 'Hoàn thành ✓' : 'Tiếp tục';
      primary.onclick = () => next();
      setFeedback(st.feedback, ex);
    }
    if (st.phase !== 'wrong') skipBtn.textContent = 'Bỏ qua →';
  }

  function show(i, dir = 1) {
    if (unsub) { unsub(); unsub = null; }
    if (current) current.destroy();
    index = i;
    maxSeen = Math.max(maxSeen, i);
    const step = steps[i];
    current = renderStep(step, { store, reducedMotion: reduced });
    if (!reduced) current.el.classList.add(dir >= 0 ? 'enter-right' : 'enter-left');
    stage.replaceChildren(current.el);
    const goal = titleRow.querySelector('.lesson-goal-banner');
    if (goal) goal.hidden = i !== 0;
    if (current.exercise) {
      const ex = current.exercise;
      let lastPhase = ex.state.phase;
      unsub = ex.onUpdate((st) => {
        if (st.phase !== lastPhase) {
          if (st.phase === 'done' && st.graded) {
            segState[index] = st.revealed ? 'revealed' : 'correct';
          } else if (st.phase === 'wrong') segState[index] = 'wrong';
          lastPhase = st.phase;
          paintSegs();
          if (st.phase !== 'answer') primary.focus({ preventScroll: true });
        }
        updateBar();
      });
    } else segState[i] = segState[i] || 'done';
    store.visitStep(unit.id, lesson.id, i);
    paintSegs();
    updateBar();
    announce(`Bước ${i + 1} trên ${N}`);
  }

  function go(i) {
    if (i < 0 || i >= N || i > maxSeen) return;
    show(i, i < index ? -1 : 1);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
  function next() {
    const ex = current && current.exercise;
    if (ex && ex.state.graded && ex.state.phase !== 'done' && !segState[index]) segState[index] = 'wrong';
    if (!segState[index]) segState[index] = 'done';
    if (index < N - 1) { maxSeen = Math.max(maxSeen, index + 1); go(index + 1); return; }
    finish();
  }

  function finish() {
    if (unsub) { unsub(); unsub = null; }
    if (current) { current.destroy(); current = null; }
    const bonus = store.completeLesson(unit.id, lesson.id);
    finished = true;
    paintSegs();
    const after = store.points;
    sessionPoints = Math.max(0, after - startPoints);
    const status = store.lessonStatus(unit, lesson);
    const graded = steps.filter((s) => GRADED.has(s.type));
    const missing = graded.filter((s) => !(store.progress.ex[s.id] && store.progress.ex[s.id].c)).length;
    const nxt = nextLesson();
    bar.hidden = true; feedback.hidden = true;
    stage.replaceChildren(el('section.complete', { 'aria-labelledby': 'done-h' },
      reduced ? null : confetti(),
      el('div.complete-badge', { 'aria-hidden': 'true' }, status === 'mastered' ? '★' : '✓'),
      el('h2#done-h', { tabindex: '-1' }, 'Hoàn thành bài!'),
      el('p.complete-points', null, el('span', { 'aria-hidden': 'true' }, '⚡ '), `+${sessionPoints} điểm năng lượng trong lần học này`, bonus ? ` (gồm ${bonus} điểm thưởng hoàn thành)` : ''),
      el('p.complete-status', { class: `st-${status}` }, status === 'mastered'
        ? '★ Thành thạo: em đã làm đúng mọi bài tập của bài này.'
        : `◐ Đang học: còn ${missing} bài tập chưa đúng. Ôn lại để đạt "Thành thạo" nhé.`),
      el('div.complete-actions', null,
        nxt ? el('a.btn.primary.lg', { href: `#/unit/${nxt.u.id}/lesson/${nxt.l.id}` }, 'Bài tiếp theo →') : el('a.btn.primary.lg', { href: '#/practice' }, '🎤 Luyện phản biện'),
        el('a.btn.lg', { href: `#/unit/${unit.id}` }, 'Về chương'),
        status !== 'mastered' ? el('button.btn.lg.ghost', { type: 'button', onclick: () => { finished = false; bar.hidden = false; segState.fill(''); maxSeen = 0; show(0); } }, '↺ Học lại') : null)));
    stage.querySelector('#done-h').focus();
    announce('Hoàn thành bài!');
  }
  function nextLesson() {
    const li = unit.lessons.indexOf(lesson);
    if (li < unit.lessons.length - 1) return { u: unit, l: unit.lessons[li + 1] };
    const ui = course.units.indexOf(unit);
    for (let k = ui + 1; k < course.units.length; k++) if (course.units[k].lessons.length) return { u: course.units[k], l: course.units[k].lessons[0] };
    return null;
  }

  function onKey(e) {
    if (e.key !== 'Enter' || e.defaultPrevented || finished) return;
    const t = e.target;
    const tag = (t.tagName || '').toLowerCase();
    if (['button', 'a', 'select', 'textarea', 'summary'].includes(tag) || t.getAttribute?.('role') === 'button') return;
    if (tag === 'input' && t.type === 'text' && !t.classList.contains('num-input')) return;
    if (!primary.disabled && !bar.hidden) { e.preventDefault(); primary.click(); }
  }
  document.addEventListener('keydown', onKey);

  const startPoints = store.points;
  show(index);
  return {
    title: lesson.title,
    destroy() {
      document.removeEventListener('keydown', onKey);
      if (unsub) unsub();
      if (current) current.destroy();
    },
  };
}

function confetti() {
  const box = el('div.confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < 24; i++) box.append(el('i', { style: { '--i': i, '--x': `${(i * 37) % 100}%`, '--d': `${(i % 6) * 0.08}s` } }));
  return box;
}

