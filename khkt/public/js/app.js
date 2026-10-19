// Boot: prefs → progress store → sync → header widgets → glossary popovers → router.
import { start } from './router.js';
import { createStore } from './progress/store.js';
import { createSync } from './progress/sync.js';
import { setMotionPref, applyTheme, toast } from './a11y.js';
import { buildGlossary, setGlossary, lookupTerm } from './render/markdown.js';
import { el, fmtNumber } from './util.js';
import { icon } from './icons.js';

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
  for (const i of document.querySelectorAll('i[data-icon]')) i.replaceWith(icon(i.dataset.icon, 18));

  // ---- user menu (learner code + sync status + secondary links) ----
  const menuBtn = document.querySelector('.user-menu-btn');
  const menu = document.getElementById('user-menu');
  const setMenu = (open, { focus = false } = {}) => {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) { codeEl.textContent = store.code; if (focus) menu.querySelector('a')?.focus(); }
  };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden, { focus: false }));
  menuBtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setMenu(true, { focus: true }); } });
  document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('.user-menu')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

  // ---- active nav + route flag (the tab bar hides on screens with their own bottom bar) ----
  const NAV_OF = { home: 'learn', unit: 'learn', lesson: 'learn', practice: 'learn', videos: 'learn', glossary: 'learn', question: 'question', exam: 'exam', 'exam-run': 'exam', 'exam-defense': 'exam', 'exam-result': 'exam', profile: 'profile' };
  document.addEventListener('bw:route', (e) => {
    const name = e.detail.name;
    document.body.dataset.route = name;
    const nav = NAV_OF[name] || '';
    for (const a of document.querySelectorAll('[data-nav]')) {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    setMenu(false);
  });
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
  const dot = document.getElementById('hdr-sync-dot');
  const codeEl = document.getElementById('hdr-code');
  const paintSync = () => {
    const text = sync.label.replace(/^\S+\s/, ''); // drop the leading emoji of STATUS_LABEL
    pill.dataset.status = sync.status;
    dot.dataset.status = sync.status;
    pill.querySelector('.i').dataset.status = sync.status;
    pill.querySelector('.t').textContent = text;
    pill.title = text;
    pill.setAttribute('aria-label', `Trạng thái lưu: ${text}`);
    menuBtn.setAttribute('aria-label', `Hồ sơ học tập · ${text}`);
    menuBtn.title = text;
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
