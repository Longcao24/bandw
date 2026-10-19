// Optional dictation (Web Speech API, vi-VN). Returns null when the browser has no speech recognition, so the
// caller simply shows no microphone button. Final phrases are appended to the textarea; interim text is shown
// in a small live preview. Audio is processed by the browser's speech service, never by our server.
import { el } from '../util.js';
import { announce } from '../a11y.js';

export function speechSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/** micButton(textarea, { onChange }) → { el, stop(), destroy() } | null */
export function micButton(textarea, { onChange } = {}) {
  if (!speechSupported()) return null;
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let on = false;
  const btn = el('button.btn.sm.gr-mic', { type: 'button', 'aria-pressed': 'false' },
    el('span.gr-mic-i', { 'aria-hidden': 'true' }, '🎙️'), el('span.gr-mic-t', null, 'Đọc bằng giọng nói'));
  const preview = el('span.gr-interim', { 'aria-hidden': 'true' });
  const wrap = el('span.gr-mic-wrap', null, btn, preview);

  const paint = () => {
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('rec', on);
    btn.querySelector('.gr-mic-t').textContent = on ? 'Đang nghe… bấm để dừng' : 'Đọc bằng giọng nói';
    if (!on) preview.textContent = '';
  };
  const append = (text) => {
    const t = text.trim();
    if (!t) return;
    const cur = textarea.value.replace(/\s+$/, '');
    const max = Number(textarea.getAttribute('maxlength')) || Infinity;
    textarea.value = (cur ? cur + ' ' : '') + t;
    if (textarea.value.length > max) textarea.value = textarea.value.slice(0, max);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (onChange) onChange(textarea.value);
  };
  function start() {
    try {
      rec = new Rec();
      rec.lang = 'vi-VN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) append(r[0].transcript); else interim += r[0].transcript;
        }
        preview.textContent = interim;
      };
      rec.onerror = (e) => {
        const msg = e && (e.error === 'not-allowed' || e.error === 'service-not-allowed')
          ? 'Trình duyệt chưa cho dùng micro. Em bật quyền micro hoặc gõ câu trả lời nhé.'
          : e && e.error === 'no-speech' ? 'Chưa nghe thấy gì. Em nói to và rõ hơn một chút nhé.' : 'Micro gặp lỗi, em gõ câu trả lời thay nhé.';
        announce(msg);
        btn.title = msg;
      };
      rec.onend = () => { on = false; rec = null; paint(); };
      rec.start();
      on = true; paint();
      announce('Đang nghe. Em nói câu trả lời bằng tiếng Việt.');
    } catch { on = false; rec = null; paint(); }
  }
  function stop() { if (rec) { try { rec.stop(); } catch { /* already stopped */ } } on = false; paint(); }
  btn.addEventListener('click', () => (on ? stop() : start()));
  return { el: wrap, stop, destroy() { if (rec) { try { rec.abort(); } catch { /* ignore */ } } rec = null; on = false; } };
}
