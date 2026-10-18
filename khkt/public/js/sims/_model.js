// Mô hình thuật toán dùng chung cho các mô phỏng (sims).
// FAITHFUL JS port of firmware/BandW_Sense/GestureDetector.h (Calibrator + GestureDetector):
// same constants, same order of checks, uint32 time arithmetic. Extra read-only fields
// (`path`, snapshots) exist only so the sims can visualise what the firmware is doing.
// Pure module: no DOM / window access, safe to import in node.

export const C = Object.freeze({
  TILT_SIGN: 1,
  TILT_ENTER_DEG: 22, TILT_EXIT_DEG: 12,
  PITCH_ENTER_DEG: 25, PITCH_EXIT_DEG: 12,
  AXIS_MARGIN_DEG: 8, MIN_PLANE_G: 0.4, SHAKE_DPS: 100,
  HOLD_MS: 250, DIP_MAX_MS: 700, HELP_WINDOW_MS: 2000, NEUTRAL_MS: 200, COOLDOWN_MS: 650,
  TAP_CONFIRM_MS: 150, TAP_QUIET_BEFORE_MS: 300, TAP_STILL_DPS: 50,
  ALPHA: 0.22, SAMPLE_MS: 20,
  CAL_SAMPLES: 100, CAL_MAX_REJECTS: 10,
  SHAKE_WINDOW_MS: 900, SHAKE_GAP_MS: 80, SETTLE_MS: 150, MOTION_DPS: 70, STILL_DPS: 40,
  TAP_GAP_MAX_MS: 538, TAP_THRESHOLD_G: 0.75,
});

export const GESTURE = Object.freeze({ None: 0, Water: 1, Food: 2, No: 3, Yes: 4, Help: 5 });
export const GESTURE_NAME = ['None', 'Water', 'Food', 'No', 'Yes', 'Help'];
export const COMMAND_OF = [null, 'WATER', 'FOOD', 'NO', 'YES', 'HELP'];

export const COMMANDS = Object.freeze({
  WATER: { phrase: 'Tôi muốn uống nước.', label: '← Nghiêng tay trái', color: '#E4EFF9', gesture: 'Nghiêng trái' },
  FOOD: { phrase: 'Tôi muốn ăn.', label: '→ Nghiêng tay phải', color: '#F6EFCF', gesture: 'Nghiêng phải' },
  NO: { phrase: 'Không.', label: '↔ Lắc cổ tay', color: '#FCEAE5', gesture: 'Lắc cổ tay' },
  YES: { phrase: 'Có.', label: '✌ Gõ 2 lần', color: '#E3F2DF', gesture: 'Gõ 2 lần' },
  HELP: { phrase: 'Tôi cần giúp đỡ.', label: '↕ Hạ cẳng tay rồi nâng lại, 2 lần', color: '#F7C6C0', gesture: 'Nhấp cẳng tay 2 lần' },
});
export const CMD_LIST = ['WATER', 'FOOD', 'NO', 'YES', 'HELP'];

const RAD = 57.2957795;
const u32 = (v) => v >>> 0;
const since = (now, t) => u32(now - t);

export function angle(x, z) { return Math.atan2(x, z) * RAD; }
export function wrap(d) {
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
export function pitchAngle(x, y, z) {
  const m = Math.sqrt(x * x + y * y + z * z), s = m > 0 ? y / m : 0;
  return Math.asin(s > 1 ? 1 : s < -1 ? -1 : s) * RAD;
}

export class Calibrator {
  constructor() { this.sx = 0; this.sy = 0; this.sz = 0; this.n = 0; this.rejects = 0; this.meanX = 0; this.meanY = 0; this.meanZ = 0; this.lastResult = ''; }
  static get SAMPLES() { return C.CAL_SAMPLES; }
  static get MAX_REJECTS() { return C.CAL_MAX_REJECTS; }
  reset() { this.sx = this.sy = this.sz = 0; this.n = this.rejects = 0; }
  count() { return this.n; }
  /** Same as firmware. `lastResult` = 'ok' | 'reject' | 'reset' | 'done' (visualisation only). */
  add(x, y, z, gx, gy, gz) {
    const m = Math.sqrt(x * x + y * y + z * z), n = this.n;
    const ok = m > 0.85 && m < 1.15 && Math.sqrt(x * x + z * z) > 0.6
      && Math.abs(gx) < 20 && Math.abs(gy) < 20 && Math.abs(gz) < 20
      && (!n || (Math.abs(x - this.sx / n) < 0.08 && Math.abs(y - this.sy / n) < 0.08 && Math.abs(z - this.sz / n) < 0.08));
    if (!ok) {
      if (++this.rejects > C.CAL_MAX_REJECTS) { this.reset(); this.lastResult = 'reset'; } else this.lastResult = 'reject';
      return false;
    }
    this.sx += x; this.sy += y; this.sz += z;
    if (++this.n < C.CAL_SAMPLES) { this.lastResult = 'ok'; return false; }
    this.meanX = this.sx / this.n; this.meanY = this.sy / this.n; this.meanZ = this.sz / this.n;
    this.reset();
    this.lastResult = 'done';
    return true;
  }
}

export class GestureDetector {
  constructor() {
    this.baseline = 0; this.filtered = 0; this.pitchBaseline = 0; this.filteredPitch = 0;
    this.initialized = false; this.armed = false; this.neutralTiming = false;
    this.neutralAt = 0; this.lastEmission = 0; this.candidateAt = 0;
    this.lastMotion = 0; this.shakeStart = 0; this.pulseAt = 0;
    this.tapAt = 0; this.lastStir = 0; this.dipStart = 0; this.firstDipAt = 0;
    this.candidate = 0; this.shakeSign = 0; this.shakePulses = 0; this.lastSign = 0;
    this.stirRun = 0; this.fastRun = 0; this.dipDir = 0; this.pairDir = 0; this.dips = 0;
    this.cooling = false; this.tapPending = false;
    this.path = 'init'; // which return path update() took (visualisation only)
  }
  emit(result, now) {
    this.armed = false; this.neutralTiming = false; this.cooling = true; this.lastEmission = u32(now);
    this.candidate = 0; this.shakePulses = 0; this.shakeSign = 0; this.lastSign = 0; this.tapPending = false; this.dipDir = this.dips = 0;
    return result;
  }
  calibrate(x, y, z, now) {
    this.baseline = angle(x, z); this.filtered = 0; this.initialized = true;
    this.pitchBaseline = pitchAngle(x, y, z); this.filteredPitch = 0;
    this.armed = false; this.neutralTiming = false; this.cooling = false; this.tapPending = false;
    this.candidate = 0; this.shakePulses = 0; this.shakeSign = 0; this.lastSign = 0; this.lastMotion = u32(now);
    this.lastStir = u32(now - 1000); this.stirRun = this.fastRun = 0; this.dipDir = this.dips = 0;
  }
  disarm() {
    this.armed = false; this.neutralTiming = false; this.candidate = 0; this.shakePulses = this.shakeSign = this.lastSign = 0; this.tapPending = false;
    this.dipDir = this.dips = 0;
  }

  update(x, y, z, gx, gy, gz, now, doubleTap = false) {
    now = u32(now);
    if (!this.initialized) { this.path = 'init'; return GESTURE.None; }
    if (![x, y, z, gx, gy, gz].every(Number.isFinite)) { this.disarm(); this.path = 'nan'; return GESTURE.None; }
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const speed = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const level = Math.sqrt(x * x + z * z) >= C.MIN_PLANE_G;
    if (level) {
      const tilt = C.TILT_SIGN * wrap(angle(x, z) - this.baseline);
      this.filtered += C.ALPHA * wrap(tilt - this.filtered);
      this.filtered = wrap(this.filtered);
    }
    if (magnitude > 0.5 && magnitude < 1.5) this.filteredPitch += C.ALPHA * ((pitchAngle(x, y, z) - this.pitchBaseline) - this.filteredPitch);
    if (speed > 70 || magnitude < 0.8 || magnitude > 1.2) this.lastMotion = now;
    this.stirRun = speed > C.TAP_STILL_DPS ? this.stirRun + 1 : 0;
    this.fastRun = speed > C.SHAKE_DPS ? this.fastRun + 1 : 0;
    if (this.stirRun >= 2) this.lastStir = now;
    if (this.fastRun >= 2) this.tapPending = false;
    if (this.cooling && since(now, this.lastEmission) >= C.COOLDOWN_MS) this.cooling = false;
    const rest = level && Math.abs(this.filtered) < C.TILT_EXIT_DEG && Math.abs(this.filteredPitch) < C.PITCH_EXIT_DEG;
    this.rest = rest; this.level = level; this.magnitude = magnitude; this.speed = speed;
    if (!this.armed) {
      const neutral = !this.cooling && rest && speed < 40 && magnitude > 0.85 && magnitude < 1.15;
      if (neutral) {
        if (!this.neutralTiming) { this.neutralAt = now; this.neutralTiming = true; }
        if (since(now, this.neutralAt) >= C.NEUTRAL_MS) this.armed = true;
      } else this.neutralTiming = false;
      this.path = 'unarmed';
      return GESTURE.None;
    }
    if (this.shakePulses && since(now, this.shakeStart) > 900) { this.shakePulses = 0; this.shakeSign = 0; }
    const sign = gy > C.SHAKE_DPS ? 1 : gy < -C.SHAKE_DPS ? -1 : 0;
    const sustained = sign && sign === this.lastSign;
    this.lastSign = sign;
    if (sustained && sign !== this.shakeSign && (!this.shakePulses || since(now, this.pulseAt) >= 80)) {
      if (!this.shakePulses) this.shakeStart = now;
      this.shakeSign = sign; this.pulseAt = now; ++this.shakePulses;
      if (this.shakePulses >= 3) { this.path = 'shake'; return this.emit(GESTURE.No, now); }
    }
    if (doubleTap && !this.tapPending && rest && since(now, this.lastStir) >= C.TAP_QUIET_BEFORE_MS) {
      this.tapPending = true; this.tapAt = now;
    }
    if (this.tapPending && since(now, this.tapAt) >= C.TAP_CONFIRM_MS) {
      this.tapPending = false;
      if (rest) { this.path = 'tap'; return this.emit(GESTURE.Yes, now); }
    }
    // HELP = two quick forearm dips the same way (each ≤ DIP_MAX_MS, both within HELP_WINDOW_MS).
    const roll = Math.abs(this.filtered), pitch = Math.abs(this.filteredPitch);
    if (this.dips && since(now, this.firstDipAt) > C.HELP_WINDOW_MS) this.dips = 0;
    if (!this.dipDir) {
      if (pitch > C.PITCH_ENTER_DEG && pitch >= roll + C.AXIS_MARGIN_DEG) {
        this.dipDir = this.filteredPitch < 0 ? -1 : 1; this.dipStart = now;
        if (this.dips && this.dipDir !== this.pairDir) this.dips = 0;
      }
    } else if (pitch < C.PITCH_EXIT_DEG) {
      if (since(now, this.dipStart) > C.DIP_MAX_MS) this.dips = 0;
      else {
        if (!this.dips) { this.firstDipAt = this.dipStart; this.pairDir = this.dipDir; }
        if (++this.dips >= 2) { this.path = 'help'; return this.emit(GESTURE.Help, now); }
      }
      this.dipDir = 0;
    } else if (since(now, this.dipStart) > C.DIP_MAX_MS) this.dips = 0;
    if (this.tapPending || !level || since(now, this.lastMotion) < 150 || magnitude < 0.85 || magnitude > 1.15) {
      this.candidate = 0; this.path = 'settle'; return GESTURE.None;
    }
    const direction = roll > C.TILT_ENTER_DEG && roll >= pitch + C.AXIS_MARGIN_DEG ? (this.filtered < 0 ? -1 : 1) : 0;
    if (!direction) { this.candidate = 0; this.path = 'nodir'; return GESTURE.None; }
    if (this.candidate !== direction) { this.candidate = direction; this.candidateAt = now; }
    if (since(now, this.candidateAt) >= C.HOLD_MS) {
      this.path = 'hold-emit';
      return this.emit(direction < 0 ? GESTURE.Water : GESTURE.Food, now);
    }
    this.path = 'hold';
    return GESTURE.None;
  }
  snapshot() {
    return {
      filtered: this.filtered, filteredPitch: this.filteredPitch, armed: this.armed, cooling: this.cooling,
      candidate: this.candidate, candidateAt: this.candidateAt, neutralTiming: this.neutralTiming, neutralAt: this.neutralAt,
      shakePulses: this.shakePulses, shakeStart: this.shakeStart, pulseAt: this.pulseAt, shakeSign: this.shakeSign,
      tapPending: this.tapPending, tapAt: this.tapAt, lastMotion: this.lastMotion, lastStir: this.lastStir,
      dips: this.dips, dipDir: this.dipDir, dipStart: this.dipStart, firstDipAt: this.firstDipAt,
      lastEmission: this.lastEmission, rest: !!this.rest, level: this.level !== false, path: this.path,
    };
  }
}

// ---------- deterministic synthetic signals (20 ms step, seeded) ----------

export function rng(seed = 1) {
  let a = (typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) : seed) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pose (roll, pitch in degrees, magnitude in g) → accelerometer x, y, z exactly like gesture_test.cpp's Rig. */
export function poseToAccel(roll, pitch, mag = 1) {
  const r = roll / RAD, p = pitch / RAD;
  return { x: Math.cos(p) * Math.sin(r) * mag, y: Math.sin(p) * mag, z: Math.cos(p) * Math.cos(r) * mag };
}

/**
 * Build samples from segments. Pose carries over between segments.
 *  { hold: ms, roll?, pitch?, mag? }   stay still
 *  { move: ms, roll?, pitch? }          linear ramp; gyro = rotation rate (roll → gy, pitch → gx)
 *  { gy: dps, n: samples }               fast rotation samples at the current pose (shake/jolt)
 *  { shake: { amp=220, n=5, phases=3, gapN=0, sign=1 } }
 *  { tap: true }                          one sample with the hardware double-tap flag
 *  { wobble: ms, amp, periodMs, center? } roll oscillation (rest/tremor), gyro follows
 *  { walk: ms }                            walking: |a| bumps + gyro sway
 */
export function makeSignal(segments, { seed = 7, noise = 1, start = 1000 } = {}) {
  const rand = rng(seed);
  const n = () => (rand() * 2 - 1) * noise;
  const out = [];
  let t = start, roll = 0, pitch = 0, mag = 1;
  const push = (o) => {
    const r = roll + (o.dr || 0) + n() * 0.4, p = pitch + (o.dp || 0) + n() * 0.4, m = (o.mag ?? mag) + n() * 0.004;
    const a = poseToAccel(r, p, m);
    out.push({ t: t >>> 0, ...a, gx: (o.gx || 0) + n() * 2, gy: (o.gy || 0) + n() * 2, gz: (o.gz || 0) + n() * 1.5, tap: !!o.tap, roll: r, pitch: p, mag: m, tag: o.tag || '' });
    t += C.SAMPLE_MS;
  };
  for (const s of segments) {
    if (s.hold != null) {
      if (s.roll != null) roll = s.roll; if (s.pitch != null) pitch = s.pitch; if (s.mag != null) mag = s.mag;
      for (let k = 0; k < Math.round(s.hold / 20); k++) push({ tag: s.tag });
      mag = 1;
    } else if (s.move != null) {
      const steps = Math.max(1, Math.round(s.move / 20));
      const r0 = roll, p0 = pitch, r1 = s.roll ?? roll, p1 = s.pitch ?? pitch;
      const gy = (r1 - r0) / (s.move / 1000), gx = (p1 - p0) / (s.move / 1000);
      for (let k = 1; k <= steps; k++) { roll = r0 + (r1 - r0) * k / steps; pitch = p0 + (p1 - p0) * k / steps; push({ gx, gy, tag: s.tag || 'move' }); }
    } else if (s.gy != null) {
      for (let k = 0; k < (s.n || 1); k++) push({ gy: s.gy, tag: s.tag || 'rot' });
    } else if (s.shake) {
      const { amp = 220, n: per = 5, phases = 3, sign = 1, tapPhase = -1 } = s.shake;
      for (let ph = 0; ph < phases; ph++) for (let i = 0; i < per; i++) {
        const sgn = (ph % 2 ? -1 : 1) * sign;
        // small visible sway of the hand: integrate gy into a displayed roll offset (does not feed the tilt check much)
        const shape = Math.sin(Math.PI * (i + 0.5) / per);
        push({ gy: sgn * amp * (0.75 + 0.25 * shape), dr: sgn * 6 * shape, tap: ph === tapPhase && i === 0, tag: 'shake' });
      }
    } else if (s.tap) {
      push({ tap: true, tag: 'tap' });
    } else if (s.wobble != null) {
      const steps = Math.round(s.wobble / 20), c = s.center ?? roll, A = s.amp ?? 4, P = s.periodMs ?? 600;
      for (let k = 0; k < steps; k++) {
        const ph = 2 * Math.PI * (k * 20) / P;
        roll = c + A * Math.sin(ph);
        push({ gy: A * (2 * Math.PI / (P / 1000)) * Math.cos(ph), tag: s.tag || 'wobble' });
      }
      roll = c;
    } else if (s.walk != null) {
      const steps = Math.round(s.walk / 20);
      for (let k = 0; k < steps; k++) {
        const ph = 2 * Math.PI * (k * 20) / 520;
        roll = 9 * Math.sin(ph / 2);
        push({ mag: 1 + 0.32 * Math.sin(ph) + 0.05 * Math.sin(3 * ph), gy: 9 * Math.PI / 0.52 * Math.cos(ph / 2), gx: 50 * Math.sin(ph + 1), tag: 'walk' });
      }
      roll = 0;
    }
  }
  return out;
}

const MOVE_MS = (deg) => Math.max(200, Math.round(Math.abs(deg) / 80 * 1000 / 20) * 20); // ≈80 °/s: a calm, deliberate move

/** Ready-made scenarios (all begin with a calm neutral wrist). */
export const PRESETS = {
  rest: () => [{ hold: 600 }, { wobble: 3200, amp: 3, periodMs: 900 }, { hold: 400 }],
  walk: () => [{ hold: 400 }, { walk: 3600 }, { hold: 400 }],
  water: () => [{ hold: 500 }, { move: MOVE_MS(40), roll: -40 }, { hold: 900 }, { move: MOVE_MS(40), roll: 0 }, { hold: 900 }],
  food: () => [{ hold: 500 }, { move: MOVE_MS(40), roll: 40 }, { hold: 900 }, { move: MOVE_MS(40), roll: 0 }, { hold: 900 }],
  // HELP: two quick forearm dips (out ≈40° and back), like gesture_test.cpp's helpDips().
  help: () => [{ hold: 500 }, { move: 160, pitch: 40 }, { hold: 200 }, { move: 160, pitch: 0 }, { hold: 240 }, { move: 160, pitch: 40 }, { hold: 200 }, { move: 160, pitch: 0 }, { hold: 900 }],
  no: () => [{ hold: 600 }, { shake: { amp: 220, n: 5, phases: 3 } }, { hold: 1200 }],
  yes: () => [{ hold: 600 }, { hold: 240 }, { tap: true }, { hold: 1300 }],
  flick: () => [{ hold: 500 }, { move: 360, roll: -32 }, { hold: 300 }, { move: 360, roll: 0 }, { hold: 900 }],
  'held-no-repeat': () => [{ hold: 500 }, { move: MOVE_MS(40), roll: -40 }, { hold: 2400 }, { move: MOVE_MS(40), roll: 0 }, { hold: 700 }],
  // Only one dip: not HELP. Then a held posture (forearm lowered onto the lap): never HELP.
  'help-short': () => [{ hold: 500 }, { move: 160, pitch: 40 }, { hold: 200 }, { move: 160, pitch: 0 }, { hold: 900 }, { move: MOVE_MS(40), pitch: 40 }, { hold: 1500 }, { move: MOVE_MS(40), pitch: 0 }, { hold: 700 }],
};
PRESETS.all = () => [
  { hold: 600 }, { move: 500, roll: -40 }, { hold: 800 }, { move: 500, roll: 0 }, { hold: 900 },
  { move: 500, roll: 40 }, { hold: 800 }, { move: 500, roll: 0 }, { hold: 900 },
  { shake: { amp: 220, n: 5, phases: 3 } }, { hold: 1200 },
  { hold: 200 }, { tap: true }, { hold: 1200 },
  { move: 160, pitch: 40 }, { hold: 200 }, { move: 160, pitch: 0 }, { hold: 240 }, { move: 160, pitch: 40 }, { hold: 200 }, { move: 160, pitch: 0 }, { hold: 800 },
];

/** Feed samples into a freshly calibrated detector; returns per-sample snapshots + events. */
export function runTrace(samples, { calib = [0, 0, 1], disarmAt = -1 } = {}) {
  const det = new GestureDetector();
  const t0 = samples.length ? samples[0].t - 20 : 0;
  det.calibrate(calib[0], calib[1], calib[2], t0);
  const rows = [], events = [];
  samples.forEach((s, i) => {
    if (i === disarmAt) det.disarm();
    const g = det.update(s.x, s.y, s.z, s.gx, s.gy, s.gz, s.t, s.tap);
    const snap = det.snapshot();
    const cmd = COMMAND_OF[g];
    const state = g ? 'EMIT' : snap.cooling ? 'COOLDOWN' : !snap.armed ? 'NEUTRAL' : snap.candidate ? 'CANDIDATE' : 'ARMED';
    const row = { ...s, i, ...snap, event: g, command: cmd, state };
    rows.push(row);
    if (g) events.push({ i, t: s.t, command: cmd });
  });
  return { rows, events, t0: samples.length ? samples[0].t : 0, t1: samples.length ? samples[samples.length - 1].t : 0 };
}

export function presetTrace(name, opts = {}) {
  const f = PRESETS[name] || PRESETS.water;
  return runTrace(makeSignal(f(), { seed: opts.seed ?? (name.length * 31 + 5), noise: opts.noise ?? 1 }), opts);
}

/** Index of the sample at/just before time t (ms) in rows (binary search). */
export function rowAt(rows, t) {
  let lo = 0, hi = rows.length - 1;
  if (!rows.length) return -1;
  if (t <= rows[0].t) return 0;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (rows[mid].t <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

/** First index ≥ from where pred(row) holds, or -1. */
export function findRow(rows, pred, from = 0) {
  for (let i = Math.max(0, from); i < rows.length; i++) if (pred(rows[i], i)) return i;
  return -1;
}

/**
 * Split rows into contiguous segments by key(row). Segments shorter than minRows are merged into
 * the previous one unless keep(key) is true. Returns [{key, i0, i1, t0, t1}].
 */
export function segments(rows, key, { minRows = 3, keep = () => false } = {}) {
  const out = [];
  rows.forEach((r, i) => {
    const k = key(r, i), last = out[out.length - 1];
    if (last && last.key === k) { last.i1 = i; last.t1 = r.t; }
    else out.push({ key: k, i0: i, i1: i, t0: r.t, t1: r.t });
  });
  // merge tiny flickers
  for (let j = out.length - 1; j > 0; j--) {
    const sgm = out[j];
    if (sgm.i1 - sgm.i0 + 1 < minRows && !keep(sgm.key)) {
      const prev = out[j - 1]; prev.i1 = sgm.i1; prev.t1 = sgm.t1; out.splice(j, 1);
      if (out[j] && out[j].key === prev.key) { prev.i1 = out[j].i1; prev.t1 = out[j].t1; out.splice(j, 1); }
    }
  }
  return out;
}

/** Give repeated ids suffixes: neutral, armed, …, neutral2, armed2. */
export function uniqueIds(list) {
  const seen = {};
  return list.map((id) => { seen[id] = (seen[id] || 0) + 1; return seen[id] === 1 ? id : `${id}${seen[id]}`; });
}
