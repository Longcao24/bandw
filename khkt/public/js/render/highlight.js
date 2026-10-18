// Tiny cpp/java tokenizer → HTML spans (no third-party code).
import { escapeHtml } from '../util.js';

const KW = {
  cpp: 'if else while for do return break continue switch case default static const constexpr class struct enum public private protected void bool int float double char unsigned long short auto true false nullptr new delete include define pragma inline volatile template typename this sizeof',
  java: 'if else while for do return break continue switch case default static final class interface enum public private protected void boolean int float double char long short new this super null true false try catch finally throw throws import package extends implements instanceof synchronized',
};
const TYPES = 'uint8_t uint16_t uint32_t int16_t int32_t size_t String Gesture GestureDetector Calibrator BLEDevice BLEService BLEStringCharacteristic LSM6DS3 Locale TextToSpeech GestureCommand Override';
const sets = {};
function kwSet(lang) {
  if (!sets[lang]) sets[lang] = new Set((KW[lang] || '').split(' '));
  return sets[lang];
}
const typeSet = new Set(TYPES.split(' '));

const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#\s*\w+)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?f?\b)|([A-Za-z_]\w*)|(\s+)|([^\sA-Za-z_0-9])/g;

/** Returns an array of HTML strings, one per source line. */
export function highlightLines(code, language = 'cpp') {
  if (language === 'text') return String(code).split('\n').map(escapeHtml);
  const kws = kwSet(language === 'java' ? 'java' : 'cpp');
  let html = '';
  for (const m of String(code).matchAll(TOKEN)) {
    const [tok, comment, str, pre, num, ident] = m;
    if (comment) html += wrapMultiline(comment, 'tok-com');
    else if (str) html += `<span class="tok-str">${escapeHtml(str)}</span>`;
    else if (pre) html += `<span class="tok-pre">${escapeHtml(pre)}</span>`;
    else if (num) html += `<span class="tok-num">${num}</span>`;
    else if (ident) {
      if (kws.has(ident)) html += `<span class="tok-kw">${ident}</span>`;
      else if (typeSet.has(ident) || /^[A-Z][A-Z0-9_]{2,}$/.test(ident)) html += `<span class="${/^[A-Z][A-Z0-9_]+$/.test(ident) ? 'tok-const' : 'tok-type'}">${ident}</span>`;
      else if (/^\s*\(/.test(String(code).slice(m.index + ident.length, m.index + ident.length + 2))) html += `<span class="tok-fn">${ident}</span>`;
      else html += ident;
    } else html += escapeHtml(tok);
  }
  return html.split('\n');
}
function wrapMultiline(text, cls) {
  return text.split('\n').map((l) => `<span class="${cls}">${escapeHtml(l)}</span>`).join('\n');
}
