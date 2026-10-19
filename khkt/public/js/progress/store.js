// Progress store: in-memory state + localStorage persistence + events + mastery calculation.
import { emptyProgress, sanitizeProgress, mergeProgress, totalPoints, sanitizeExam, sanitizeAi, AI_MAX } from '../core/merge.js';
import { generate, normalize } from '../core/learnerCode.js';
import { lessonKey } from '../core/ids.js';
import { todayStr, yesterdayStr, debounce } from '../util.js';

export const KEYS = { progress: 'bw.v1.progress', code: 'bw.v1.code', prefs: 'bw.v1.prefs', lastSync: 'bw.v1.lastSync',
  examCurrent: 'bw.v1.exam.current', examDetails: 'bw.v1.exam.details' }; // exam.*: this device only (see exam/session.js)
export const DEFAULT_PREFS = { theme: 'auto', motion: 'auto', speed: 1 };
export const POINTS = { first: 10, second: 6, later: 3, lesson: 20 };

/** Storage wrapper with in-memory fallback. */
export function makeStorage(backend) {
  const mem = new Map();
  let ok = true;
  let ls = backend;
  if (ls === undefined) {
    try { ls = globalThis.localStorage; const k = '__bw_test'; ls.setItem(k, '1'); ls.removeItem(k); } catch { ls = null; }
  }
  if (!ls) ok = false;
  return {
    get ok() { return ok; },
    get(k) {
      if (ls) { try { const v = ls.getItem(k); if (v !== null) return v; } catch { ok = false; } }
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      mem.set(k, v);
      if (ls) { try { ls.setItem(k, v); } catch { ok = false; } }
    },
    remove(k) {
      mem.delete(k);
      if (ls) { try { ls.removeItem(k); } catch { ok = false; } }
    },
  };
}

/** Graded exercises in a lesson (flashcards excluded). */
export const GRADED = new Set(['mcq', 'multi', 'truefalse', 'order', 'match', 'number', 'predict', 'hotspot', 'sim-predict']);
export const EXERCISE_TYPES = new Set([...GRADED, 'flashcard']);
export const isExercise = (step) => step && EXERCISE_TYPES.has(step.type);
export const gradedIn = (lesson) => (lesson.steps || []).filter((s) => GRADED.has(s.type));

export function createStore({ storage = makeStorage(), now = () => Date.now() } = {}) {
  const listeners = new Set();
  let progress = emptyProgress();
  let code = null;
  let prefs = { ...DEFAULT_PREFS };

  try {
    const raw = storage.get(KEYS.progress);
    if (raw) progress = sanitizeProgress(JSON.parse(raw)) || emptyProgress();
  } catch { progress = emptyProgress(); }
  code = normalize(storage.get(KEYS.code) || '');
  if (!code) { code = generate(); storage.set(KEYS.code, code); }
  try { prefs = { ...DEFAULT_PREFS, ...(JSON.parse(storage.get(KEYS.prefs) || '{}') || {}) }; } catch { /* keep defaults */ }

  const save = debounce(() => storage.set(KEYS.progress, JSON.stringify(progress)), 300);

  function emit(reason, { local = true } = {}) {
    if (local) progress.updatedAt = now();
    save();
    for (const fn of listeners) { try { fn(reason, { local }); } catch (e) { console.error(e); } }
  }

  function touchStreak() {
    const today = todayStr(new Date(now()));
    const s = progress.streak || { cur: 0, best: 0, day: '' };
    if (s.day === today) return;
    const cur = s.day === yesterdayStr(new Date(now())) ? (s.cur || 0) + 1 : 1;
    progress.streak = { cur, best: Math.max(s.best || 0, cur), day: today };
  }

  const api = {
    storage,
    get progress() { return progress; },
    get code() { return code; },
    get prefs() { return prefs; },
    get points() { return totalPoints(progress); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    setPrefs(patch) {
      prefs = { ...prefs, ...patch };
      storage.set(KEYS.prefs, JSON.stringify(prefs));
      for (const fn of listeners) fn('prefs', { local: false });
    },

    /** Records one checked attempt. Returns points earned now (delta vs previous best). */
    recordAttempt(id, { correct, attempt = 1, hintUsed = false, revealed = false }) {
      const e = progress.ex[id] || { c: 0, a: 0, p: 0 };
      e.a = Math.min(1000, (e.a || 0) + 1);
      let earned = 0;
      if (correct && !revealed) {
        const pts = attempt === 1 && !hintUsed ? POINTS.first : attempt <= 2 ? POINTS.second : POINTS.later;
        earned = Math.max(0, pts - (e.p || 0));
        e.p = Math.max(e.p || 0, pts);
        if (!e.c) e.t = now();
        e.c = 1;
        touchStreak();
      }
      progress.ex[id] = e;
      emit('exercise');
      return { earned, pts: correct && !revealed ? e.p : 0 };
    },
    recordReveal(id) {
      const e = progress.ex[id] || { c: 0, a: 0, p: 0 };
      progress.ex[id] = e;
      emit('exercise');
    },

    rateCard(id, r) {
      const c = progress.cards[id] || { r, n: 0, at: 0 };
      const first = !c.n;
      progress.cards[id] = { r, n: Math.min(1000, (c.n || 0) + 1), at: now() };
      touchStreak();
      emit('card');
      return first ? 5 : 0;
    },

    /**
     * Saves one AI grading of a defense question (score 0–10, one decimal kept). Synced via progress.ai.
     * Returns { best, last, n, improved } with scores back in 0–10, or null for a bad id/score.
     */
    recordGrade(id, score) {
      const t = Math.round(Number(score) * 10);
      if (!Number.isFinite(t)) return null;
      const tenths = Math.max(0, Math.min(AI_MAX, t));
      const clean = sanitizeAi(id, { b: tenths, l: tenths, n: 1, at: now() });
      if (!clean) return null;
      const prev = progress.ai[id];
      progress.ai[id] = prev
        ? { b: Math.max(prev.b || 0, tenths), l: tenths, n: Math.min(1000, (prev.n || 0) + 1), at: Math.max(prev.at || 0, clean.at) }
        : clean;
      touchStreak();
      emit('grade');
      const g = progress.ai[id];
      return { best: g.b / 10, last: g.l / 10, n: g.n, improved: !prev || tenths > (prev.b || 0) };
    },
    /** { best, last, n, at } in 0–10 for one question, or null if never graded by AI. */
    grade(id) {
      const g = progress.ai && progress.ai[id];
      return g ? { best: g.b / 10, last: g.l / 10, n: g.n, at: g.at } : null;
    },

    visitStep(unitId, lessonId, s) {
      const k = lessonKey(unitId, lessonId);
      const l = progress.lessons[k] || { d: 0, s: 0, p: 0, at: 0 };
      l.s = s; l.at = now();
      progress.lessons[k] = l;
      progress.last = { u: unitId, l: lessonId, s, at: l.at };
      emit('visit');
    },

    completeLesson(unitId, lessonId) {
      const k = lessonKey(unitId, lessonId);
      const l = progress.lessons[k] || { d: 0, s: 0, p: 0, at: 0 };
      const bonus = l.p ? 0 : POINTS.lesson;
      l.d = 1; l.p = POINTS.lesson; l.at = now(); l.s = 0;
      progress.lessons[k] = l;
      progress.last = { u: unitId, l: lessonId, s: 0, at: l.at };
      touchStreak();
      emit('lesson');
      return bonus;
    },

    /** Saves a finished mock-exam SUMMARY (synced). Returns the stored summary or null when invalid. */
    recordExam(id, summary) {
      const clean = sanitizeExam(id, summary);
      if (!clean) return null;
      progress.exams = mergeProgress(progress, { ...emptyProgress(), exams: { [id]: clean } }).exams;
      touchStreak();
      emit('exam');
      return progress.exams[id] || null;
    },
    /** Exam summaries, newest first: [{ id, m, at, s, n, d, u, uu? }] */
    examHistory() {
      return Object.entries(progress.exams || {}).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
    },

    markVideo(id) {
      if (progress.videos[id]) return;
      progress.videos[id] = 1;
      emit('video');
    },

    /** Merge a remote/other progress into local (no local timestamp bump). */
    mergeIn(other) {
      const clean = sanitizeProgress(other);
      if (!clean) return;
      progress = mergeProgress(progress, clean);
      emit('merge', { local: false });
    },

    setCode(newCode) {
      const c = normalize(newCode);
      if (!c) return false;
      code = c;
      storage.set(KEYS.code, code);
      for (const fn of listeners) fn('code', { local: false });
      return true;
    },
    newCode() { return api.setCode(generate()); },

    clearLocal() {
      for (const k of Object.values(KEYS)) storage.remove(k);
      save.cancel();
      progress = emptyProgress();
      code = generate();
      storage.set(KEYS.code, code);
      for (const fn of listeners) fn('reset', { local: false });
    },
    flush() { save.flush(); },

    // ---- mastery ----
    lessonStatus(unit, lesson) {
      const k = lessonKey(unit.id, lesson.id);
      const l = progress.lessons[k];
      if (!l) return 'new';
      if (l.d && gradedIn(lesson).every((s) => progress.ex[s.id] && progress.ex[s.id].c)) return 'mastered';
      return 'started';
    },
    unitStats(unit) {
      let mastered = 0, started = 0;
      for (const lesson of unit.lessons) {
        const st = api.lessonStatus(unit, lesson);
        if (st === 'mastered') mastered++;
        else if (st === 'started') started++;
      }
      return { mastered, started, total: unit.lessons.length };
    },
    courseStats(course) {
      let mastered = 0, total = 0;
      for (const u of course.units) { const s = api.unitStats(u); mastered += s.mastered; total += s.total; }
      return { mastered, total };
    },
  };
  return api;
}
