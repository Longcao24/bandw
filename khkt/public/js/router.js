// Hash router: #/, #/unit/u03, #/unit/u03/lesson/l2, #/practice[/u03], #/profile, #/videos, #/glossary, #/exam…
import { focusMain } from './a11y.js';

let routes = [];
let current = null;
let ctxRef = null;
let renderSeq = 0;

export function parseHash(hash) {
  const path = String(hash || '').replace(/^#/, '').replace(/^\/?/, '/').replace(/\/+$/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home', params: {} };
  if (parts[0] === 'unit' && parts.length === 2) return { name: 'unit', params: { unitId: parts[1] } };
  if (parts[0] === 'unit' && parts.length === 4 && parts[2] === 'lesson') return { name: 'lesson', params: { unitId: parts[1], lessonId: parts[3] } };
  if (parts[0] === 'unit' && parts.length === 6 && parts[2] === 'lesson' && parts[4] === 'q') return { name: 'lesson', params: { unitId: parts[1], lessonId: parts[3], stepId: parts[5] } };
  // Ngân hàng phản biện: #/question, #/question/<questionId> (also served at the real path /question)
  if (parts[0] === 'question' && parts.length <= 2) return { name: 'question', params: { id: parts[1] || null } };
  if (parts[0] === 'practice' && parts.length <= 2) return { name: 'practice', params: { unitId: parts[1] || null } };
  if (parts.length === 1 && ['profile', 'videos', 'glossary'].includes(parts[0])) return { name: parts[0], params: {} };
  // Thi thử: #/exam, #/exam/full|quick, #/exam/unit[/u03], #/exam/defense, #/exam/result/<attemptId>
  if (parts[0] === 'exam') {
    if (parts.length === 1) return { name: 'exam', params: {} };
    if (parts.length === 3 && parts[1] === 'result') return { name: 'exam-result', params: { attemptId: parts[2] } };
    if (parts.length === 2 && parts[1] === 'defense') return { name: 'exam-defense', params: {} };
    if (parts.length === 2 && (parts[1] === 'full' || parts[1] === 'quick')) return { name: 'exam-run', params: { mode: parts[1], unitId: null } };
    if (parts[1] === 'unit' && parts.length <= 3) return { name: 'exam-run', params: { mode: 'unit', unitId: parts[2] || null } };
  }
  return { name: 'notfound', params: { path } };
}

/** Real paths served by public/_redirects (e.g. /question) map to a route when there is no hash. */
export function parseLocation(loc) {
  const hash = String(loc.hash || '').replace(/^#/, '');
  if (!hash) { // '#/' (logo, "Về trang chủ") is always home, even when the real path is /question
    const path = String(loc.pathname || '/').replace(/\/+$/, '').toLowerCase();
    if (path === '/question' || path === '/questions' || path === '/cau-hoi') return { name: 'question', params: { id: null } };
  }
  return parseHash(loc.hash);
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const seq = ++renderSeq;
  const { name, params } = parseLocation(location);
  const root = document.getElementById('app');
  if (current && current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
  current = null;
  root.replaceChildren();
  root.dataset.view = name;
  const view = routes[name] || routes.notfound;
  try {
    const mod = await view();
    if (seq !== renderSeq) return; // a newer navigation started while this view was loading
    current = mod.render(root, params, ctxRef) || null;
  } catch (e) {
    if (seq !== renderSeq) return;
    console.error(e);
    root.innerHTML = '<section class="page narrow"><h1 tabindex="-1">Có lỗi khi tải trang</h1><p>Em thử tải lại trang nhé.</p><a class="btn primary" href="#/">Về trang chủ</a></section>';
  }
  const h1 = root.querySelector('h1');
  document.title = `${(current && current.title) || (h1 ? h1.textContent : 'Học BandW')} · BandW KHKT`;
  window.scrollTo(0, 0);
  focusMain();
  document.dispatchEvent(new CustomEvent('bw:route', { detail: { name, params } }));
}

/** routes: { home: () => import('./views/home.js'), … } */
export function start(routeMap, ctx) {
  routes = routeMap;
  ctxRef = ctx;
  window.addEventListener('hashchange', render);
  render();
}
