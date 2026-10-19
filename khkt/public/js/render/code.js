// Code block with line numbers, emphasized lines and tappable line-range notes.
import { el } from '../util.js';
import { highlightLines } from './highlight.js';

const LANG_LABEL = { cpp: 'C++', java: 'Java', text: 'Văn bản' };

export function codeBlock({ code, language = 'cpp', highlight = [], notes = [], source }) {
  const lines = highlightLines(code, language);
  const hl = new Set(highlight || []);
  const pre = el('pre.code', { tabindex: '0', 'aria-label': `Mã ${LANG_LABEL[language] || ''}` });
  const codeEl = el('code', { class: `lang-${language}` });
  const noteFor = (n) => (notes || []).find((x) => n >= x.lines[0] && n <= x.lines[1]);
  lines.forEach((html, i) => {
    const n = i + 1;
    const note = noteFor(n);
    const row = el('span.code-line', { 'data-line': n, class: [hl.has(n) ? 'hl' : '', note ? 'has-note' : ''].filter(Boolean).join(' ') || undefined },
      el('span.ln', { 'aria-hidden': 'true' }, String(n)), el('span.lc', { html: html || ' ' }));
    codeEl.append(row);
  });
  pre.append(codeEl);
  const wrap = el('div.code-wrap', null,
    el('div.code-head', null, el('span.code-lang', null, LANG_LABEL[language] || language), source ? el('span.code-src', null, source) : null),
    pre);
  if (notes && notes.length) {
    const pop = el('div.code-note', { role: 'note', 'aria-live': 'polite', hidden: true });
    const btns = el('div.code-note-buttons', { role: 'group', 'aria-label': 'Ghi chú cho các dòng mã' },
      notes.map((nt) => el('button.chip', { type: 'button', onclick: () => {
        for (const r of codeEl.children) {
          const n = Number(r.dataset.line);
          r.classList.toggle('noted', n >= nt.lines[0] && n <= nt.lines[1]);
        }
        pop.hidden = false;
        pop.textContent = nt.note;
      } }, nt.lines[0] === nt.lines[1] ? `Dòng ${nt.lines[0]}` : `Dòng ${nt.lines[0]}–${nt.lines[1]}`)));
    // Tapping a noted line opens its note too.
    codeEl.addEventListener('click', (e) => {
      const row = e.target.closest('.code-line.has-note');
      if (!row) return;
      const nt = noteFor(Number(row.dataset.line));
      const idx = notes.indexOf(nt);
      btns.children[idx]?.click();
    });
    wrap.append(btns, pop);
  }
  return wrap;
}
