import test from 'node:test';
import assert from 'node:assert/strict';
import {
  log10Scale, linearScale, enclosingDecades, decadeTicks,
  VALUE_MAX, VALUE_MIN_LOG, MAX_DECADES, isPlottable, isPlottableLog,
} from '../src/scale.js';

test('S2: a finite 1.5e308 no longer overflows the axis', () => {
  const started = Date.now();
  const [lo, hi] = enclosingDecades(1, 1.5e308);
  assert.ok(Number.isFinite(lo), `lo was ${lo}`);
  assert.ok(Number.isFinite(hi), `hi was ${hi}, and Infinity here is what exhausted the heap`);
  assert.ok(Date.now() - started < 50);
});

test('R-VAL-5: every finite input yields finite bounds and at most 601 decades', () => {
  for (const [min, max] of [[1, 1.5e308], [1e-320, 1e308], [5e-324, Number.MAX_VALUE], [1, 1]]) {
    const [lo, hi] = enclosingDecades(min, max);
    assert.ok(Number.isFinite(lo) && Number.isFinite(hi), `${min}..${max} -> ${lo}..${hi}`);
    const { major } = decadeTicks(lo, hi);
    assert.ok(major.length <= MAX_DECADES, `${major.length} majors for ${min}..${max}`);
    assert.ok(major.every(Number.isFinite));
  }
});

test('R-VAL-5: a non-finite bound yields an empty tick set rather than looping', () => {
  for (const [min, max] of [[1, Infinity], [Infinity, 1], [Number.NaN, 10], [1, Number.NaN], [-Infinity, Infinity]]) {
    const started = Date.now();
    const { major, minor } = decadeTicks(min, max);
    assert.deepEqual(major, [], `major for ${min}..${max}`);
    assert.deepEqual(minor, [], `minor for ${min}..${max}`);
    assert.ok(Date.now() - started < 50, 'returned rather than looping');
  }
});

test('enclosingDecades keeps the ported snapping behaviour', () => {
  assert.deepEqual(enclosingDecades(0.18, 11.8), [0.1, 100]);
  assert.deepEqual(enclosingDecades(1, 10), [1, 10]);
});

test('a single-value domain expands one decade either side', () => {
  const [lo, hi] = enclosingDecades(5, 5);
  assert.ok(lo < 5 && hi > 5, `${lo}..${hi}`);
  assert.ok(Number.isFinite(lo) && Number.isFinite(hi));
});

test('a non-positive domain is left alone, because a log axis cannot hold it', () => {
  assert.deepEqual(enclosingDecades(0, 10), [0, 10]);
  assert.deepEqual(enclosingDecades(-5, 10), [-5, 10]);
});

test('decadeTicks puts majors on the powers and minors on the 2..9 multiples', () => {
  const { major, minor } = decadeTicks(1, 100);
  assert.deepEqual(major, [1, 10, 100]);
  assert.ok(minor.includes(2) && minor.includes(90));
  assert.ok(!minor.includes(1) && !minor.includes(10));
});

test('float noise near a decade boundary does not spawn a phantom tick', () => {
  const { major } = decadeTicks(0.1, 1);
  assert.deepEqual(major, [0.1, 1]);
});

test('log10Scale gives every decade an equal pixel span', () => {
  const s = log10Scale(1, 1000, 0, 300);
  assert.equal(s(1), 0);
  assert.ok(Math.abs(s(10) - 100) < 1e-9);
  assert.ok(Math.abs(s(100) - 200) < 1e-9);
  assert.ok(Math.abs(s(1000) - 300) < 1e-9);
});

test('log10Scale never leaks NaN for a domain it cannot map', () => {
  assert.equal(log10Scale(0, 10, 0, 100)(5), 0);
  assert.equal(log10Scale(1, 1, 0, 100)(1), 0);
  assert.equal(log10Scale(1, 100, 0, 100)(-5), 0);
  assert.ok(Number.isFinite(log10Scale(1, Infinity, 0, 100)(10)));
});

test('linearScale maps proportionally and survives a zero-width domain', () => {
  const s = linearScale(0, 10, 0, 100);
  assert.equal(s(5), 50);
  assert.equal(linearScale(5, 5, 0, 100)(5), 0);
  assert.ok(Number.isFinite(linearScale(0, Infinity, 0, 100)(1)));
});

test('R-VAL-4: the window is a value check, not a finiteness check', () => {
  assert.equal(VALUE_MAX, 1e300);
  assert.equal(VALUE_MIN_LOG, 1e-300);
  assert.ok(isPlottable(1e300), 'the boundary itself is in');
  assert.ok(!isPlottable(1.5e308), 'finite, and still out');
  assert.ok(!isPlottable(Number.NaN));
  assert.ok(isPlottable(-1e300), 'the window is symmetric off a log axis');
  assert.ok(!isPlottableLog(-1), 'a log axis cannot hold a negative');
  assert.ok(!isPlottableLog(0));
  assert.ok(!isPlottableLog(1e-320), 'below the log floor');
  assert.ok(isPlottableLog(1e-300));
});
