// Hotspot: tap regions of a diagram (or of a sim in hotspot mode). Answer = id or array of ids.
import { el } from '../util.js';
import { diagramSvg } from '../render/diagram.js';
import { mountSim } from '../render/sim-host.js';
import { NAMED_DIAGRAMS } from '../diagrams/index.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export function create(step, api) {
  const answer = new Set(Array.isArray(step.answer) ? step.answer : [step.answer]);
  const multi = Array.isArray(step.answer);
  const selected = new Set();
  let locked = false;
  let sim = null;
  const stage = el('div.hotspot-stage');
  const picked = el('p.hotspot-picked', { 'aria-live': 'polite' }, 'Chưa chọn vùng nào.');
  const wrap = el('div.hotspot', null,
    el('p.ex-sub', null, multi ? 'Chạm vào tất cả vùng đúng (có thể chọn nhiều).' : 'Chạm vào một vùng trên hình.'), stage, picked);

  const regions = () => [...stage.querySelectorAll('[data-hotspot]')];
  const labelOf = (id) => {
    const n = stage.querySelector(`[data-hotspot="${CSS.escape(id)}"]`);
    return (n && n.getAttribute('data-label')) || id;
  };
  function refresh() {
    for (const r of regions()) {
      const id = r.getAttribute('data-hotspot');
      r.classList.toggle('hs-selected', selected.has(id));
      r.setAttribute('aria-pressed', String(selected.has(id)));
    }
    picked.textContent = selected.size ? `Đã chọn: ${[...selected].map(labelOf).join(', ')}` : 'Chưa chọn vùng nào.';
  }
  function pick(id) {
    if (locked || !id) return;
    if (selected.has(id)) selected.delete(id);
    else { if (!multi) selected.clear(); selected.add(id); }
    refresh();
    api.onChange();
  }
  // ownEvents=false: the sim's setHotspotMode already makes regions focusable and calls pick().
  function wire(ownEvents = true) {
    for (const r of regions()) {
      if (r.dataset.hsWired) continue;
      r.dataset.hsWired = '1';
      r.classList.add('hs-target');
      if (!ownEvents) continue;
      r.setAttribute('tabindex', '0');
      r.setAttribute('role', 'button');
      r.setAttribute('aria-label', r.getAttribute('data-label') || r.getAttribute('data-hotspot'));
      r.classList.add('hs-target');
      r.addEventListener('click', (e) => { e.stopPropagation(); pick(r.getAttribute('data-hotspot')); });
      r.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r.getAttribute('data-hotspot')); }
      });
    }
  }
  function badge(r, ok) {
    if (!(r instanceof SVGGraphicsElement) || typeof r.getBBox !== 'function') { r.dataset.mark = ok ? '✓' : '✕'; return; }
    try {
      const b = r.getBBox();
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', String(b.x + b.width - 4)); t.setAttribute('y', String(b.y + 18));
      t.setAttribute('text-anchor', 'end'); t.setAttribute('font-size', '18'); t.setAttribute('font-weight', '700');
      t.setAttribute('class', 'hs-badge ' + (ok ? 'ok' : 'bad'));
      t.setAttribute('aria-hidden', 'true');
      t.textContent = ok ? '✓' : '✕';
      r.append(t);
    } catch { /* ignore */ }
  }
  function mark(reveal) {
    for (const r of regions()) {
      const id = r.getAttribute('data-hotspot');
      const isAns = answer.has(id), isSel = selected.has(id);
      r.classList.remove('hs-correct', 'hs-wrong');
      r.querySelectorAll('.hs-badge').forEach((b) => b.remove());
      if ((reveal && isAns) || (!reveal && isSel && isAns)) { r.classList.add('hs-correct'); badge(r, true); }
      else if (!reveal && isSel && !isAns) { r.classList.add('hs-wrong'); badge(r, false); }
    }
  }

  const t = step.target || {};
  // Resolves once the tappable regions exist (diagram: now; sim: after it mounted and entered hotspot mode),
  // so the exam review can print the regions' Vietnamese data-label instead of raw ids.
  let regionsReady = Promise.resolve();
  if (t.kind === 'sim') {
    sim = mountSim(stage, { sim: t.sim, props: t.props }, { controls: false });
    regionsReady = Promise.resolve(sim.ready).then((inst) => {
      let simWired = false;
      try { inst.setHotspotMode(true, (id) => pick(id)); simWired = regions().some((r) => r.getAttribute('role') === 'button'); } catch (e) { console.warn(e); }
      wire(!simWired);
      if (!regions().length) {
        picked.textContent = 'Hình tương tác chưa sẵn sàng. Em bấm "Bỏ qua" để đi tiếp nhé.';
        if (api.broken) api.broken();
      }
      // Sims may re-render; keep wiring new regions.
      const mo = new MutationObserver(() => { wire(!simWired); refresh(); });
      mo.observe(stage, { childList: true, subtree: true });
      sim._mo = mo;
    }).catch((e) => { console.warn(e); });
  } else {
    const node = diagramSvg(t);
    const alt = t.alt || (t.name && NAMED_DIAGRAMS[t.name]?.alt) || 'Hình minh hoạ';
    if (node.setAttribute) { node.setAttribute('role', 'group'); node.setAttribute('aria-label', alt); }
    stage.append(el('figure.diagram', null, el('div.diagram-stage', null, node)));
    wire();
  }

  return {
    el: wrap,
    labelOf,
    regionsReady: () => regionsReady,
    isReady: () => selected.size > 0,
    check() {
      locked = true; wrap.classList.add('locked'); mark(false);
      const correct = selected.size === answer.size && [...selected].every((x) => answer.has(x));
      return { correct };
    },
    getAnswer: () => (selected.size ? [...selected].sort() : null),
    setAnswer(v) { selected.clear(); (Array.isArray(v) ? v : []).forEach((id) => { if (typeof id === 'string') selected.add(id); }); if (!multi && selected.size > 1) { const f = [...selected][0]; selected.clear(); selected.add(f); } refresh(); },
    reveal() { locked = true; wrap.classList.add('locked'); selected.clear(); answer.forEach((a) => selected.add(a)); refresh(); mark(true); },
    reset() {
      locked = false; wrap.classList.remove('locked');
      for (const r of regions()) { r.classList.remove('hs-correct', 'hs-wrong'); r.querySelectorAll('.hs-badge').forEach((b) => b.remove()); delete r.dataset.mark; }
      refresh();
    },
    destroy() { if (sim) { sim._mo && sim._mo.disconnect(); sim.destroy(); } },
  };
}
