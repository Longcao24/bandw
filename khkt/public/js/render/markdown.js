// markdown-lite (spec §4.2). Escape everything first, then apply a tiny set of rules.
import { escapeHtml } from '../util.js';

let GLOSSARY = new Map(); // lowercased term → {term, en, def, unit}
export function setGlossary(map) { GLOSSARY = map; }
export function buildGlossary(course) {
  const m = new Map();
  for (const u of course.units) for (const g of u.glossary || []) {
    const k = g.term.toLocaleLowerCase('vi');
    if (!m.has(k)) m.set(k, { ...g, unit: u.id });
  }
  return m;
}
export const lookupTerm = (t) => GLOSSARY.get(String(t).toLocaleLowerCase('vi')) || null;

/** All [[terms]] referenced in a markdown string. */
export function extractTerms(text) {
  const out = [];
  const noCode = String(text || '').replace(/`[^`]*`/g, '');
  for (const m of noCode.matchAll(/\[\[([^\]]+)\]\]/g)) out.push(m[1].trim());
  return out;
}

/** Counts sentences: . ? ! followed by whitespace or end (ignores code spans and decimals like 0.85). */
export function countSentences(text) {
  const s = String(text || '').replace(/`[^`]*`/g, 'x').replace(/^\s*(>!?|-|\d+\.)\s*/gm, '');
  const m = s.match(/[.?!…](?=\s|$)/g);
  return m ? m.length : (s.trim() ? 1 : 0);
}

export function inline(src) {
  const parts = String(src ?? '').split('`');
  let html = '';
  parts.forEach((part, i) => {
    if (i % 2 === 1 && i < parts.length - 1) { html += `<code>${escapeHtml(part)}</code>`; return; }
    if (i % 2 === 1) part = '`' + part; // unmatched backtick
    let h = escapeHtml(part);
    h = h.replace(/\[\[([^\]]+)\]\]/g, (_, t) => {
      const term = t.trim();
      const g = lookupTerm(term);
      if (!g) return term;
      return `<button type="button" class="term" data-term="${escapeHtml(term)}" aria-haspopup="dialog">${term}</button>`;
    });
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    html += h;
  });
  return html;
}

export function blocks(src) {
  const chunks = String(src ?? '').replace(/\r/g, '').split(/\n\s*\n/);
  const out = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      out.push('<ul>' + lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('') + '</ul>');
    } else if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      out.push('<ol>' + lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('') + '</ol>');
    } else if (lines.every((l) => /^\s*>!/.test(l))) {
      out.push(`<div class="callout warn" role="note"><span class="callout-icon" aria-hidden="true">⚠️</span><p>${inline(lines.map((l) => l.replace(/^\s*>!\s?/, '')).join(' '))}</p></div>`);
    } else if (lines.every((l) => /^\s*>/.test(l))) {
      out.push(`<div class="callout info" role="note"><span class="callout-icon" aria-hidden="true">💡</span><p>${inline(lines.map((l) => l.replace(/^\s*>\s?/, '')).join(' '))}</p></div>`);
    } else {
      out.push(`<p>${inline(lines.join(' '))}</p>`);
    }
  }
  return out.join('');
}
