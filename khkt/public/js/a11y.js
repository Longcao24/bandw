// Accessibility helpers. Motion preference honours the user override in prefs.
let motionOverride = 'auto';

export function setMotionPref(value) {
  motionOverride = value === 'reduce' ? 'reduce' : 'auto';
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', prefersReducedMotion());
}

export function prefersReducedMotion() {
  if (motionOverride === 'reduce') return true;
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

let liveEl = null;
export function announce(msg) {
  if (typeof document === 'undefined') return;
  if (!liveEl) {
    liveEl = document.createElement('div');
    liveEl.className = 'sr-only';
    liveEl.setAttribute('aria-live', 'polite');
    liveEl.setAttribute('role', 'status');
    document.body.append(liveEl);
  }
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = msg; }, 30);
}

export function focusMain() {
  const h = document.querySelector('#app h1[tabindex="-1"]') || document.querySelector('#app h1');
  if (h) {
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  } else document.getElementById('app')?.focus({ preventScroll: true });
}

export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

/** Promise-based confirm dialog using <dialog> (falls back to window.confirm). */
/** `signal` (AbortSignal, optional): aborting closes the dialog as if "cancel" was pressed. */
export function confirmDialog(message, { ok = 'Đồng ý', cancel = 'Huỷ', danger = false, signal } = {}) {
  return new Promise((resolve) => {
    if (signal && signal.aborted) { resolve(false); return; }
    if (typeof HTMLDialogElement === 'undefined') { resolve(window.confirm(message)); return; }
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `<form method="dialog"><p class="dialog-msg"></p><div class="dialog-actions">
      <button value="cancel" class="btn">${cancel}</button>
      <button value="ok" class="btn ${danger ? 'danger' : 'primary'}">${ok}</button></div></form>`;
    d.querySelector('.dialog-msg').textContent = message;
    document.body.append(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    if (signal) signal.addEventListener('abort', () => { if (d.open) d.close('cancel'); }, { once: true });
    d.showModal();
    d.querySelector('button[value="ok"]').focus();
  });
}

/** Theme: 'auto' follows the OS; 'light'/'dark' force via data-theme. */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  if (theme === 'light' || theme === 'dark') r.setAttribute('data-theme', theme);
  else r.removeAttribute('data-theme');
}
