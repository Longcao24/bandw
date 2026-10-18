// Glossary A→Z (Vietnamese collation) with English terms and a search box.
import { el } from '../util.js';
import { pageHeader } from './_ui.js';

export function allTerms(course) {
  const seen = new Map();
  for (const u of course.units) for (const g of u.glossary || []) {
    const k = g.term.toLocaleLowerCase('vi');
    if (!seen.has(k)) seen.set(k, { ...g, unit: u });
  }
  return [...seen.values()].sort((a, b) => a.term.localeCompare(b.term, 'vi', { sensitivity: 'base' }));
}

export function render(root, _p, { course }) {
  const terms = allTerms(course);
  const page = el('div.page.narrow.glossary');
  page.append(pageHeader('📖 Thuật ngữ', `${terms.length} thuật ngữ trong giáo trình, xếp theo bảng chữ cái.`));
  const search = el('input.search', { type: 'search', placeholder: 'Tìm thuật ngữ (tiếng Việt hoặc tiếng Anh)…', 'aria-label': 'Tìm thuật ngữ' });
  const list = el('dl.term-list');
  const count = el('p.ex-sub', { 'aria-live': 'polite' });
  const fold = (s) => String(s || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  function draw() {
    const q = fold(search.value.trim());
    list.replaceChildren();
    let letter = '';
    let shown = 0;
    for (const t of terms) {
      if (q && !fold(t.term).includes(q) && !fold(t.en).includes(q) && !fold(t.def).includes(q)) continue;
      shown++;
      const L = fold(t.term)[0]?.toUpperCase() || '#';
      if (L !== letter) { letter = L; list.append(el('div.term-letter', { 'aria-hidden': 'true' }, L)); }
      list.append(el('div.term-item', { id: `term-${encodeURIComponent(t.term)}` },
        el('dt', null, t.term, t.en ? el('span.term-en', null, ` (${t.en})`) : null),
        el('dd', null, t.def, el('a.term-unit', { href: `#/unit/${t.unit.id}` }, ` ${t.unit.icon} ${t.unit.title}`))));
    }
    count.textContent = q ? `${shown} kết quả` : '';
    if (!shown) list.append(el('p', null, terms.length ? 'Không tìm thấy thuật ngữ phù hợp.' : 'Các chương đang được soạn, thuật ngữ sẽ xuất hiện ở đây.'));
  }
  search.addEventListener('input', draw);
  page.append(search, count, list);
  root.append(page);
  draw();
  return { title: 'Thuật ngữ', destroy() {} };
}
