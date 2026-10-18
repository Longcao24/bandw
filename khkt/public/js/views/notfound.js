// Not-found view.
import { el } from '../util.js';

export function render(root) {
  root.append(el('section.page.narrow.notfound', null,
    el('div.big-emoji', { 'aria-hidden': 'true' }, '🧭'),
    el('h1', { tabindex: '-1' }, 'Không tìm thấy trang này'),
    el('p.lead', null, 'Có thể đường dẫn bị sai hoặc bài học đã được đổi tên.'),
    el('a.btn.primary.lg', { href: '#/' }, 'Về trang chủ')));
  return { title: 'Không tìm thấy', destroy() {} };
}
