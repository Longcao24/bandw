// Ports every scenario of firmware/tests/gesture_test.cpp to the JS detector used by the sims.
// The spec names sims/lib/detector.js; the sim builder ships the port as sims/_model.js. Use whichever exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const candidates = ['../public/js/sims/lib/detector.js', '../public/js/sims/_model.js'];
const found = candidates.find((p) => existsSync(fileURLToPath(new URL(p, import.meta.url))));
const D = found ? await import(found) : null;
const skip = !D && 'detector port not written yet (sims/lib/detector.js or sims/_model.js)';

const RAD = 57.2957795;
const UINT32_MAX = 0xffffffff;

function setup() {
  const { GestureDetector, Calibrator, GESTURE } = D;
  const G = GESTURE;
  class Rig {
    constructor(start = 0) { this.detector = new GestureDetector(); this.now = start >>> 0; this.events = []; this.detector.calibrate(0, 0, 1, this.now); }
    sample(tilt = 0, gy = 0, magnitude = 1, pitch = 0, tap = false) {
      const r = tilt / RAD, p = pitch / RAD;
      const res = this.detector.update(Math.cos(p) * Math.sin(r) * magnitude, Math.sin(p) * magnitude, Math.cos(p) * Math.cos(r) * magnitude, 0, gy, 0, this.now, tap);
      if (res !== G.None) this.events.push(res);
      this.now = (this.now + 20) >>> 0;
    }
    hold(tilt, ms) { for (let t = 0; t < ms; t += 20) this.sample(tilt); }
    holdPitch(pitch, ms) { this.holdRP(0, pitch, ms); }
    holdRP(tilt, pitch, ms) { for (let t = 0; t < ms; t += 20) this.sample(tilt, 0, 1, pitch); }
    tap() { this.sample(0, 0, 1, 0, true); }
    dip(pitch, ms = 300, gap = 300) { this.holdPitch(pitch, ms); this.holdPitch(0, gap); }
    helpDips(pitch = 40) { this.dip(pitch); this.dip(pitch); }
    rampPitch(to, dps, holdMs) {
      // float32 steps like the C++ rig
      const f = Math.fround; let p = 0; const step = f(dps * 0.02 * (to < 0 ? -1 : 1));
      while (Math.abs(p) < Math.abs(to)) { p = f(p + step); if (Math.abs(p) > Math.abs(to)) p = to; this.sample(0, 0, 1, p); }
      this.holdPitch(to, holdMs);
    }
    neutral() { this.hold(0, 2200); }
  }
  const only = (r, g) => r.events.length === 1 && r.events[0] === g;
  const shake = (r, tapPhase = -1) => {
    for (let phase = 0; phase < 3; ++phase) for (let i = 0; i < 5; ++i) r.sample(0, phase % 2 ? -220 : 220, 1, 0, phase === tapPhase && i === 0);
  };
  return { Rig, G, only, shake, Calibrator };
}

test('WATER / FOOD, held posture never repeats, must return to neutral, shake = NO, shake cannot tilt', { skip }, () => {
  const { Rig, G } = setup();
  const r = new Rig(); r.neutral();
  r.hold(-45, 1600); assert.deepEqual(r.events, [G.Water]);
  r.hold(-45, 3000); assert.equal(r.events.length, 1);
  r.hold(45, 1800); assert.equal(r.events.length, 1);
  r.neutral(); r.hold(45, 1600); assert.equal(r.events.length, 2); assert.equal(r.events[1], G.Food);
  r.neutral();
  for (let i = 0; i < 5; ++i) r.sample(0, 220);
  for (let i = 0; i < 5; ++i) r.sample(0, -220);
  for (let i = 0; i < 5; ++i) r.sample(0, 220);
  assert.equal(r.events.length, 3); assert.equal(r.events[2], G.No);
  r.hold(45, 2000); assert.equal(r.events.length, 3);
});

test('transient / slow / unstable / invalid motion is ignored', { skip }, () => {
  const { Rig } = setup();
  const brief = new Rig(); brief.neutral(); brief.hold(-45, 200); brief.neutral(); assert.equal(brief.events.length, 0);
  const single = new Rig(); single.neutral(); for (let i = 0; i < 15; ++i) single.sample(0, 200); single.neutral(); assert.equal(single.events.length, 0);
  const slow = new Rig(); slow.neutral(); slow.sample(0, 220); slow.hold(0, 1000); slow.sample(0, -220); slow.hold(0, 1000); slow.sample(0, 220); assert.equal(slow.events.length, 0);
  const unstable = new Rig(); unstable.neutral(); for (let i = 0; i < 100; ++i) unstable.sample(45, 0, 1.7); assert.equal(unstable.events.length, 0);
  const invalid = new Rig(); invalid.neutral();
  assert.equal(invalid.detector.update(NaN, 0, 1, 0, 0, 0, invalid.now), 0);
  invalid.hold(45, 1800); assert.equal(invalid.events.length, 0);
});

test('timer rollover, reconnect requires neutral, upright calibration, gentle tilts', { skip }, () => {
  const { Rig, G } = setup();
  const overflow = new Rig(UINT32_MAX - 1000); overflow.neutral(); overflow.hold(45, 1600); assert.deepEqual(overflow.events, [G.Food]);
  const reconnect = new Rig(); reconnect.neutral(); reconnect.detector.disarm(); reconnect.hold(-45, 1800);
  assert.equal(reconnect.events.length, 0); reconnect.neutral(); reconnect.hold(-45, 1500); assert.equal(reconnect.events.length, 1);
  const upright = new Rig(); upright.detector.calibrate(-1, 0, 0, upright.now);
  upright.hold(-90, 1000); upright.hold(-115, 600); assert.deepEqual(upright.events, [G.Water]);
  const gentle = new Rig(); gentle.neutral(); gentle.hold(-25, 600); assert.deepEqual(gentle.events, [G.Water]);
  gentle.neutral(); gentle.hold(25, 600); assert.deepEqual(gentle.events, [G.Water, G.Food]);
});

test('resting tremor ignored; soft shake = NO then re-arm', { skip }, () => {
  const { Rig, G, only } = setup();
  const resting = new Rig(); resting.neutral();
  for (let i = 0; i < 300; ++i) resting.sample(i % 2 ? 10 : -10, i % 2 ? 70 : -70);
  assert.equal(resting.events.length, 0);
  const soft = new Rig(); soft.neutral();
  for (let phase = 0; phase < 3; ++phase) for (let i = 0; i < 5; ++i) soft.sample(0, phase % 2 ? -110 : 110);
  assert.ok(only(soft, G.No));
  soft.hold(25, 1000); assert.equal(soft.events.length, 1);
  soft.hold(0, 500); soft.hold(25, 600); assert.equal(soft.events.length, 2); assert.equal(soft.events[1], G.Food);
});

test('vertical forearm never emits; single gyro spikes are not pulses', { skip }, () => {
  const { Rig } = setup();
  const vertical = new Rig(); vertical.neutral();
  let seed = 12345;
  for (let i = 0; i < 250; ++i) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; const nx = (((seed >>> 16) % 61) - 30) / 1000;
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; const nz = (((seed >>> 16) % 61) - 30) / 1000;
    if (vertical.detector.update(0.02 + nx, 0.998, 0.03 + nz, 0, 0, 0, vertical.now) !== 0) vertical.events.push(0);
    vertical.now = (vertical.now + 20) >>> 0;
  }
  assert.equal(vertical.events.length, 0);
  const spikes = new Rig(); spikes.neutral();
  for (let i = 0; i < 6; ++i) { spikes.sample(0, i % 2 ? -250 : 250); spikes.hold(0, 60); }
  assert.equal(spikes.events.length, 0);
});

test('HELP: two quick forearm dips the same way, either direction; postures and slow/far/mixed dips rejected', { skip }, () => {
  const { Rig, G, only } = setup();
  const help = new Rig(); help.neutral(); help.helpDips(); assert.ok(only(help, G.Help));
  help.helpDips(); help.holdPitch(40, 3000); assert.equal(help.events.length, 1); // must return to neutral first
  const helpUp = new Rig(); helpUp.neutral(); helpUp.helpDips(-40); assert.ok(only(helpUp, G.Help));
  const gentleHelp = new Rig(); gentleHelp.neutral(); gentleHelp.helpDips(30); assert.ok(only(gentleHelp, G.Help));
  const oneDip = new Rig(); oneDip.neutral(); oneDip.dip(40); oneDip.neutral(); assert.equal(oneDip.events.length, 0);
  const swing = new Rig(); swing.neutral(); swing.dip(40); swing.dip(-40); swing.neutral(); assert.equal(swing.events.length, 0);
  const slowDips = new Rig(); slowDips.neutral(); slowDips.dip(40, 1000); slowDips.dip(40, 1000); slowDips.neutral(); assert.equal(slowDips.events.length, 0);
  const farDips = new Rig(); farDips.neutral(); farDips.dip(40, 300, 1800); farDips.dip(40); farDips.neutral(); assert.equal(farDips.events.length, 0);
  const diagonal = new Rig(); diagonal.neutral(); diagonal.holdRP(30, 30, 300); diagonal.neutral(); diagonal.holdRP(30, 30, 300);
  diagonal.neutral(); assert.equal(diagonal.events.length, 0);
  const rollDom = new Rig(); rollDom.neutral(); rollDom.holdRP(-40, 15, 1600); assert.ok(only(rollDom, G.Water));
  const pitchDom = new Rig(); pitchDom.neutral(); for (let i = 0; i < 2; ++i) { pitchDom.holdRP(10, 40, 300); pitchDom.holdRP(0, 0, 300); }
  assert.ok(only(pitchDom, G.Help));
  const rearm = new Rig(); rearm.neutral(); rearm.helpDips(); rearm.hold(-45, 1800);
  assert.ok(only(rearm, G.Help)); rearm.neutral(); rearm.hold(-45, 1600); assert.deepEqual(rearm.events, [G.Help, G.Water]);
  const pitchedRest = new Rig(); pitchedRest.holdPitch(20, 2200); pitchedRest.holdRP(-45, 20, 1600); assert.equal(pitchedRest.events.length, 0);
  for (const p of [30, 40, 50, 60, 85, -30, -40, -50, -60, -85]) {
    const lap = new Rig(); lap.neutral(); lap.rampPitch(p, 100, 3000); assert.equal(lap.events.length, 0, `lap ${p}`);
    const sip = new Rig(); sip.neutral(); sip.rampPitch(p, 100, 1000); sip.rampPitch(0, 100, 600);
    sip.rampPitch(p, 100, 1000); sip.rampPitch(0, 100, 600); assert.equal(sip.events.length, 0, `sip ${p}`);
  }
  for (const [hi, lo] of [[75, 45], [15, 45]]) {
    const pc = new Rig(); pc.detector.calibrate(0, 0.7071, 0.7071, pc.now);
    for (let i = 0; i < 110; ++i) pc.sample(0, 0, 1, 45);
    for (let k = 0; k < 2; ++k) { pc.holdPitch(hi, 300); pc.holdPitch(lo, 300); }
    assert.ok(only(pc, G.Help), `pitched calibration ${hi}`);
  }
});

test('YES: hardware double tap confirmed from neutral; rejected while unarmed / tilted / shaking / rotating', { skip }, () => {
  const { Rig, G, only, shake } = setup();
  const yes = new Rig(); yes.neutral(); yes.tap(); yes.hold(0, 300); assert.ok(only(yes, G.Yes));
  const unarmed = new Rig(); unarmed.tap(); unarmed.hold(0, 300); assert.equal(unarmed.events.length, 0);
  const tilted = new Rig(); tilted.neutral(); tilted.hold(18, 600); tilted.sample(18, 0, 1, 0, true); tilted.hold(18, 300); assert.equal(tilted.events.length, 0);
  const yesShake = new Rig(); yesShake.neutral(); shake(yesShake, 1); yesShake.hold(0, 500); assert.ok(only(yesShake, G.No));
  const tapRotate = new Rig(); tapRotate.neutral(); tapRotate.tap(); for (let i = 0; i < 3; ++i) tapRotate.sample(0, 150);
  tapRotate.hold(0, 300); assert.equal(tapRotate.events.length, 0);
  const rotateTap = new Rig(); rotateTap.neutral(); rotateTap.sample(0, 150); rotateTap.sample(0, 150); rotateTap.hold(0, 100);
  rotateTap.tap(); rotateTap.hold(0, 300); assert.equal(rotateTap.events.length, 0);
  rotateTap.sample(0, 150); rotateTap.sample(0, 150); rotateTap.hold(0, 400);
  rotateTap.tap(); rotateTap.hold(0, 300); assert.ok(only(rotateTap, G.Yes));
  const cd = new Rig(); cd.neutral(); cd.tap(); cd.hold(0, 180); cd.tap(); cd.hold(0, 1000); assert.ok(only(cd, G.Yes));
  cd.tap(); cd.hold(0, 300); assert.deepEqual(cd.events, [G.Yes, G.Yes]);
  const spike = new Rig(); spike.neutral(); spike.tap(); spike.sample(0, 0, 2.5); spike.sample(0, 0, 2.5); spike.hold(0, 1500); assert.ok(only(spike, G.Yes));
  const tapInvalid = new Rig(); tapInvalid.neutral(); tapInvalid.tap();
  tapInvalid.detector.update(NaN, 0, 1, 0, 0, 0, tapInvalid.now); tapInvalid.hold(0, 300); assert.equal(tapInvalid.events.length, 0);
  const tapDisarm = new Rig(); tapDisarm.neutral(); tapDisarm.tap(); tapDisarm.detector.disarm(); tapDisarm.hold(0, 300); assert.equal(tapDisarm.events.length, 0);
  const tapJolt = new Rig(); tapJolt.neutral(); tapJolt.sample(0, 109, 1, 0, true); tapJolt.hold(0, 300); assert.ok(only(tapJolt, G.Yes));
  const firstJolt = new Rig(); firstJolt.neutral(); firstJolt.sample(0, 113); firstJolt.hold(0, 220); firstJolt.tap(); firstJolt.hold(0, 300);
  assert.ok(only(firstJolt, G.Yes));
  const setDown = new Rig(); setDown.neutral(); for (let i = 0; i < 10; ++i) setDown.sample(0, 60); setDown.tap(); setDown.hold(0, 300);
  assert.equal(setDown.events.length, 0);
  const o2 = new Rig(UINT32_MAX - 1000); o2.neutral(); o2.tap(); o2.hold(0, 300); o2.neutral(); o2.helpDips();
  assert.deepEqual(o2.events, [G.Yes, G.Help]);
});

test('Calibrator: 100 steady samples, tolerates jitter, rejects unusable poses', { skip }, () => {
  const { Calibrator } = setup();
  const cal = new Calibrator(); let n = 0;
  for (let i = 0; i < 200 && !cal.add(0.1, 0.2, 0.97, 2, -3, 1); ++i) ++n;
  assert.equal(n, 99); assert.ok(Math.abs(cal.meanY - 0.2) < 1e-4);
  const jitter = new Calibrator(); let done = false; n = 0;
  while (!done && n < 400) { ++n; done = jitter.add(n % 20 ? 0 : 0.2, 0, n % 33 ? 1 : 0.9, n % 45 ? 0 : 40, 0, 0); }
  assert.ok(done && n < 120 && Math.abs(jitter.meanX) < 0.01);
  const upY = new Calibrator(); done = false;
  for (let i = 0; i < 400 && !done; ++i) done = upY.add(0.05, 0.99, 0.05, 0, 0, 0);
  assert.equal(done, false);
  const moving = new Calibrator(); done = false;
  for (let i = 0; i < 400 && !done; ++i) done = moving.add(Math.sin(i * 0.3) * 0.5, 0, 0.85, 0, 60, 0);
  assert.equal(done, false);
});

test('constants match the firmware', { skip }, async () => {
  const { readFileSync } = await import('node:fs');
  const fw = fileURLToPath(new URL('../../firmware/BandW_Sense/GestureDetector.h', import.meta.url));
  if (!existsSync(fw)) return; // khkt/ copied out of the repo
  const h = readFileSync(fw, 'utf8');
  const C = D.C || D.CONSTANTS || D;
  for (const name of ['TILT_ENTER_DEG', 'TILT_EXIT_DEG', 'PITCH_ENTER_DEG', 'PITCH_EXIT_DEG', 'AXIS_MARGIN_DEG', 'MIN_PLANE_G', 'SHAKE_DPS',
    'HOLD_MS', 'DIP_MAX_MS', 'HELP_WINDOW_MS', 'NEUTRAL_MS', 'COOLDOWN_MS', 'TAP_CONFIRM_MS', 'TAP_QUIET_BEFORE_MS', 'TAP_STILL_DPS']) {
    const m = h.match(new RegExp(`\\b${name}\\s*=\\s*([0-9.]+)`));
    assert.ok(m, `${name} không còn trong GestureDetector.h: cần cập nhật bản port JS và nội dung`);
    assert.equal(Number(C[name]), parseFloat(m[1]), name);
  }
});
