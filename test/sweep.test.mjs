import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSweep } from '../src/charts/sweep.js';
import { defineSeries } from '../src/series.js';
import { assertWellFormed } from './lib/xml.mjs';

const series = defineSeries([
  { key: 'a', label: 'Alpha', color: '#34a853' },
  { key: 'b', label: 'Beta', color: '#2196f3' },
]);
const p = (x, s, value) => ({ x, series: s, value });
const scan = [p(1, 'a', 2200), p(4, 'a', 3100), p(16, 'a', 4000), p(1, 'b', 2400), p(4, 'b', 3300), p(16, 'b', 4500)];
const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.code, code, `expected ${code}, got ${e.code}`);
  return true;
});

test('a sweep is well-formed and draws one polyline per series', () => {
  const svg = renderSweep(scan, { series, scale: 'log', xLabel: 'concurrency', yLabel: 'tiles/s' });
  assertWellFormed(svg, assert);
  assert.equal((svg.match(/class="bc-line"/g) || []).length, 2);
  assert.ok(svg.includes('concurrency') && svg.includes('tiles/s'));
});

test('a span of less than a decade snaps to 1-2-5, not to the enclosing decade', () => {
  const svg = renderSweep(scan, { series, scale: 'log' });
  const ticks = [...svg.matchAll(/class="bc-ytick"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.ok(!ticks.includes('1e3') && !ticks.includes('1000'),
    `stretched to the enclosing decade: ${ticks.join(', ')}`);
  assert.ok(ticks.length >= 2, ticks.join(','));
});

test('log mode drops a non-positive value, marks it hollow, and counts it in a note', () => {
  const withZero = [...scan, p(64, 'a', 0), p(64, 'b', -3)];
  const svg = renderSweep(withZero, { series, scale: 'log' });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('class="bc-omitted"'), 'the hollow marker on the axis floor');
  assert.ok(/2 point/.test(svg), `the disclosure note must count them: ${/([^<]*omitted[^<]*)/.exec(svg)?.[1]}`);
});

test('linear mode keeps a zero, because it is plottable there', () => {
  const svg = renderSweep([p(1, 'a', 0), p(2, 'a', 5)], { series, scale: 'linear' });
  assertWellFormed(svg, assert);
  assert.ok(!svg.includes('class="bc-omitted"'));
});

test('xMin windows the scan', () => {
  const all = renderSweep(scan, { series, scale: 'log' });
  const windowed = renderSweep(scan, { series, scale: 'log', xMin: 4 });
  assert.notEqual(all, windowed);
  assert.ok(windowed.includes('class="bc-line"'));
});

test('an xMin past every point leaves nothing plottable, and says so', () => {
  throwsCode(() => renderSweep(scan, { series, scale: 'log', xMin: 1e6 }), 'NO_PLOTTABLE_POINTS');
});

test('scale must be one of the two, and an unknown option throws', () => {
  throwsCode(() => renderSweep(scan, { series, scale: 'logarithmic' }), 'INVALID_OPTION');
  throwsCode(() => renderSweep(scan, { series, logScale: true }), 'UNKNOWN_OPTION');
});

test('empty input throws', () => {
  throwsCode(() => renderSweep([], { series }), 'EMPTY_INPUT');
});

test('S2: a finite 1.5e308 is refused rather than drawing 301 decades', () => {
  const started = Date.now();
  throwsCode(() => renderSweep([p(1, 'a', 1.5e308)], { series, scale: 'log' }), 'INVALID_RECORD');
  assert.ok(Date.now() - started < 50);
});

test('a value at the window edge renders in bounded time and bytes', () => {
  const started = Date.now();
  const svg = renderSweep([p(1, 'a', 1), p(2, 'a', 1e300)], { series, scale: 'log' });
  assert.ok(Date.now() - started < 200, 'a 301-decade axis must not be slow');
  assert.ok(svg.length < 120_000, `${svg.length} bytes for a 301-decade axis`);
  assertWellFormed(svg, assert);
});

test('points are drawn in x order whatever order they arrive in', () => {
  const a = renderSweep(scan, { series, scale: 'log' });
  const b = renderSweep([...scan].reverse(), { series, scale: 'log' });
  const pointsOf = (svg) => [...svg.matchAll(/class="bc-line" points="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(pointsOf(a), pointsOf(b));
});

test('the output is byte-stable', () => {
  assert.equal(renderSweep(scan, { series, scale: 'log' }), renderSweep(scan, { series, scale: 'log' }));
});
