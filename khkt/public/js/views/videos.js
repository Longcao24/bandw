// Video library: the 8 catalogue videos, watched ones marked ✓.
import { el } from '../util.js';
import { VIDEO_CATALOG, videoFiles } from '../videos.js';
import { pageHeader } from './_ui.js';
import { renderVideo } from '../render/video.js';

export function render(root, _p, { course, store }) {
  const page = el('div.page.videos');
  const watched = store.progress.videos;
  const n = VIDEO_CATALOG.filter((v) => watched[v.id]).length;
  page.append(pageHeader('🎬 Thư viện video', `Video hoạt hình ngắn có thuyết minh và phụ đề tiếng Việt. Em đã xem ${n}/${VIDEO_CATALOG.length} video.`));
  const player = el('div.video-player-slot');
  let active = null;
  const grid = el('div.video-grid');
  for (const v of VIDEO_CATALOG) {
    const u = course.units.find((x) => x.id === v.unit);
    const seen = !!watched[v.id];
    const card = el('button.video-card', { type: 'button', 'aria-label': `${v.title}${seen ? ', đã xem' : ''}`, onclick: () => open(v) },
      el('div.video-thumb', null,
        el('img', { src: videoFiles(v.id).jpg, alt: '', loading: 'lazy', onerror: (e) => { e.target.remove(); } }),
        el('span.video-play', { 'aria-hidden': 'true' }, '▶'),
        seen ? el('span.video-seen', null, '✓ Đã xem') : null),
      el('div.video-card-body', null,
        el('strong', null, v.title),
        el('small', null, v.summary),
        u ? el('span.tag', null, `${u.icon} ${u.title}`) : null));
    grid.append(card);
  }
  function open(v) {
    if (active) active.destroy();
    active = renderVideo({ id: v.id, title: v.title, caption: v.summary, fallbackSim: { sim: v.fallbackSim } }, { store });
    player.replaceChildren(active.el, el('button.btn.sm.ghost', { type: 'button', onclick: () => { active.destroy(); active = null; player.replaceChildren(); } }, '✕ Đóng video'));
    player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    player.querySelector('video')?.focus();
  }
  page.append(player, grid);
  root.append(page);
  return { title: 'Thư viện video', destroy() { if (active) active.destroy(); } };
}
