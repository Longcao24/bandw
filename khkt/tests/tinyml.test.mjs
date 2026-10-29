// TinyML lab (public/js/sims/_tinyml.js): synthetic data is deterministic, the tiny model generalises to
// people it never saw, int8 weights barely change it, and the sizes quoted in unit11 / firmware/TINYML.md hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../public/js/sims/_tinyml.js';

test('tinyml: windows are 75 samples × 6 axes at 50 Hz, 9 features, deterministic', () => {
  assert.equal(T.RATE_HZ, 50);
  assert.equal(T.WINDOW * T.AXES, 450);
  const a = T.sample('WATER', 3, 2), b = T.sample('WATER', 3, 2);
  assert.equal(a.win.length, T.WINDOW);
  assert.equal(a.x.length, T.FEATURES.length);
  assert.deepEqual(a.x, b.x);
  assert.notDeepEqual(T.sample('WATER', 4, 2).x, a.x);
  assert.ok(T.sample('WATER', 1, 0).x[0] < 0 && T.sample('FOOD', 1, 0).x[0] > 0, 'ax mean: left negative, right positive');
});

test('tinyml: model trained on 6 people works on 2 unseen people; int8 agrees', () => {
  const { model, int8, testSet, trainSet } = T.standardLab();
  assert.equal(trainSet.length, 6 * 5 * 10);
  assert.ok(testSet.every((d) => T.TEST_PEOPLE.includes(d.person)));
  const acc = T.evaluate(model, testSet).accuracy;
  assert.ok(acc >= 0.9, `test accuracy ${acc}`);
  const agree = testSet.filter((d) => T.decide(T.predict(model, d.x)).index === T.decide(T.predict(int8, d.x)).index).length / testSet.length;
  assert.ok(agree >= 0.95, `int8 agreement ${agree}`);
  assert.ok(int8.q.flat().every((v) => Number.isInteger(v) && v >= -127 && v <= 127));
});

test('tinyml: sizes quoted in the lessons (50 params, 200 B float32, 65 B int8)', () => {
  assert.deepEqual(T.size(T.standardLab().model), { weights: 45, biases: 5, params: 50, float32: 200, int8: 65 });
});

test('tinyml: more people → better on unseen people; threshold makes the band stay silent', () => {
  const test = T.dataset(T.TEST_PEOPLE, 4);
  const few = T.evaluate(T.train(T.dataset([1], 2)), test).accuracy;
  const many = T.evaluate(T.train(T.dataset(T.TRAIN_PEOPLE, 10)), test).accuracy;
  assert.ok(many > few, `${few} → ${many}`);
  const d = T.decide([0.1, 0.55, 0.15, 0.1, 0.1], 0.8);
  assert.equal(d.label, 'WATER'); assert.equal(d.fire, false);
  assert.equal(T.decide([0.9, 0.05, 0.05, 0, 0], 0.5).fire, false, 'NONE never fires');
});
