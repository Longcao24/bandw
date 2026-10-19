// Tiny pure text helpers shared by the grading UI, the /question page and content/defense-index.js.

/** Lower-case, strip Vietnamese diacritics (đ → d), drop markdown marks, collapse spaces. */
export function fold(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[*_`"“”‘’]/g, ' ').replace(/\s+/g, ' ').trim();
}
