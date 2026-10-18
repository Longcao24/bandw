// Sims: every module imports in node (no DOM at top level), exports meta + mount;
// the shared detector port (sims/_model.js) reproduces firmware/tests/gesture_test.cpp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SIMS = [
  'system-flow', 'imu-axes-3d', 'tilt-angle', 'gyro-speed', 'calibration',
  'threshold-hysteresis', 'hold-timer', 'gesture-state-machine', 'shake-counter',
  'double-tap', 'forward-flex', 'main-loop', 'code-stepper', 'ble-flow',
  'tts-pipeline', 'confusion-matrix', 'imu-chart', 'gesture-gallery',
];
const dir = new URL('../public/js/sims/', import.meta.url);

test('shared helpers import without a DOM', async () => {
  const sh = await import(new URL('_shared.js', dir));
  assert.equal(typeof sh.Timeline, 'function');
  assert.equal(sh.fmt(-1.5, 1), '−1,5');
  assert.deepEqual(sh.asciiBytes('WATER'), ['57', '41', '54', '45', '52']);
});

for (const id of SIMS) {
  test(`sim ${id}: module shape`, async () => {
    const file = new URL(`${id}.js`, dir);
    assert.ok(existsSync(fileURLToPath(file)), `${id}.js exists`);
    const mod = await import(file);
    assert.equal(typeof mod.mount, 'function', 'exports mount');
    assert.equal(mod.meta.id, id, 'meta.id matches file name');
    assert.equal(typeof mod.meta.title, 'string');
    assert.equal(typeof mod.meta.timeline, 'boolean');
    assert.ok(Array.isArray(mod.meta.checkpoints));
    assert.ok(Array.isArray(mod.meta.hotspots));
    for (const h of mod.meta.hotspots) assert.ok(h.id && h.label, `hotspot ${JSON.stringify(h)}`);
    assert.equal(new Set(mod.meta.hotspots.map((h) => h.id)).size, mod.meta.hotspots.length, 'unique hotspot ids');
    if (mod.meta.timeline) assert.ok(mod.meta.checkpoints.includes('end'), 'timeline sims expose "end"');
    assert.equal(typeof mod.meta.defaults, 'object');
  });
}

test('registry (if present) lists exactly these sims', async () => {
  const reg = new URL('registry.js', dir);
  if (!existsSync(fileURLToPath(reg))) return;
  const { SIM_IDS } = await import(reg);
  assert.deepEqual([...SIM_IDS].sort(), [...SIMS].sort());
});

// ---- detector port vs firmware/tests/gesture_test.cpp ----
const M = await import(new URL('_model.js', dir));
const { GestureDetector, Calibrator, GESTURE: G } = M;
class Rig {
  constructor(start = 0) { this.d = new GestureDetector(); this.now = start >>> 0; this.events = []; this.d.calibrate(0, 0, 1, this.now); }
  sample(tilt = 0, gy = 0, mag = 1, pitch = 0, tap = false) {
    const r = tilt / 57.2957795, p = pitch / 57.2957795;
    const g = this.d.update(Math.cos(p) * Math.sin(r) * mag, Math.sin(p) * mag, Math.cos(p) * Math.cos(r) * mag, 0, gy, 0, this.now, tap);
    if (g) this.events.push(g);
    this.now = (this.now + 20) >>> 0;
  }
  hold(tilt, ms) { for (let t = 0; t < ms; t += 20) this.sample(tilt); }
  holdRP(tilt, pitch, ms) { for (let t = 0; t < ms; t += 20) this.sample(tilt, 0, 1, pitch); }
  holdPitch(p, ms) { this.holdRP(0, p, ms); }
  tap() { this.sample(0, 0, 1, 0, true); }
  neutral() { this.hold(0, 2200); }
}
const only = (r, g) => r.events.length === 1 && r.events[0] === g;
const shake = (r, tapPhase = -1) => { for (let ph = 0; ph < 3; ph++) for (let i = 0; i < 5; i++) r.sample(0, ph % 2 ? -220 : 220, 1, 0, ph === tapPhase && i === 0); };

test('detector: left/right, hold, neutral rearm, shake priority', () => {
  const r = new Rig(); r.neutral();
  r.hold(-45, 1600); assert.deepEqual(r.events, [G.Water]);
  r.hold(-45, 3000); assert.equal(r.events.length, 1);
  r.hold(45, 1800); assert.equal(r.events.length, 1);
  r.neutral(); r.hold(45, 1600); assert.equal(r.events[1], G.Food);
  r.neutral();
  for (let i = 0; i < 5; i++) r.sample(0, 220);
  for (let i = 0; i < 5; i++) r.sample(0, -220);
  for (let i = 0; i < 5; i++) r.sample(0, 220);
  assert.equal(r.events.length, 3); assert.equal(r.events[2], G.No);
  r.hold(45, 2000); assert.equal(r.events.length, 3);
});

test('detector: transient, slow, unstable, invalid, overflow, reconnect, upright, gentle', () => {
  const brief = new Rig(); brief.neutral(); brief.hold(-45, 200); brief.neutral(); assert.equal(brief.events.length, 0);
  const single = new Rig(); single.neutral(); for (let i = 0; i < 15; i++) single.sample(0, 200); single.neutral(); assert.equal(single.events.length, 0);
  const slow = new Rig(); slow.neutral(); slow.sample(0, 220); slow.hold(0, 1000); slow.sample(0, -220); slow.hold(0, 1000); slow.sample(0, 220); assert.equal(slow.events.length, 0);
  const unstable = new Rig(); unstable.neutral(); for (let i = 0; i < 100; i++) unstable.sample(45, 0, 1.7); assert.equal(unstable.events.length, 0);
  const invalid = new Rig(); invalid.neutral(); assert.equal(invalid.d.update(NaN, 0, 1, 0, 0, 0, invalid.now), G.None); invalid.hold(45, 1800); assert.equal(invalid.events.length, 0);
  const overflow = new Rig(0xFFFFFFFF - 1000); overflow.neutral(); overflow.hold(45, 1600); assert.ok(only(overflow, G.Food));
  const rc = new Rig(); rc.neutral(); rc.d.disarm(); rc.hold(-45, 1800); assert.equal(rc.events.length, 0); rc.neutral(); rc.hold(-45, 1500); assert.equal(rc.events.length, 1);
  const up = new Rig(); up.d.calibrate(-1, 0, 0, up.now); up.hold(-90, 1000); up.hold(-115, 600); assert.ok(only(up, G.Water));
  const gentle = new Rig(); gentle.neutral(); gentle.hold(-25, 600); assert.ok(only(gentle, G.Water)); gentle.neutral(); gentle.hold(25, 600); assert.equal(gentle.events[1], G.Food);
  const resting = new Rig(); resting.neutral(); for (let i = 0; i < 300; i++) resting.sample(i % 2 ? 10 : -10, i % 2 ? 70 : -70); assert.equal(resting.events.length, 0);
  const soft = new Rig(); soft.neutral(); for (let ph = 0; ph < 3; ph++) for (let i = 0; i < 5; i++) soft.sample(0, ph % 2 ? -110 : 110); assert.ok(only(soft, G.No));
  soft.hold(25, 1000); assert.equal(soft.events.length, 1); soft.hold(0, 500); soft.hold(25, 600); assert.equal(soft.events[1], G.Food);
  const spikes = new Rig(); spikes.neutral(); for (let i = 0; i < 6; i++) { spikes.sample(0, i % 2 ? -250 : 250); spikes.hold(0, 60); } assert.equal(spikes.events.length, 0);
});

test('detector: HELP (two quick forearm dips) and axis margin', () => {
  const dip = (r, p, ms = 300, gap = 300) => { r.holdPitch(p, ms); r.holdPitch(0, gap); };
  const help = new Rig(); help.neutral(); dip(help, 40); dip(help, 40); assert.ok(only(help, G.Help));
  help.holdPitch(40, 3000); assert.equal(help.events.length, 1);
  const up = new Rig(); up.neutral(); dip(up, -40); dip(up, -40); assert.ok(only(up, G.Help));
  const one = new Rig(); one.neutral(); dip(one, 40); one.neutral(); assert.equal(one.events.length, 0);
  const swing = new Rig(); swing.neutral(); dip(swing, 40); dip(swing, -40); swing.neutral(); assert.equal(swing.events.length, 0);
  const slow = new Rig(); slow.neutral(); dip(slow, 40, 1000); dip(slow, 40, 1000); slow.neutral(); assert.equal(slow.events.length, 0);
  const held = new Rig(); held.neutral(); held.holdPitch(40, 3000); assert.equal(held.events.length, 0);
  const diag = new Rig(); diag.neutral(); diag.holdRP(30, 30, 300); diag.neutral(); diag.holdRP(30, 30, 300); diag.neutral(); assert.equal(diag.events.length, 0);
  const rd = new Rig(); rd.neutral(); rd.holdRP(-40, 15, 1600); assert.ok(only(rd, G.Water));
  const pd = new Rig(); pd.neutral(); for (let i = 0; i < 2; i++) { pd.holdRP(10, 40, 300); pd.holdRP(0, 0, 300); } assert.ok(only(pd, G.Help));
});

test('detector: YES (double tap) needs rest and a quiet window', () => {
  const yes = new Rig(); yes.neutral(); yes.tap(); yes.hold(0, 300); assert.ok(only(yes, G.Yes));
  const unarmed = new Rig(); unarmed.tap(); unarmed.hold(0, 300); assert.equal(unarmed.events.length, 0);
  const tilted = new Rig(); tilted.neutral(); tilted.hold(18, 600); tilted.sample(18, 0, 1, 0, true); tilted.hold(18, 300); assert.equal(tilted.events.length, 0);
  const ys = new Rig(); ys.neutral(); shake(ys, 1); ys.hold(0, 500); assert.ok(only(ys, G.No));
  const tr = new Rig(); tr.neutral(); tr.tap(); for (let i = 0; i < 3; i++) tr.sample(0, 150); tr.hold(0, 300); assert.equal(tr.events.length, 0);
  const rt = new Rig(); rt.neutral(); rt.sample(0, 150); rt.sample(0, 150); rt.hold(0, 100); rt.tap(); rt.hold(0, 300); assert.equal(rt.events.length, 0);
  rt.sample(0, 150); rt.sample(0, 150); rt.hold(0, 400); rt.tap(); rt.hold(0, 300); assert.ok(only(rt, G.Yes));
});

test('calibrator: tolerant of a few rejects, refuses an unusable pose', () => {
  const cal = new Calibrator(); let n = 0;
  for (let i = 0; i < 200 && !cal.add(0.1, 0.2, 0.97, 2, -3, 1); ++i) ++n;
  assert.equal(n, 99); assert.ok(Math.abs(cal.meanY - 0.2) < 1e-4);
  const j = new Calibrator(); let done = false; n = 0;
  while (!done && n < 400) { ++n; done = j.add(n % 20 ? 0 : 0.2, 0, n % 33 ? 1 : 0.9, n % 45 ? 0 : 40, 0, 0); }
  assert.ok(done && n < 120 && Math.abs(j.meanX) < 0.01);
  const upY = new Calibrator(); done = false; for (let i = 0; i < 400 && !done; ++i) done = upY.add(0.05, 0.99, 0.05, 0, 0, 0); assert.equal(done, false);
});

test('sim presets produce the expected commands', () => {
  const expect = { water: ['WATER'], food: ['FOOD'], help: ['HELP'], no: ['NO'], yes: ['YES'], flick: [], rest: [], walk: [], 'held-no-repeat': ['WATER'], all: ['WATER', 'FOOD', 'NO', 'YES', 'HELP'] };
  for (const [k, v] of Object.entries(expect)) assert.deepEqual(M.presetTrace(k).events.map((e) => e.command), v, k);
});
