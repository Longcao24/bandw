// Mounts a sim module (public/js/sims/<id>.js) inside a standard frame:
// stage + controls toolbar (if meta.timeline) + aria-live caption. Graceful fallback on failure.
import { el } from '../util.js';
import { icon } from '../icons.js';
import { loadSim } from '../sims/registry.js';
import { prefersReducedMotion } from '../a11y.js';

const NOOP_INSTANCE = {
  play() {}, pause() {}, step() {}, reset() {}, runTo() { return Promise.resolve(); },
  setHotspotMode() {}, destroy() {},
};

/**
 * @param {HTMLElement} container
 * @param {{sim:string, props?:object, caption?:string, title?:string}} spec
 * @param {{speed?:number, onEvent?:Function, controls?:boolean, autoplay?:boolean}} opts
 * @returns {{frame:HTMLElement, ready:Promise<object>, get instance():object, get meta():object, setControlsDisabled(b), destroy()}}
 */
export function mountSim(container, spec, opts = {}) {
  const reducedMotion = prefersReducedMotion();
  const stage = el('div.sim-stage');
  const live = el('p.sim-live', { 'aria-live': 'polite' });
  const frame = el('figure.sim', { role: 'group', 'aria-label': spec.title || 'Mô phỏng', 'data-sim': spec.sim }, stage);
  const toolbar = el('div.sim-toolbar', { role: 'toolbar', 'aria-label': 'Điều khiển mô phỏng', hidden: true });
  frame.append(toolbar, live);
  if (spec.caption) frame.append(el('figcaption.sim-caption', { html: spec.captionHtml || '' }, spec.captionHtml ? null : spec.caption));
  container.append(frame);

  let instance = NOOP_INSTANCE;
  let meta = { id: spec.sim, title: spec.title || '', timeline: false, checkpoints: [], hotspots: [] };
  let destroyed = false;
  let playing = false;
  let io = null;
  let speed = opts.speed || 1;
  let controlsDisabled = false;
  const ui = {};

  const setPlaying = (p) => {
    playing = !!p;
    if (ui.play) {
      ui.play.replaceChildren(icon(playing ? 'pause' : 'play', 16), el('span', null, playing ? 'Tạm dừng' : 'Phát'));
      ui.play.setAttribute('aria-pressed', String(playing));
    }
  };

  const ctx = {
    reducedMotion,
    speed,
    onEvent(name, data) {
      if (destroyed) return;
      if (data && typeof data.caption === 'string' && data.caption) live.textContent = data.caption;
      if (name === 'play' || name === 'playing') setPlaying(true);
      if (name === 'pause' || name === 'paused' || name === 'end' || name === 'ended') setPlaying(false);
      if (name === 'state' && data && 'playing' in data) setPlaying(data.playing);
      if ((name === 'beat' || name === 'checkpoint') && data && data.id && ui.dots) {
        for (const d of ui.dots.children) d.classList.toggle('active', d.dataset.id === data.id);
      }
      if (opts.onEvent) opts.onEvent(name, data);
    },
  };

  function buildToolbar() {
    if (!meta.timeline || opts.controls === false) return;
    // A sim that renders its own controls (via sims/lib/controls.js) keeps them; the host adds none.
    if (stage.querySelector('[data-sim-controls], .sim-controls')) return;
    toolbar.hidden = false;
    ui.play = el('button.btn.sm.primary', { type: 'button', 'aria-pressed': 'false', onclick: () => {
      autoPaused = false;
      if (playing) { instance.pause(); setPlaying(false); } else { instance.play(); setPlaying(true); }
    } }, icon('play', 16), el('span', null, 'Phát'));
    ui.step = el('button.btn.sm', { type: 'button', 'aria-label': 'Bước tiếp', title: 'Bước tiếp', onclick: () => { autoPaused = false; instance.step(); setPlaying(false); } }, icon('skip-forward', 16), el('span.sim-btn-lbl', null, 'Bước tiếp'));
    ui.reset = el('button.btn.sm', { type: 'button', 'aria-label': 'Phát lại', title: 'Phát lại', onclick: () => { autoPaused = false; instance.reset(); setPlaying(false); } }, icon('rotate-ccw', 16));
    ui.speed = el('select.sim-speed', { 'aria-label': 'Tốc độ', onchange: (e) => {
      speed = Number(e.target.value) || 1; ctx.speed = speed;
      if (typeof instance.setSpeed === 'function') instance.setSpeed(speed);
    } }, [0.5, 1, 1.5].map((v) => el('option', { value: v, selected: v === speed }, `${String(v).replace('.', ',')}×`)));
    toolbar.append(ui.play, ui.step, ui.reset, el('label.sim-speed-wrap', null, el('span.sr-only', null, 'Tốc độ'), ui.speed));
    const cps = (meta.checkpoints || []).filter((c) => c !== 'end');
    if (cps.length > 1 && cps.length <= 24) {
      ui.dots = el('div.sim-dots', { role: 'group', 'aria-label': 'Các bước' },
        cps.map((id, i) => el('button.sim-dot', { type: 'button', 'data-id': id, 'aria-label': `Bước ${i + 1}: ${id}`,
          onclick: () => { setPlaying(false); instance.runTo(id); } })));
      toolbar.append(ui.dots);
    }
    toolbar.addEventListener('keydown', (e) => {
      if (e.key === ' ' && e.target === ui.play) { e.preventDefault(); ui.play.click(); }
    });
  }

  function fallback(err) {
    console.warn(`[sim ${spec.sim}]`, err);
    stage.replaceChildren(el('div.sim-fallback', { role: 'note' },
      el('span', { 'aria-hidden': 'true' }, icon('wrench', 22)),
      el('p', null, el('strong', null, 'Mô phỏng đang được chuẩn bị. '), 'Em đọc chú thích bên dưới và tiếp tục bài nhé.')));
    frame.classList.add('is-fallback');
  }

  const ready = (async () => {
    try {
      const mod = await loadSim(spec.sim);
      if (destroyed) return instance;
      meta = { ...meta, ...(mod.meta || {}) };
      if (!spec.title && meta.title) frame.setAttribute('aria-label', meta.title);
      const props = { ...(meta.defaults || {}), ...(spec.props || {}) };
      const inst = mod.mount(stage, props, ctx);
      instance = { ...NOOP_INSTANCE, ...(inst || {}) };
      // Keep method `this` binding for class-based instances.
      if (inst) for (const k of Object.keys(NOOP_INSTANCE).concat(['setSpeed'])) if (typeof inst[k] === 'function') instance[k] = inst[k].bind(inst);
      buildToolbar();
      setControlsDisabled(controlsDisabled);
      observe();
      if (opts.autoplay && meta.timeline && !reducedMotion) { instance.play(); setPlaying(true); }
    } catch (e) {
      fallback(e);
      instance = NOOP_INSTANCE;
    }
    return instance;
  })();

  // Auto-pause when the sim scrolls out of view or the tab is hidden, and resume what WE paused when it
  // comes back. While the controls are locked (sim-predict is awaiting runTo()), never auto-pause:
  // the student has no control to restart it, and a paused Timeline would leave runTo() pending forever.
  let autoPaused = false;
  let inView = true;
  function autoPause() {
    if (!playing || controlsDisabled) return;
    autoPaused = true; instance.pause(); setPlaying(false);
  }
  function autoResume() {
    if (!autoPaused || destroyed || !inView || document.visibilityState === 'hidden') return;
    autoPaused = false; instance.play(); setPlaying(true);
  }
  function observe() {
    if (!meta.timeline || typeof IntersectionObserver === 'undefined') return;
    io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        // A frame taller than the viewport can never reach 20 % visible; treat "covers ≥ 60 % of the
        // viewport" as visible too.
        const vh = (en.rootBounds && en.rootBounds.height) || window.innerHeight || 1;
        inView = en.intersectionRatio >= 0.2 || en.intersectionRect.height >= 0.6 * vh;
        if (!inView) autoPause(); else autoResume();
      }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.5] });
    io.observe(frame);
    document.addEventListener('visibilitychange', onVis);
  }
  function onVis() {
    if (document.visibilityState === 'hidden') autoPause();
    else autoResume();
  }
  function setControlsDisabled(b) {
    controlsDisabled = !!b;
    for (const btn of toolbar.querySelectorAll('button, select')) btn.disabled = controlsDisabled;
    toolbar.classList.toggle('is-locked', controlsDisabled);
    // Timeline sims draw their own controls ([data-sim-controls]); lock those too (e.g. during sim-predict),
    // otherwise the student could press ▶ and see the answer before choosing.
    if (instance && typeof instance.setControlsEnabled === 'function') { try { instance.setControlsEnabled(!controlsDisabled); } catch (e) { console.warn(e); } }
    for (const n of stage.querySelectorAll('[data-sim-controls] button, [data-sim-controls] select, [data-sim-controls] input')) n.disabled = controlsDisabled;
  }

  return {
    frame, stage, ready,
    get instance() { return instance; },
    get meta() { return meta; },
    get playing() { return playing; },
    setPlaying,
    setControlsDisabled,
    destroy() {
      destroyed = true;
      try { instance.destroy(); } catch (e) { console.error(e); }
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
