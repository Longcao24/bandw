// API client + debounced sync with exponential backoff (spec §7.7).
import { KEYS } from './store.js';
import { normalize } from '../core/learnerCode.js';

export const STATUS_LABEL = {
  idle: '☁️ Đã lưu',
  saved: '☁️ Đã lưu',
  saving: '⏳ Đang lưu…',
  local: '📱 Chỉ lưu trên máy này',
  error: '⚠️ Lỗi đồng bộ, sẽ thử lại',
};
const API = '/api/progress';

// A static host without the Function (e.g. `npm run serve`) answers with HTML 404/405/501: treat as "no backend".
function normalizeStatus(res, body) {
  if (!body || typeof body !== 'object') return res.status >= 500 && res.status !== 501 ? res.status : 503;
  return res.status;
}
export async function apiGet(code, fetchFn = globalThis.fetch) {
  const res = await fetchFn(API, { method: 'GET', headers: { 'X-Learner-Code': code }, credentials: 'same-origin' });
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: normalizeStatus(res, body), body, retryAfter: Number(res.headers.get('Retry-After')) || 0 };
}
export async function apiPut(code, progress, { fetchFn = globalThis.fetch, keepalive = false } = {}) {
  const res = await fetchFn(API, {
    method: 'PUT', keepalive, credentials: 'same-origin',
    headers: { 'X-Learner-Code': code, 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  });
  let body = null;
  try { body = await res.json(); } catch { /* ignore */ }
  return { status: normalizeStatus(res, body), body, retryAfter: Number(res.headers.get('Retry-After')) || 0 };
}

export function createSync(store, { fetchFn = (...a) => globalThis.fetch(...a), debounceMs = 3000 } = {}) {
  const listeners = new Set();
  let status = store.storage.ok ? 'idle' : 'local';
  let timer = null;
  let backoff = 0;
  let inflight = false;
  let dirty = false;

  function setStatus(s) {
    if (!store.storage.ok && s !== 'saving') s = 'local';
    if (s === status) return;
    status = s;
    for (const fn of listeners) fn(status);
  }
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(push, ms);
  }
  function failed(res) {
    // 429 (busy school network) and 409 (another device saved at the same moment) are not errors the
    // learner can fix: keep progress locally and quietly try again.
    if (res && res.status === 429) { setStatus('local'); schedule((res.retryAfter || 60) * 1000); return; }
    if (res && res.status === 409) { schedule(1500); return; }
    if (res && res.status === 503) { setStatus('local'); backoff = 60000; schedule(backoff); return; }
    backoff = Math.min(60000, backoff ? backoff * 2 : 5000);
    setStatus(typeof navigator !== 'undefined' && navigator.onLine === false ? 'local' : 'error');
    schedule(backoff);
  }

  async function push() {
    timer = null;
    if (inflight) { dirty = true; return; }
    inflight = true; dirty = false;
    setStatus('saving');
    let res = null;
    try {
      res = await apiPut(store.code, store.progress, { fetchFn });
    } catch { res = null; }
    inflight = false;
    if (res && res.status === 200 && res.body && res.body.progress) {
      backoff = 0;
      store.mergeIn(res.body.progress);
      store.storage.set(KEYS.lastSync, String(Date.now()));
      setStatus('saved');
      if (dirty) schedule(debounceMs);
    } else failed(res);
  }

  store.on((reason, { local }) => {
    if (reason === 'prefs') return;
    if (reason === 'code') { schedule(200); return; }
    if (!local) return;
    if (status !== 'saving' && status !== 'local') setStatus('saving');
    if (!timer) schedule(backoff || debounceMs);
    else if (!backoff) schedule(debounceMs);
  });

  function flushKeepalive() {
    if (!timer) return;
    clearTimeout(timer); timer = null;
    try { apiPut(store.code, store.progress, { fetchFn, keepalive: true }).catch(() => {}); } catch { /* ignore */ }
  }

  return {
    get status() { return status; },
    get label() { return STATUS_LABEL[status]; },
    get lastSync() { return Number(store.storage.get(KEYS.lastSync)) || 0; },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async boot() {
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { store.flush(); flushKeepalive(); } });
      }
      try {
        const res = await apiGet(store.code, fetchFn);
        if (res.status === 200 && res.body && res.body.progress) { store.mergeIn(res.body.progress); setStatus('saved'); }
        else if (res.status === 404) setStatus('idle');
        else if (res.status === 503) setStatus('local');
        else setStatus('error');
      } catch { setStatus('local'); }
    },
    syncNow() { schedule(0); },
    /** Restore flow: returns 'invalid' | 'not_found' | 'error' | { remote, code } */
    async lookup(input) {
      const code = normalize(input);
      if (!code) return 'invalid';
      try {
        const res = await apiGet(code, fetchFn);
        if (res.status === 404) return 'not_found';
        if (res.status === 400) return 'invalid';
        if (res.status !== 200 || !res.body) return 'error';
        return { remote: res.body.progress, code };
      } catch { return 'error'; }
    },
    adopt({ remote, code }) {
      store.setCode(code);
      store.mergeIn(remote);
      schedule(0);
    },
  };
}
