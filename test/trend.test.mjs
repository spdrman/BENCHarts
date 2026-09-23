import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTrend } from '../src/charts/trend.js';
import { defineSeries } from '../src/series.js';
import { assertWellFormed } from './lib/xml.mjs';

const series = defineSeries([
  { key: 'streaming', label: 'Streaming', color: '#34a853' },
  { key: 'monolithic', label: 'Monolithic', color: '#2196f3' },
]);
const p = (step, s, value, label) => ({ step, series: s, value, ...(label === undefined ? {} : { label }) });
const history = [
  p(0, 'streaming', 88, 'v0.1'), p(0, 'monolithic', 92, 'v0.1'),
  p(1, 'streaming', 90, 'v0.2'), p(1, 'monolithic', 91, 'v0.2'),
  p(2, 'streaming', 86, 'v0.3'), p(2, 'monolithic', 95, 'v0.3'),
];
const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.code, code, `expected ${code}, got ${e.code}`);
  return true;
});

test('a trend is well-formed and draws one polyline per series', () => {
  const svg = renderTrend(history, { series, title: 'History' });
  assertWellFormed(svg, assert);
  assert.equal((svg.match(/class="bc-line"/g) || []).length, 2);
});

test('the y domain is padded rather than zero-based, and the chart says so', () => {
  const svg = renderTrend(history, { series });
  assert.ok(!svg.includes('>0<'), 'a zero-based axis is what flattens a 5% regression into noise');
  assert.ok(/not zero/i.test(svg), 'and the reader has to be told');
});

test('the padded domain encloses the data with room to spare', () => {
  const svg = renderTrend(history, { series });
  const ticks = [...svg.matchAll(/class="bc-ytick"[^>]*>([^<]+)</g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...ticks) < 86, `lowest tick ${Math.min(...ticks)} must sit under the minimum datum`);
  assert.ok(Math.max(...ticks) > 95, `highest tick ${Math.max(...ticks)} must sit over the maximum`);
});

test('a gap breaks the line rather than drawing through it', () => {
  // Five steps, so each side of the hole is still a segment of two. With only
  // three steps both survivors are isolated points and correctly draw as dots,
  // which is a different assertion.
  const long = [0, 1, 2, 3, 4].flatMap((step) => [
    p(step, 'streaming', 88 + step, `v0.${step}`),
    p(step, 'monolithic', 92 - step, `v0.${step}`),
  ]);
  const gapped = long.filter((r) => !(r.step === 2 && r.series === 'streaming'));
  const svg = renderTrend(gapped, { series });
  assert.equal((svg.match(/class="bc-line"/g) || []).length, 3,
    'streaming becomes two segments, monolithic stays one');
  assert.equal((svg.match(/class="bc-dot"/g) || []).length, 0);
});

test('a wholly absent step does not shatter the chart', () => {
  const holed = history.map((r) => (r.step === 1 ? { ...r, value: Number.NaN } : r));
  const svg = renderTrend(holed, { series });
  assert.equal((svg.match(/class="bc-line"/g) || []).length, 2,
    'nothing was measured at that step, so the lines bridge it rather than each breaking');
  assertWellFormed(svg, assert);
});

test('step labels reach the axis', () => {
  const svg = renderTrend(history, { series });
  for (const v of ['v0.1', 'v0.2', 'v0.3']) assert.ok(svg.includes(v), `missing ${v}`);
});

test('two points at one step disagreeing on the label is refused', () => {
  throwsCode(() => renderTrend([p(0, 'streaming', 1, 'v1'), p(0, 'monolithic', 2, 'v2')], { series }),
    'INCONSISTENT_STEP_LABEL');
});

test('empty input throws, and all-NaN input throws its own code', () => {
  throwsCode(() => renderTrend([], { series }), 'EMPTY_INPUT');
  throwsCode(() => renderTrend([p(0, 'streaming', Number.NaN)], { series }), 'NO_PLOTTABLE_POINTS');
});

test('a single point per series still renders, as a marker', () => {
  const svg = renderTrend([p(0, 'streaming', 5), p(0, 'monolithic', 7)], { series });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('class="bc-dot"'));
});

test('steps are drawn in numeric order whatever order they arrive in', () => {
  const shuffled = [history[4], history[0], history[3], history[1], history[5], history[2]];
  const a = renderTrend(history, { series });
  const b = renderTrend(shuffled, { series });
  const xsOf = (svg) => [...svg.matchAll(/class="bc-xtick"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(xsOf(a), xsOf(b));
  assert.deepEqual(xsOf(a), ['v0.1', 'v0.2', 'v0.3']);
});

test('the output is byte-stable', () => {
  assert.equal(renderTrend(history, { series, title: 'H' }), renderTrend(history, { series, title: 'H' }));
});
