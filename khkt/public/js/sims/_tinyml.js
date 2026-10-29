// Tiny ML lab shared by the tinyml-* sims: synthetic labeled gesture windows (from the detector port's
// signal generator), hand-picked features, a single-layer softmax model trained by gradient descent,
// and int8 quantization. Deterministic (seeded) and DOM-free, so tests can run it in node.
// The data is SYNTHETIC: it teaches the workflow, it is not a measurement of BandW on real wrists.
import { makeSignal, rng, C } from './_model.js';

export const RATE_HZ = 1000 / C.SAMPLE_MS;   // 50 samples per second, like the firmware loop
export const WINDOW = 75;                     // 1.5 s window
export const AXES = 6;                        // ax ay az gx gy gz
export const CLASSES = ['NONE', 'WATER', 'FOOD', 'NO', 'HELP'];
export const CLASS_LABEL = { NONE: 'Không làm gì', WATER: 'WATER', FOOD: 'FOOD', NO: 'NO', HELP: 'HELP' };
export const NONE_KINDS = ['rest', 'walk', 'flick', 'one-dip', 'raise'];

const SD = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

export const FEATURES = [
  { id: 'x_mean', label: 'ax trung bình', hint: 'nghiêng trái (âm) hay phải (dương)' },
  { id: 'x_min', label: 'ax nhỏ nhất', hint: 'nghiêng trái sâu nhất' },
  { id: 'x_max', label: 'ax lớn nhất', hint: 'nghiêng phải sâu nhất' },
  { id: 'y_mean', label: 'ay trung bình', hint: 'cẳng tay chúc xuống bao lâu' },
  { id: 'y_max', label: 'ay lớn nhất', hint: 'lần chúc sâu nhất' },
  { id: 'y_sd', label: 'ay dao động', hint: 'chúc lên xuống nhiều hay ít' },
  { id: 'gy_sd', label: 'gy dao động', hint: 'xoay cổ tay nhanh (lắc)' },
  { id: 'gx_sd', label: 'gx dao động', hint: 'gập cẳng tay nhanh' },
  { id: 'mag_sd', label: '|a| dao động', hint: 'rung xóc khi đi bộ' },
];

/** 9 features from one window of samples {x,y,z,gx,gy,gz}. */
export function features(win) {
  const x = win.map((p) => p.x), y = win.map((p) => p.y);
  const gy = win.map((p) => p.gy), gx = win.map((p) => p.gx);
  const mag = win.map((p) => Math.hypot(p.x, p.y, p.z));
  const my = mean(y);
  return [
    mean(x), Math.min(...x), Math.max(...x),
    my, Math.max(...y), SD(y, my),
    SD(gy, mean(gy)) / 100, SD(gx, mean(gx)) / 100, SD(mag, mean(mag)) * 10,
  ];
}

// A "person" = how big, how fast, and how calibrated their gestures are.
export function person(seed) {
  const r = rng(`person-${seed}`);
  return { amp: 0.6 + 0.8 * r(), speed: 0.7 + 0.7 * r(), offset: (r() * 2 - 1) * 12, noise: 0.8 + 1.4 * r() };
}

const ms = (v) => Math.max(20, Math.round(v / 20) * 20);

/** Segments for one gesture of `label` by person `p`, with per-take jitter from `r`. */
function segmentsFor(label, p, r, kind) {
  const j = (a, b) => a + (b - a) * r();
  const sp = p.speed, lead = { hold: ms(j(60, 320)), roll: p.offset, pitch: 0 };
  switch (label) {
    case 'WATER':
    case 'FOOD': {
      const deg = (label === 'WATER' ? -1 : 1) * j(28, 48) * p.amp + p.offset, mv = ms(j(260, 480) / sp);
      return [lead, { move: mv, roll: deg }, { hold: ms(j(350, 700)) }, { move: mv, roll: p.offset }, { hold: 400 }];
    }
    case 'NO':
      return [lead, { shake: { amp: j(170, 260) * p.amp, n: Math.round(j(4, 6.4) / sp), phases: 3, sign: r() < 0.5 ? 1 : -1 } }, { hold: 600 }];
    case 'HELP': {
      const d = j(30, 44) * p.amp, mv = ms(j(130, 200) / sp), top = ms(j(120, 240)), gap = ms(j(160, 320));
      return [lead, { move: mv, pitch: d }, { hold: top }, { move: mv, pitch: 0 }, { hold: gap },
        { move: mv, pitch: d }, { hold: top }, { move: mv, pitch: 0 }, { hold: 500 }];
    }
    default: {
      if (kind === 'walk') return [{ hold: ms(j(40, 200)) }, { walk: 1600 }];
      if (kind === 'flick') { const deg = (r() < 0.5 ? -1 : 1) * j(10, 19); return [lead, { move: ms(j(240, 400)), roll: deg }, { hold: ms(j(100, 300)) }, { move: ms(j(240, 400)), roll: p.offset }, { hold: 600 }]; }
      if (kind === 'one-dip') { const d = j(30, 44) * p.amp, mv = ms(j(130, 200)); return [lead, { move: mv, pitch: d }, { hold: ms(j(120, 240)) }, { move: mv, pitch: 0 }, { hold: 900 }]; }
      if (kind === 'raise') return [lead, { move: ms(j(500, 800)), pitch: j(18, 40) }, { hold: 1200 }];
      return [{ hold: 100, roll: p.offset }, { wobble: 1600, amp: j(2, 5), periodMs: j(500, 1100) }];
    }
  }
}

/** One labeled window: {label, kind, person, x: features, win: samples}. */
export function sample(label, personSeed, take) {
  const r = rng(`${label}-${personSeed}-${take}`);
  const kind = label === 'NONE' ? NONE_KINDS[take % NONE_KINDS.length] : label;
  const p = person(personSeed);
  const sig = makeSignal(segmentsFor(label, p, r, kind), { seed: Math.floor(r() * 1e9), noise: p.noise });
  const win = sig.slice(0, WINDOW);
  while (win.length < WINDOW) win.push({ ...win[win.length - 1] });
  return { label, y: CLASSES.indexOf(label), kind, person: personSeed, x: features(win), win };
}

/** perClass takes for each class from each person in `people`. */
export function dataset(people, perClass) {
  const out = [];
  for (const ps of people) for (const label of CLASSES) for (let k = 0; k < perClass; k++) out.push(sample(label, ps, k));
  return out;
}

/**
 * Softmax regression (one layer of 5 neurons, each = weighted sum of the 9 features + bias).
 * Features are standardised with the training set's mean/sd, which become part of the model.
 */
export function train(data, { epochs = 300, lr = 0.5, l2 = 1e-3 } = {}) {
  const F = FEATURES.length, K = CLASSES.length, n = data.length;
  const mu = Array.from({ length: F }, (_, i) => mean(data.map((d) => d.x[i])));
  const sd = Array.from({ length: F }, (_, i) => SD(data.map((d) => d.x[i]), mu[i]) || 1);
  const X = data.map((d) => d.x.map((v, i) => (v - mu[i]) / sd[i]));
  const W = Array.from({ length: K }, () => new Array(F).fill(0)), b = new Array(K).fill(0);
  for (let e = 0; e < epochs; e++) {
    const gW = Array.from({ length: K }, () => new Array(F).fill(0)), gb = new Array(K).fill(0);
    let loss = 0;
    X.forEach((xi, k) => {
      const p = softmax(W.map((w, c) => dot(w, xi) + b[c]));
      loss -= Math.log(Math.max(1e-9, p[data[k].y]));
      for (let c = 0; c < K; c++) { const g = p[c] - (c === data[k].y ? 1 : 0); gb[c] += g; for (let i = 0; i < F; i++) gW[c][i] += g * xi[i]; }
    });
    for (let c = 0; c < K; c++) { b[c] -= lr * gb[c] / n; for (let i = 0; i < F; i++) W[c][i] -= lr * (gW[c][i] / n + l2 * W[c][i]); }
  }
  return { W, b, mu, sd };
}

export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export function softmax(z) {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, v) => a + v, 0);
  return e.map((v) => v / s);
}

/** Probabilities for raw features x. */
export function predict(model, x) {
  const xs = x.map((v, i) => (v - model.mu[i]) / model.sd[i]);
  return softmax(model.W.map((w, c) => dot(w, xs) + model.b[c]));
}

/** Decision with a confidence threshold: below it, the band stays silent (NONE). */
export function decide(probs, threshold = 0.8) {
  let best = 0; probs.forEach((p, i) => { if (p > probs[best]) best = i; });
  return { index: best, label: CLASSES[best], confidence: probs[best], fire: best !== 0 && probs[best] >= threshold };
}

/** int8 weights: one scale per layer, w ≈ q × scale with q in −127..127. Returns a model usable by predict(). */
export function quantize(model) {
  const all = model.W.flat();
  const scale = Math.max(...all.map(Math.abs)) / 127 || 1;
  const q = model.W.map((w) => w.map((v) => Math.max(-127, Math.min(127, Math.round(v / scale)))));
  return { ...model, W: q.map((w) => w.map((v) => v * scale)), q, scale };
}

/** Parameter count and memory for weights + biases (float32 = 4 bytes, int8 = 1 byte). */
export function size(model) {
  const weights = model.W.length * model.W[0].length, biases = model.b.length;
  return { weights, biases, params: weights + biases, float32: 4 * (weights + biases), int8: weights + 4 * biases };
}

export function evaluate(model, data, threshold = 0) {
  const K = CLASSES.length;
  const cm = Array.from({ length: K }, () => new Array(K).fill(0));
  let ok = 0;
  for (const d of data) {
    const dec = decide(predict(model, d.x), threshold);
    const got = dec.fire || dec.index === 0 ? (dec.fire ? dec.index : 0) : 0;
    cm[d.y][got]++; if (got === d.y) ok++;
  }
  return { accuracy: ok / data.length, cm };
}

// The lab's standard split: 6 people to train, 2 different people to test (never seen in training).
export const TRAIN_PEOPLE = [1, 2, 3, 4, 5, 6];
export const TEST_PEOPLE = [7, 8];
let cached = null;
export function standardLab() {
  if (cached) return cached;
  const trainSet = dataset(TRAIN_PEOPLE, 10), testSet = dataset(TEST_PEOPLE, 10);
  const model = train(trainSet);
  cached = { trainSet, testSet, model, int8: quantize(model) };
  return cached;
}
