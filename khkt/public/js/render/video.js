// Video step: MP4 + poster + Vietnamese WebVTT, chapters, progress on ≥90% / ended, sim fallback.
import { el } from '../util.js';
import { videoById, videoFiles } from '../videos.js';
import { inline } from './markdown.js';
import { mountSim } from './sim-host.js';

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function renderVideo(step, { store } = {}) {
  const meta = videoById(step.id) || { title: step.title || step.id };
  const files = videoFiles(step.id);
  const video = el('video', { controls: true, preload: 'metadata', playsinline: true, poster: files.jpg, 'aria-label': step.title || meta.title });
  video.append(
    el('source', { src: files.mp4, type: 'video/mp4' }),
    el('track', { kind: 'subtitles', srclang: 'vi', label: 'Tiếng Việt', src: files.vtt, default: true }),
  );
  const holder = el('div.video-frame', null, video);
  const fig = el('figure.video', null,
    el('div.video-head', null, el('span.badge', { 'aria-hidden': 'true' }, '🎬'), el('strong', null, step.title || meta.title)),
    holder);
  let sim = null;
  let failed = false;
  let recorded = false;

  const record = () => { if (!recorded && store) { recorded = true; store.markVideo(step.id); } };
  video.addEventListener('ended', record);
  video.addEventListener('timeupdate', () => { if (video.duration && video.currentTime / video.duration >= 0.9) record(); });

  function fail() {
    if (failed) return;
    failed = true;
    holder.replaceChildren(el('div.video-missing', { role: 'note' },
      el('span', { 'aria-hidden': 'true' }, '🎞️'),
      el('p', null, el('strong', null, 'Video đang được chuẩn bị.'),
        step.fallbackSim ? ' Trong lúc chờ, em xem mô phỏng bên dưới nhé.' : ' Em tiếp tục bài học nhé.')));
    if (chapters) chapters.hidden = true;
    if (step.fallbackSim) {
      sim = mountSim(holder, { sim: step.fallbackSim.sim, props: step.fallbackSim.props, title: meta.title }, {});
    }
  }
  video.addEventListener('error', fail);
  video.querySelector('source').addEventListener('error', fail);
  // A 404 on the source does not always fire 'error' on <video>; probe with HEAD as well.
  if (typeof fetch === 'function') {
    fetch(files.mp4, { method: 'HEAD' }).then((r) => { if (!r.ok) fail(); }).catch(() => {});
  }

  let chapters = null;
  if (step.chapters && step.chapters.length) {
    chapters = el('div.video-chapters', { role: 'group', 'aria-label': 'Chương của video' },
      step.chapters.map((c) => el('button.chip', { type: 'button', onclick: () => {
        try { video.currentTime = c.t; video.play().catch(() => {}); } catch { /* ignore */ }
      } }, el('span.chip-time', null, fmt(c.t)), ' ', c.label)));
    fig.append(chapters);
  }
  if (step.caption) fig.append(el('figcaption', { html: inline(step.caption) }));
  return {
    el: fig,
    destroy() { try { video.pause(); } catch { /* ignore */ } if (sim) sim.destroy(); },
  };
}
