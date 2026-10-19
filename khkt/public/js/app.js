// Boot: prefs → progress store → sync → header widgets → glossary popovers → router.
import { start } from './router.js';
import { createStore } from './progress/store.js';
import { createSync } from './progress/sync.js';
import { setMotionPref, applyTheme, toast } from './a11y.js';
import { buildGlossary, setGlossary, lookupTerm } from './render/markdown.js';
import { el, fmtNumber } from './util.js';

const ROUTES = {
  home: () => import('./views/home.js'),
  unit: () => import('./views/unit.js'),
  lesson: () => import('./views/lesson.js'),
  practice: () => import('./views/practice.js'),
  question: () => import('./views/question.js'),
  profile: () => import('./views/profile.js'),
  videos: () => import('./views/videos.js'),
  glossary: () => import('./views/glossary.js'),
  exam: () => import('./views/exam.js'),
  'exam-run': () => import('./views/exam-run.js'),
  'exam-defense': () => import('./views/exam-defense.js'),
  'exam-result': () => import('./views/exam-result.js'),
  notfound: () => import('./views/notfound.js'),
};

async function boot() {
  const store = createStore();
  applyTheme(store.prefs.theme);
  setMotionPref(store.prefs.motion);
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => setMotionPref(store.prefs.motion)); } catch { /* old browsers */ }

  let course;
  try {
    course = (await import('../content/index.js')).course;
  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML = '<section class="page narrow"><h1 tabindex="-1">Chưa tải được giáo trình</h1><p>Có thể một tệp nội dung đang bị lỗi. Em thử tải lại trang, hoặc báo cho thầy cô phụ trách.</p></section>';
    return;
  }
  setGlossary(buildGlossary(course));
  const sync = createSync(store);
  const ctx = { course, store, sync };
  window.__bw = ctx; // handy for debugging in DevTools

  // ---- header widgets ----
  const pts = document.getElementById('hdr-points');
  const streak = document.getElementById('hdr-streak');
  const pill = document.getElementById('hdr-sync');
  let lastPoints = store.points;
  const paintHeader = () => {
    const p = store.points;
    pts.querySelector('.v').textContent = fmtNumber(p);
    pts.setAttribute('aria-label', `${p} điểm năng lượng`);
    if (p > lastPoints) { pts.classList.remove('bump'); void pts.offsetWidth; pts.classList.add('bump'); }
    lastPoints = p;
    const s = store.progress.streak?.cur || 0;
    streak.querySelector('.v').textContent = String(s);
    streak.setAttribute('aria-label', `Chuỗi ${s} ngày học liên tiếp`);
  };
  const paintSync = () => {
    pill.dataset.status = sync.status;
    const [icon, ...rest] = sync.label.split(' ');
    pill.querySelector('.i').textContent = icon;
    pill.querySelector('.t').textContent = rest.join(' ');
    pill.title = sync.label;
    pill.setAttribute('aria-label', `Trạng thái lưu: ${rest.join(' ')}`);
  };
  paintHeader(); paintSync();
  store.on(paintHeader);
  sync.onStatus(paintSync);

  // ---- glossary term popover (delegated) ----
  const pop = el('div.term-pop', { role: 'dialog', 'aria-modal': 'false', hidden: true });
  document.body.append(pop);
  let popFor = null;
  const closePop = () => { pop.hidden = true; if (popFor) popFor.setAttribute('aria-expanded', 'false'); popFor = null; };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button.term');
    if (!t) { if (!pop.contains(e.target)) closePop(); return; }
    if (popFor === t) { closePop(); return; }
    const g = lookupTerm(t.dataset.term);
    if (!g) return;
    pop.replaceChildren(el('strong', null, g.term), g.en ? el('span.term-en', null, ` (${g.en})`) : null, el('p', null, g.def),
      el('a.term-more', { href: '#/glossary' }, 'Xem tất cả thuật ngữ →'));
    pop.setAttribute('aria-label', `Thuật ngữ: ${g.term}`);
    pop.hidden = false;
    const r = t.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX)) + 'px';
    pop.style.top = r.bottom + window.scrollY + 8 + 'px';
    t.setAttribute('aria-expanded', 'true');
    popFor = t;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popFor) { const f = popFor; closePop(); f.focus(); } });
  document.addEventListener('bw:route', closePop);

  if (!store.storage.ok) toast('Trình duyệt không cho lưu: hãy giữ mã học tập (xem Hồ sơ).', 5000);
  start(ROUTES, ctx);
  sync.boot();
}

boot();
