import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, formatNumber, formatLogTick, formatCoord } from '../src/format.js';

test('escapeXml covers all five, including the apostrophe R-ESC-2 adds', () => {
  assert.equal(escapeXml('&'), '&amp;');
  assert.equal(escapeXml('<'), '&lt;');
  assert.equal(escapeXml('>'), '&gt;');
  assert.equal(escapeXml('"'), '&quot;');
  assert.equal(escapeXml("'"), '&apos;');
});

test('escapeXml neutralises the S1 breakout', () => {
  const payload = '#000"/><script>PWNED</script><rect fill="#000';
  const out = escapeXml(payload);
  assert.ok(!out.includes('<script>'), 'no live script element survives');
  assert.ok(!out.includes('"'), 'no raw quote can close an attribute');
});

test('escapeXml orders the ampersand first, so nothing is double-escaped', () => {
  assert.equal(escapeXml('&lt;'), '&amp;lt;');
});

test('formatNumber keeps the ported behaviour', () => {
  assert.equal(formatNumber(Number.NaN), 'n/a');
  assert.equal(formatNumber(Infinity), 'n/a');
  assert.equal(formatNumber(123.7), '124');
  assert.equal(formatNumber(100), '100');
  assert.equal(formatNumber(99.456), '99.46');
  assert.equal(formatNumber(1.5), '1.5');
  assert.equal(formatNumber(0), '0');
});

test('formatLogTick keeps decades distinct where formatNumber would collide them', () => {
  assert.notEqual(formatLogTick(0.001), formatLogTick(0.0001));
  assert.equal(formatNumber(0.001), formatNumber(0.0001), 'the collision formatNumber has');
  assert.equal(formatLogTick(0.001), '1e-3');
  assert.equal(formatLogTick(1e5), '1e5');
  assert.equal(formatLogTick(0), '0');
  assert.equal(formatLogTick(Number.NaN), 'n/a');
  assert.equal(formatLogTick(2.5), '2.5');
});

test('formatCoord rounds to two decimals', () => {
  assert.equal(formatCoord(1.23456), '1.23');
  assert.equal(formatCoord(10), '10');
  assert.equal(formatCoord(0), '0');
});

test('formatCoord rounds half AWAY FROM ZERO, symmetrically', () => {
  assert.equal(formatCoord(2.675), '2.68');
  assert.equal(formatCoord(-2.675), '-2.68', 'the naive Math.round gives -2.67 here');
  assert.equal(formatCoord(0.005), '0.01');
  assert.equal(formatCoord(-0.005), '-0.01');
});

test('formatCoord never leaks a non-finite coordinate into geometry', () => {
  assert.equal(formatCoord(Number.NaN), '0');
  assert.equal(formatCoord(Infinity), '0');
  assert.equal(formatCoord(-Infinity), '0');
});

test('formatCoord never emits exponential notation, which SVG cannot parse as a coordinate', () => {
  for (const n of [1e-7, 1e21, 5e-8, 1.5e300, -1.5e300]) {
    assert.ok(!/e/i.test(formatCoord(n)), `${n} formatted as ${formatCoord(n)}`);
  }
  // Not a literal: 1e21 * 100 is not exactly representable, so the round trip
  // through hundredths lands a few low digits off. The property is what matters.
  // Digits only, and no count asserted: 1e21 * 100 is not exactly representable,
  // so the round trip through hundredths lands a few low digits off and a literal
  // would be a guess. The property is what matters.
  assert.match(formatCoord(1e21), /^\d+$/);
  assert.match(formatCoord(-1.5e300), /^-\d+$/);
  assert.equal(formatCoord(1e-7), '0', 'below half a hundredth collapses rather than growing an exponent');
});
