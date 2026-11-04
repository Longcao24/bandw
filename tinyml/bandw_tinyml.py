#!/usr/bin/env python3
"""BandW TinyML pipeline: recordings + UMAHand -> features -> small softmax model -> evaluation -> C header.

Data (nothing here is committed; see tinyml/README.md):
  tinyml/data/recordings/*.csv   guided sessions downloaded from https://longcao24.github.io/bandw/live/
                                 (labels WATER/FOOD/NO/HELP/YES, NONE_rest, NONE_daily, prep, gap)
  tinyml/data/umahand/TRACES/    UMAHand dataset (25 people, 29 everyday hand activities) = extra NONE data

Usage:
  tinyml/.venv/bin/python tinyml/bandw_tinyml.py            # train + evaluate + export
  tinyml/.venv/bin/python tinyml/bandw_tinyml.py --selftest # same, on SYNTHETIC recordings (plumbing check only)

The model replaces the threshold rules only for WATER / FOOD / NO / HELP. YES stays the IMU's hardware double
tap (416 Hz inside the sensor, not visible in a 50 Hz window).
"""
import argparse, csv, glob, json, math, os, random, sys
from collections import Counter, defaultdict
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RATE = 50                     # Hz, the firmware loop
WIN = 75                      # 1.5 s window
STRIDE = 10                   # infer every 200 ms on the band
CLASSES = ['NONE', 'WATER', 'FOOD', 'NO', 'HELP']
GESTURES = CLASSES[1:]
THRESHOLD = 0.80              # firmware decision: prob >= THRESHOLD ...
AGREE = 2                     # ... for AGREE consecutive inferences
COOLDOWN_S = 0.65             # then nothing for this long (same as the rule detector)
REACTION_S = 1.0              # a prompted gesture may finish up to this long after the DO window ends

FEATURES = [
    'roll_mean', 'roll_min', 'roll_max', 'roll_end_minus_start', 'roll_frac_over_22',
    'pitch_mean', 'pitch_min', 'pitch_max', 'pitch_sd',
    'gy_sd', 'gy_absmax', 'gy_reversals',
    'gx_sd', 'gx_absmax', 'mag_sd', 'mag_max',
]


# ---------------------------------------------------------------- signal helpers
def angles(ax, ay, az, cal):
    """Roll / pitch in degrees relative to the calibration pose, exactly like GestureDetector.h."""
    cx, cy, cz = cal
    base_roll = math.degrees(math.atan2(cx, cz))
    m0 = math.sqrt(cx * cx + cy * cy + cz * cz) or 1.0
    base_pitch = math.degrees(math.asin(max(-1, min(1, cy / m0))))
    roll = np.degrees(np.arctan2(ax, az)) - base_roll
    roll = (roll + 180) % 360 - 180
    m = np.sqrt(ax * ax + ay * ay + az * az)
    m[m == 0] = 1
    pitch = np.degrees(np.arcsin(np.clip(ay / m, -1, 1))) - base_pitch
    return roll, pitch


def features(w):
    """16 features from one 75-sample window (dict of numpy arrays). Mirrors bandw_model_features() in C."""
    roll, pitch, gx, gy, mag = w['roll'], w['pitch'], w['gx'], w['gy'], w['mag']
    strong = np.sign(gy) * (np.abs(gy) > 60)
    s = strong[strong != 0]
    reversals = int(np.sum(s[1:] != s[:-1])) if len(s) > 1 else 0
    return np.array([
        roll.mean(), roll.min(), roll.max(), roll[-10:].mean() - roll[:10].mean(), np.mean(np.abs(roll) > 22),
        pitch.mean(), pitch.min(), pitch.max(), pitch.std(),
        gy.std(), np.abs(gy).max(), reversals,
        gx.std(), np.abs(gx).max(), mag.std(), mag.max(),
    ], dtype=np.float64)


def make_stream(ax, ay, az, gx, gy, gz, cal):
    roll, pitch = angles(ax, ay, az, cal)
    return {'roll': roll, 'pitch': pitch, 'gx': gx, 'gy': gy, 'mag': np.sqrt(ax * ax + ay * ay + az * az)}


def window(stream, end):
    return {k: v[end - WIN:end] for k, v in stream.items()}


# ---------------------------------------------------------------- loading
def load_recording(path):
    """One guided session -> {person, stream, labels[], t[]} (labels per sample)."""
    rows = list(csv.DictReader(open(path, newline='')))
    if not rows:
        return None
    f = lambda k: np.array([float(r[k]) for r in rows])
    ax, ay, az, gx, gy, gz = f('ax_g'), f('ay_g'), f('az_g'), f('gx_dps'), f('gy_dps'), f('gz_dps')
    labels = [r['label'] for r in rows]
    person = (rows[0].get('person') or os.path.basename(path)).strip() or os.path.basename(path)
    rest = [i for i, l in enumerate(labels) if l == 'NONE_rest']
    idx = rest if len(rest) >= 25 else list(range(min(50, len(rows))))
    cal = (ax[idx].mean(), ay[idx].mean(), az[idx].mean())
    steps = [int(r['step']) if r.get('step', '') not in ('', None) else -1 for r in rows]
    return {'path': path, 'person': person, 'cal': [float(v) for v in cal], 'stream': make_stream(ax, ay, az, gx, gy, gz, cal), 'labels': labels,
            'steps': steps, 'n': len(rows), 'event': [int(r.get('event') or 0) for r in rows]}


def load_umahand(root):
    """UMAHand traces resampled 100 -> 50 Hz; calibration = forearm flat, back of the wrist up."""
    out = []
    for path in sorted(glob.glob(os.path.join(root, 'output_*', '*.csv'))):
        base = os.path.basename(path)
        try:
            user = int(base.split('_')[1]); act = int(base.split('_')[3])
        except (IndexError, ValueError):
            continue
        a = np.loadtxt(path, delimiter=',', usecols=range(7))[::2]
        if len(a) < WIN + 5:
            continue
        out.append({'path': path, 'person': f'uma{user:02d}', 'user': user, 'activity': act,
                    'stream': make_stream(a[:, 1], a[:, 2], a[:, 3], a[:, 4], a[:, 5], a[:, 6], (0, 0, 1)), 'n': len(a)})
    return out


# ---------------------------------------------------------------- windows -> dataset
def prompt_segments(rec):
    """[(label, start, end)] for each prompted gesture (DO window), in sample indices."""
    segs, cur = [], None
    for i, (l, s) in enumerate(zip(rec['labels'], rec['steps'])):
        key = (l, s)
        if cur and cur[0] == key:
            cur[2] = i
        else:
            if cur: segs.append(cur)
            cur = [key, i, i]
    if cur: segs.append(cur)
    return [(k[0], a, b + 1) for k, a, b in segs]


def recording_windows(rec):
    X, y = [], []
    st, n = rec['stream'], rec['n']
    for label, a, b in prompt_segments(rec):
        if label in GESTURES:
            hi = min(n, b + int(REACTION_S * RATE))
            for end in range(a + WIN, hi + 1, STRIDE // 2):      # windows inside DO (+ reaction time)
                X.append(features(window(st, end))); y.append(CLASSES.index(label))
        elif label in ('NONE_rest', 'NONE_daily'):
            for end in range(a + WIN, b + 1, STRIDE):
                X.append(features(window(st, end))); y.append(0)
    return X, y


def umahand_windows(rec, stride=25):
    st, n = rec['stream'], rec['n']
    return [features(window(st, end)) for end in range(WIN, n + 1, stride)]


# ---------------------------------------------------------------- model: softmax regression (= one layer of 5 neurons)
class Softmax:
    def __init__(self, l2=1e-3, epochs=400, lr=0.3):
        self.l2, self.epochs, self.lr = l2, epochs, lr

    def fit(self, X, y, weights=None):
        X = np.asarray(X, float); y = np.asarray(y)
        self.mu, self.sd = X.mean(0), X.std(0) + 1e-6
        Z = (X - self.mu) / self.sd
        n, F = Z.shape; K = len(CLASSES)
        Y = np.eye(K)[y]
        w = np.ones(n) if weights is None else np.asarray(weights, float)
        w = w / w.mean()
        self.W = np.zeros((F, K)); self.b = np.zeros(K)
        for _ in range(self.epochs):
            P = self._prob(Z)
            G = (P - Y) * w[:, None] / n
            self.W -= self.lr * (Z.T @ G + self.l2 * self.W)
            self.b -= self.lr * G.sum(0)
        return self

    def _prob(self, Z):
        L = Z @ self.W + self.b
        L -= L.max(1, keepdims=True)
        E = np.exp(L)
        return E / E.sum(1, keepdims=True)

    def proba(self, X):
        return self._prob((np.atleast_2d(X) - self.mu) / self.sd)


def quantize(model):
    """Snap W to the int8 grid used on the chip, so every number this script reports is the exported model's."""
    scale = np.abs(model.W).max(0) / 127 + 1e-12
    model.W = np.clip(np.round(model.W / scale), -127, 127) * scale
    return model


def class_weights(y):
    c = Counter(y)
    return [len(y) / (len(c) * c[v]) for v in y]


# ---------------------------------------------------------------- streaming evaluation (what the band would do)
def stream_events(model, stream, n):
    """Run the firmware decision rule over a whole recording -> [(class, sample index)]."""
    events, last, agree, cool_until = [], 0, 0, -1
    ends = list(range(WIN, n + 1, STRIDE))
    if not ends:
        return events
    P = model.proba(np.array([features(window(stream, e)) for e in ends]))
    for e, p in zip(ends, P):
        k = int(p.argmax())
        if k != 0 and p[k] >= THRESHOLD:
            agree = agree + 1 if k == last else 1
        else:
            agree = 0
        last = k if (k != 0 and p[k] >= THRESHOLD) else 0
        if agree >= AGREE and e >= cool_until:
            events.append((CLASSES[k], e))
            cool_until = e + int(COOLDOWN_S * RATE)
            agree, last = 0, 0
    return events


def score_recording(model, rec):
    """Per prompted gesture: hit / wrong / miss; plus false events during NONE_daily."""
    ev = stream_events(model, rec['stream'], rec['n'])
    res = Counter(); daily_false = 0; daily_s = 0.0
    segs = prompt_segments(rec)
    for label, a, b in segs:
        if label in GESTURES:
            hi = b + int(REACTION_S * RATE)
            got = [c for c, e in ev if a <= e <= hi]
            res['prompts'] += 1
            if label in got: res['hit'] += 1
            elif got: res['wrong'] += 1
            else: res['miss'] += 1
        if label == 'NONE_daily':
            daily_s += (b - a) / RATE
            daily_false += sum(1 for c, e in ev if a + WIN <= e <= b)
    return res, daily_false, daily_s


def rule_score(rec):
    """Same scoring for the rule detector, using the 'event' column the band recorded."""
    names = {1: 'WATER', 2: 'FOOD', 3: 'NO', 4: 'YES', 5: 'HELP'}
    ev = [(names[v], i) for i, v in enumerate(rec['event']) if v in names]
    res = Counter(); daily_false = 0; daily_s = 0.0
    for label, a, b in prompt_segments(rec):
        if label in GESTURES:
            got = [c for c, e in ev if a <= e <= b + int(REACTION_S * RATE)]
            res['prompts'] += 1
            res['hit' if label in got else ('wrong' if got else 'miss')] += 1
        if label == 'NONE_daily':
            daily_s += (b - a) / RATE; daily_false += sum(1 for c, e in ev if a <= e <= b)
    return res, daily_false, daily_s


# ---------------------------------------------------------------- export
def export_header(model, path, meta):
    """int8 weights per class column with one float scale each; standardization folded into mu / inv_sd."""
    F, K = model.W.shape
    scale = np.abs(model.W).max(0) / 127 + 1e-12
    q = np.clip(np.round(model.W / scale), -127, 127).astype(int)
    fl = lambda a: ', '.join(f'{v:.6g}f' for v in a)
    lines = [
        '// Generated by tinyml/bandw_tinyml.py. Do not edit by hand.',
        f'// {json.dumps(meta, ensure_ascii=False)}',
        '#pragma once', '#include <stdint.h>',
        f'#define BANDW_MODEL_FEATURES {F}', f'#define BANDW_MODEL_CLASSES {K}',
        f'#define BANDW_MODEL_WINDOW {WIN}', f'#define BANDW_MODEL_STRIDE {STRIDE}',
        f'#define BANDW_MODEL_THRESHOLD {THRESHOLD}f', f'#define BANDW_MODEL_AGREE {AGREE}',
        '// classes: ' + ', '.join(CLASSES), '// features: ' + ', '.join(FEATURES),
        f'static const float BANDW_MU[{F}] = {{{fl(model.mu)}}};',
        f'static const float BANDW_INV_SD[{F}] = {{{fl(1 / model.sd)}}};',
        f'static const int8_t BANDW_W[{F}][{K}] = {{' + ', '.join('{' + ', '.join(str(v) for v in row) + '}' for row in q) + '};',
        f'static const float BANDW_W_SCALE[{K}] = {{{fl(scale)}}};',
        f'static const float BANDW_B[{K}] = {{{fl(model.b)}}};',
    ]
    open(path, 'w').write('\n'.join(lines) + '\n')
    return F * K + 4 * (3 * F + 2 * K)


# ---------------------------------------------------------------- synthetic recordings (--selftest only)
def synth_session(person, seed, reps=10):
    """Fake guided session so the pipeline can be exercised without a band. NOT data about real wrists."""
    rnd = random.Random(seed); out = []
    amp = rnd.uniform(0.8, 1.3); speed = rnd.uniform(0.8, 1.25)
    t = 0
    def push(label, step, roll, pitch, gy, gx=0.0, mag=1.0):
        nonlocal t
        r, p = math.radians(roll), math.radians(pitch)
        out.append({'t_ms': t * 20, 'seq': t, 'label': label, 'person': person, 'step': step,
                    'ax_g': math.sin(r) * math.cos(p) * mag, 'ay_g': math.sin(p) * mag, 'az_g': math.cos(r) * math.cos(p) * mag,
                    'gx_dps': gx, 'gy_dps': gy, 'gz_dps': 0, 'event': 0}); t += 1
    noise = lambda s: rnd.gauss(0, s)
    for i in range(500): push('NONE_rest', 0, noise(2), noise(2), noise(5))
    order = [g for g in GESTURES + ['YES'] for _ in range(reps)]; rnd.shuffle(order)
    for k, g in enumerate(order):
        st = 1 + 3 * k
        for i in range(75): push('prep', st, noise(2), noise(2), noise(5))
        delay = rnd.randint(10, 35)
        for i in range(150):
            j = i - delay; roll = pitch = gy = gx = 0.0
            if g in ('WATER', 'FOOD') and 0 <= j < 60 / speed:
                roll = (-1 if g == 'WATER' else 1) * 40 * amp * min(1, j / 8, (60 / speed - j) / 8)
            if g == 'NO' and 0 <= j < 40 / speed:
                gy = 220 * amp * math.sin(j * speed / 2.6); roll = 15 * amp * math.cos(j * speed / 2.6)
            if g == 'HELP' and 0 <= j < 50 / speed:
                c = (j * speed) % 25; pitch = 55 * amp * math.sin(math.pi * c / 25); gx = 150 * amp * math.cos(math.pi * c / 25)
            push(g, st + 1, roll + noise(2), pitch + noise(2), gy + noise(6), gx + noise(6))
        for i in range(100): push('gap', st + 2, noise(2), noise(2), noise(5))
    for i in range(3000):
        ph = i / 50.0
        push('NONE_daily', 999, 25 * math.sin(ph * 0.7) + noise(4), 30 * math.sin(ph * 0.4) + noise(4),
             80 * math.sin(ph * 3.1) + noise(20), 60 * math.sin(ph * 1.3) + noise(10), 1 + 0.1 * math.sin(ph * 5))
    return out


def write_csv(rows, path):
    keys = ['t_ms', 'seq', 'label', 'person', 'step', 'ax_g', 'ay_g', 'az_g', 'gx_dps', 'gy_dps', 'gz_dps', 'event']
    with open(path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction='ignore'); w.writeheader(); w.writerows(rows)


# ---------------------------------------------------------------- main
def pct(a, b):
    return f'{100 * a / b:.0f}%' if b else '-'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--recordings', default=os.path.join(HERE, 'data', 'recordings'))
    ap.add_argument('--umahand', default=os.path.join(HERE, 'data', 'umahand', 'TRACES'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--selftest', action='store_true', help='use synthetic recordings (plumbing check only)')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    if args.selftest:
        args.recordings = os.path.join(args.out, 'selftest-recordings')
        os.makedirs(args.recordings, exist_ok=True)
        for k in range(4):
            write_csv(synth_session(f'S{k + 1}', 100 + k), os.path.join(args.recordings, f'synthetic-S{k + 1}.csv'))
        print('SELFTEST: synthetic recordings, the numbers below say nothing about real wrists.\n')

    recs = [r for r in (load_recording(p) for p in sorted(glob.glob(os.path.join(args.recordings, '*.csv')))) if r]
    if not recs:
        sys.exit(f'Chưa có file ghi nào trong {args.recordings}. Ghi ở trang Live 3D rồi chép file CSV vào đó.')
    uma = load_umahand(args.umahand) if os.path.isdir(args.umahand) else []
    people = sorted({r['person'] for r in recs})
    print(f'Recordings: {len(recs)} file(s), {len(people)} person(s): {", ".join(people)}')
    print(f'UMAHand: {len(uma)} traces' + ('' if uma else ' (not found: NONE data comes from recordings only)'))

    per_rec = {r['path']: recording_windows(r) for r in recs}
    uma_train = [w for r in uma if r['user'] <= 18 for w in umahand_windows(r)]   # users 19-25 held out
    uma_test = [r for r in uma if r['user'] > 18]
    counts = Counter(y for X, Y in per_rec.values() for y in Y)
    print('Windows from recordings: ' + ', '.join(f'{c}={counts[i]}' for i, c in enumerate(CLASSES)) + f'; UMAHand NONE windows (train users): {len(uma_train)}')

    def train_on(records):
        X, Y = [], []
        for r in records:
            x, y = per_rec[r['path']]; X += x; Y += y
        X += uma_train; Y += [0] * len(uma_train)
        return quantize(Softmax().fit(X, Y, class_weights(Y)))

    # Evaluation: leave one PERSON out (the test person is never seen in training).
    print('\n== Leave-one-person-out (người kiểm tra không có trong dữ liệu huấn luyện) ==')
    tot, rtot = Counter(), Counter(); dfalse = dsecs = rfalse = 0
    folds = people if len(people) > 1 else [None]
    for p in folds:
        train = [r for r in recs if r['person'] != p] if p else recs
        test = [r for r in recs if r['person'] == p] if p else recs
        m = train_on(train)
        for r in test:
            res, f, s = score_recording(m, r); tot.update(res); dfalse += f; dsecs += s
            rres, rf, _ = rule_score(r); rtot.update(rres); rfalse += rf
    if len(people) == 1:
        print('  (chỉ có 1 người: đánh giá trên chính dữ liệu huấn luyện, con số sẽ đẹp hơn thực tế)')
    has_rule = any(any(r['event']) for r in recs)
    print(f"  TinyML : đúng {pct(tot['hit'], tot['prompts'])}  nhầm lệnh {pct(tot['wrong'], tot['prompts'])}  bỏ sót {pct(tot['miss'], tot['prompts'])}"
          f"  ({tot['prompts']} lần làm)  ·  phát nhầm khi sinh hoạt: {dfalse} lần / {dsecs / 60:.1f} phút")
    if has_rule:
        print(f"  Luật   : đúng {pct(rtot['hit'], rtot['prompts'])}  nhầm lệnh {pct(rtot['wrong'], rtot['prompts'])}  bỏ sót {pct(rtot['miss'], rtot['prompts'])}"
              f"  ·  phát nhầm khi sinh hoạt: {rfalse} lần")

    final = train_on(recs)
    if uma_test:
        n_ev = Counter(); secs = 0.0
        for r in uma_test:
            for c, e in stream_events(final, r['stream'], r['n']): n_ev[c] += 1
            secs += r['n'] / RATE
        h = secs / 3600
        print(f'\n== UMAHand, 7 người chưa thấy, {h:.2f} giờ sinh hoạt ==')
        print(f'  TinyML phát nhầm {sum(n_ev.values()) / h:.0f} lần/giờ  (' + ', '.join(f'{c}={n_ev[c]}' for c in GESTURES) + ')')
        print('  (luật hiện tại trên cùng loại dữ liệu: khoảng 179 lần/giờ, xem tinyml/README.md)')

    meta = {'people': people, 'recordings': len(recs), 'umahand_traces': len(uma), 'selftest': bool(args.selftest)}
    size = export_header(final, os.path.join(args.out, 'bandw_model.h'), meta)
    json.dump({'classes': CLASSES, 'features': FEATURES, 'mu': final.mu.tolist(), 'sd': final.sd.tolist(),
               'W': final.W.tolist(), 'b': final.b.tolist(), 'meta': meta}, open(os.path.join(args.out, 'model.json'), 'w'), indent=1)
    # Reference events for tinyml/parity_test.cpp (C++ twin must emit the same gestures).
    ref = []
    for r in recs:
        ref.append({'file': r['path'], 'cal': r['cal'], 'events': [[CLASSES.index(c), e] for c, e in stream_events(final, r['stream'], r['n'])]})
    json.dump(ref, open(os.path.join(args.out, 'parity.json'), 'w'))
    print(f'\nĐã xuất {os.path.relpath(os.path.join(args.out, "bandw_model.h"))} (≈ {size} byte trên chip)')
    print('Trọng số lớn nhất mỗi lớp (đặc trưng mô hình dựa vào nhiều nhất):')
    for k, c in enumerate(CLASSES):
        top = np.argsort(-np.abs(final.W[:, k]))[:3]
        print(f'  {c:5}: ' + ', '.join(f'{FEATURES[i]} ({final.W[i, k]:+.2f})' for i in top))


if __name__ == '__main__':
    main()
