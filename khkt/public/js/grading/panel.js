// Reusable "chấm bằng AI" panel: answer textarea (+ optional vi-VN dictation), grade button, loading state,
// score ring 0–10, ✓/✗ key points, factual errors, feedback, improved answer, friendly errors.
// Used by the /question page, lesson flashcards (exercises/flashcard.js) and Phản biện thử (exam-defense.js).
import { el, svgNode } from '../util.js';
import { inline, blocks } from '../render/markdown.js';
import { announce } from '../a11y.js';
import { gradeAnswer, GradeError, checkAnswer, errorMessage, fmtScore, scoreBand, bandLabel, MAX_CHARS, MIN_CHARS } from './api.js';
import { micButton } from './speech.js';
import { icon } from '../icons.js';

let seq = 0;

/** SVG score ring, 0–10. */
export function scoreRing(score, size = 92) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, score / 10));
  const band = scoreBand(score);
  return svgNode(`<svg class="gr-ring ${band}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gr-ring-bg" stroke-width="10" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="gr-ring-fg" stroke-width="10" fill="none" stroke-linecap="round"
      stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="47%" dy="0.35em" text-anchor="middle" font-size="${Math.round(size / 3.4)}" font-weight="700" class="gr-ring-t">${fmtScore(score)}</text>
    <text x="50%" y="72%" text-anchor="middle" font-size="${Math.round(size / 8.5)}" class="gr-ring-s">/ 10</text></svg>`);
}

/** Small "AI 8,5" badge for lists. */
export function scoreBadge(best) {
  return el('span.gr-badge', { class: scoreBand(best), title: `Điểm AI tốt nhất: ${fmtScore(best)}/10` }, el('span.gr-badge-k', { 'aria-hidden': 'true' }, 'AI'), fmtScore(best), el('span.sr-only', null, ' trên 10 điểm AI'));
}

/** Result block (also used read-only). */
export function renderResult(res, { best = null, improvedNow = false } = {}) {
  const head = el('div.gr-top', null, scoreRing(res.score),
    el('div.gr-top-t', null,
      el('p.gr-score', null, el('strong', null, `${fmtScore(res.score)}/10`), el('span.sr-only', null, ' điểm')),
      el('p.gr-band', null, bandLabel(res.score)),
      best !== null ? el('p.gr-best', null, improvedNow && res.score >= best ? 'Điểm AI tốt nhất mới của em!' : `Điểm AI tốt nhất: ${fmtScore(best)}/10`) : null));
  const ok = res.points.filter((p) => p.ok).length;
  const points = res.points.length ? el('div.gr-sec', null,
    el('h4.gr-h', null, `Ý chính: nói được ${ok}/${res.points.length}`),
    el('ul.gr-points', null, res.points.map((p) => el('li', { class: p.ok ? 'ok' : 'miss' },
      el('span.gr-pi', { 'aria-hidden': 'true' }, p.ok ? '✓' : '✗'), el('span', { html: inline(p.text) }),
      el('span.sr-only', null, p.ok ? ' (đã nói được)' : ' (còn thiếu)'))))) : null;
  const extra = res.extraMissing.length ? el('div.gr-sec', null, el('h4.gr-h', null, 'Nên nói thêm'),
    el('ul.gr-list', null, res.extraMissing.map((m) => el('li', { html: inline(m) })))) : null;
  const errors = res.errors.length ? el('div.gr-sec.gr-errors', { role: 'note' }, el('h4.gr-h', null, icon('alert', 16), 'Chưa đúng với dự án'),
    el('ul.gr-list', null, res.errors.map((m) => el('li', { html: inline(m) })))) : null;
  const fb = res.feedback ? el('div.gr-sec', null, el('h4.gr-h', null, 'Nhận xét'), el('div.gr-fb', { html: blocks(res.feedback) })) : null;
  const imp = res.improved ? el('details.gr-improved', null, el('summary', null, icon('chevron-right', 16, 'gr-sum-chev'), 'Câu trả lời gợi ý tốt hơn'), el('div', { html: blocks(res.improved) })) : null;
  const fbNote = res.fallback ? el('p.gr-fallback', { role: 'note' }, 'Máy chấm chính đang bận nên máy dự phòng đã chấm. Điểm này chỉ để tham khảo, không lưu làm điểm tốt nhất.') : null;
  return el('div.gr-res', null, head, fbNote, points, errors, extra, fb, imp);
}

/**
 * createGrader(question, opts)
 *   question: { id, keyPoints[] }  (a flashcard step or a defense-index item)
 *   opts: { store, text, maxLength, onText(v), onResult(res, saved), autofocus, heading, compact, placeholder }
 * → { el, getText(), setText(v), focus(), grade(), destroy() }
 */
export function createGrader(question, opts = {}) {
  const { store = null, onText, onResult, heading = null, compact = false } = opts;
  const maxLength = Math.min(opts.maxLength || MAX_CHARS, MAX_CHARS);
  const keyPoints = Array.isArray(question.keyPoints) ? question.keyPoints : [];
  const uid = `gr-${++seq}`;
  let ctl = null;
  let destroyed = false;

  const ta = el('textarea.text-input.gr-ta', {
    id: `${uid}-ta`, rows: compact ? 3 : 4, maxlength: maxLength, spellcheck: 'true', lang: 'vi',
    placeholder: opts.placeholder || 'Gõ (hoặc đọc) câu trả lời như đang nói với giám khảo: ý chính → dẫn chứng (con số, tên hàm) → giới hạn…',
    'aria-describedby': `${uid}-cnt`,
  });
  ta.value = (opts.text || '').slice(0, maxLength);
  const cnt = el('span.gr-count', { id: `${uid}-cnt` });
  const paintCount = () => { cnt.textContent = `${ta.value.length}/${maxLength} ký tự`; };
  ta.addEventListener('input', () => { paintCount(); if (onText) onText(ta.value); });
  paintCount();
  const mic = micButton(ta);

  const btn = el('button.btn.primary.gr-go', { type: 'button' }, icon('sparkles', 18), el('span', null, 'Chấm bằng AI'));
  const best0 = store && store.grade ? store.grade(question.id) : null;
  const bestLine = el('span.gr-bestline', { hidden: !best0 }, best0 ? `Điểm AI tốt nhất: ${fmtScore(best0.best)}/10` : '');
  const status = el('div.gr-status', { role: 'status', 'aria-live': 'polite' });
  const result = el('div.gr-result', { hidden: true, tabindex: '-1', 'aria-label': 'Kết quả chấm AI' });

  const root = el('section.grader' + (compact ? '.compact' : ''), { 'aria-label': 'Tự trả lời và chấm bằng AI' },
    heading ? el('div.fc-label', null, heading) : null,
    el('label.gr-label', { for: ta.id }, 'Câu trả lời của em'),
    ta,
    el('div.gr-tools', null, mic ? mic.el : null, cnt),
    el('div.gr-actions', null, btn, bestLine),
    status, result,
    el('p.gr-note', null, 'AI chấm để em tham khảo, có thể nhầm: luôn đối chiếu với câu trả lời mẫu. Chỉ câu trả lời được gửi đi, không gửi mã học tập.'));

  function setBusy(b) {
    btn.disabled = b;
    root.setAttribute('aria-busy', String(b));
    btn.lastChild.textContent = b ? 'Đang chấm…' : 'Chấm bằng AI';
  }
  function showError(msg) {
    status.className = 'gr-status err';
    status.replaceChildren(icon('alert', 18), el('span', null, msg));
  }

  async function grade() {
    if (ctl) return;
    if (mic) mic.stop();
    const answer = ta.value;
    const bad = checkAnswer(answer);
    if (bad) { showError(errorMessage(bad)); if (bad === 'short') ta.focus(); return; }
    ctl = new AbortController();
    setBusy(true);
    status.className = 'gr-status loading';
    status.replaceChildren(el('span.spinner', { 'aria-hidden': 'true' }), ' AI đang đọc câu trả lời của em… (thường mất 5–15 giây)');
    try {
      const res = await gradeAnswer({ id: question.id, answer, keyPoints, signal: ctl.signal });
      if (destroyed) return;
      // A backup-model grade is shown but never saved as the best score (it is more lenient).
      const saved = store && store.recordGrade && !res.fallback ? store.recordGrade(question.id, res.score) : null;
      status.className = 'gr-status';
      status.replaceChildren();
      result.hidden = false;
      result.replaceChildren(renderResult(res, { best: saved ? saved.best : null, improvedNow: !!(saved && saved.improved) }));
      if (saved) { bestLine.hidden = false; bestLine.textContent = `Điểm AI tốt nhất: ${fmtScore(saved.best)}/10`; }
      announce(`AI chấm ${fmtScore(res.score)} trên 10. Nói được ${res.covered.length} trên ${keyPoints.length} ý chính.`);
      result.focus({ preventScroll: false });
      if (onResult) onResult(res, saved);
    } catch (e) {
      if (destroyed || (e instanceof GradeError && e.kind === 'aborted')) return;
      showError(e instanceof GradeError ? e.message : errorMessage('bad'));
    } finally {
      ctl = null;
      if (!destroyed) setBusy(false);
    }
  }
  btn.addEventListener('click', grade);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); grade(); } });

  return {
    el: root,
    getText: () => ta.value,
    setText(v) { ta.value = String(v || '').slice(0, maxLength); paintCount(); },
    focus() { ta.focus(); },
    grade,
    destroy() { destroyed = true; if (ctl) ctl.abort(); if (mic) mic.destroy(); },
  };
}

export { MIN_CHARS, MAX_CHARS };
