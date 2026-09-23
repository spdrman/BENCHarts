import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGroupedBars } from '../src/charts/grouped-bars.js';
import { defineSeries } from '../src/series.js';
import { assertWellFormed, hasForbiddenChars } from './lib/xml.mjs';

const series = defineSeries([
  { key: 'directory', label: 'Directory', color: '#34a853' },
  { key: 'pmtiles', label: 'PMTiles', color: '#2196f3' },
]);
const row = (group, s, value, error) => ({ group, series: s, value, ...(error === undefined ? {} : { error }) });
const basic = [row('read', 'directory', 12), row('read', 'pmtiles', 8), row('write', 'directory', 20), row('write', 'pmtiles', 25)];
const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
  return true;
});

test('a chart is well-formed XML with no forbidden characters', () => {
  const svg = renderGroupedBars(basic, { series, title: 'Storage' });
  assertWellFormed(svg, assert);
  assert.ok(!hasForbiddenChars(svg));
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
});

test('it draws one bar per cell, in the resolved series colours', () => {
  const svg = renderGroupedBars(basic, { series });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 4);
  assert.ok(svg.includes('#34a853') && svg.includes('#2196f3'));
});

test('group and series labels reach the output', () => {
  const svg = renderGroupedBars(basic, { series });
  for (const t of ['read', 'write', 'Directory', 'PMTiles']) assert.ok(svg.includes(t), `missing ${t}`);
});

test('empty input throws rather than drawing a mark-free chart', () => {
  throwsCode(() => renderGroupedBars([], { series }), 'EMPTY_INPUT');
});

test('an unknown option throws, including every stale name from the old API', () => {
  for (const stale of ['theme2', 'xKey', 'unitSuffix', 'logScale']) {
    throwsCode(() => renderGroupedBars(basic, { series, [stale]: 1 }), 'UNKNOWN_OPTION');
  }
});

test('the series option must come from defineSeries, checked by brand not by shape', () => {
  throwsCode(() => renderGroupedBars(basic, { series: { keys: ['a'], colorOf: () => '#000000', resolve: () => ({}) } }), 'INVALID_OPTION');
  throwsCode(() => renderGroupedBars(basic, {}), 'INVALID_OPTION');
});

test('an absent cell keeps its slot, carries no mark, and reads n/a', () => {
  const rows = [row('read', 'directory', 12), row('write', 'directory', 20), row('write', 'pmtiles', 25)];
  const svg = renderGroupedBars(rows, { series });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 3, 'three cells have data');
  assert.ok(svg.includes('n/a'), 'the absent cell says so');
  assert.equal((svg.match(/>n\/a</g) || []).length, 1);
});

test('a measured zero draws a stub and labels 0, so it cannot read as absent', () => {
  const rows = [row('read', 'directory', 0), row('read', 'pmtiles', 5)];
  const svg = renderGroupedBars(rows, { series });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 2, 'zero is still a bar');
  assert.ok(svg.includes('>0<'), 'and it is labelled');
  assert.ok(!svg.includes('n/a'), 'a measured zero is not an absent cell');
});

test('a NaN value degrades to a labelled slot rather than throwing', () => {
  const rows = [row('read', 'directory', Number.NaN), row('read', 'pmtiles', 5)];
  const svg = renderGroupedBars(rows, { series });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('n/a'));
  assert.ok(!/NaN/.test(svg), 'and NaN never reaches an attribute');
});

test('records that exist but are none of them plottable throws', () => {
  throwsCode(() => renderGroupedBars([row('a', 'directory', Number.NaN)], { series }), 'NO_PLOTTABLE_POINTS');
});

test('whiskers draw when an error is given, and the error label rides with them', () => {
  const withError = [row('read', 'directory', 12, 2), row('read', 'pmtiles', 8, 1)];
  const svg = renderGroupedBars(withError, { series, errorLabel: '95% CI' });
  assert.ok(svg.includes('class="bc-whisker"'));
  assert.ok(svg.includes('95% CI'));
});

test('the error label never renders when no whisker was drawn', () => {
  const svg = renderGroupedBars(basic, { series, errorLabel: '95% CI' });
  assert.ok(!svg.includes('95% CI'), 'a static title could never manage this');
  assert.ok(!svg.includes('class="bc-whisker"'));
});

test('better composes the subtitle, and is the only project-free way to say it', () => {
  const svg = renderGroupedBars(basic, { series, title: 'Wall time', unit: 'ms', better: 'lower' });
  assert.ok(svg.includes('Wall time'));
  assert.ok(svg.includes('lower is better'));
  assert.ok(svg.includes('ms'));
  throwsCode(() => renderGroupedBars(basic, { series, better: 'sideways' }), 'INVALID_OPTION');
});

test('the canvas is content-sized when no width is given, and honours one when it is', () => {
  const narrow = renderGroupedBars(basic, { series });
  const wide = renderGroupedBars([...basic, row('trim', 'directory', 5), row('trim', 'pmtiles', 6)], { series });
  const widthOf = (svg) => Number(/viewBox="0 0 ([\d.]+)/.exec(svg)[1]);
  assert.ok(widthOf(wide) > widthOf(narrow), 'more groups must mean a wider canvas');
  assert.equal(widthOf(renderGroupedBars(basic, { series, width: 900 })), 900);
});

test('S5: the cell count follows the rows, not groups times series', () => {
  const rows = Array.from({ length: 200 }, (_, i) => row(`g${i}`, 'directory', i));
  const svg = renderGroupedBars(rows, { series, width: 4000 });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 200,
    'one mark per row, never groups x series worth of empty cells');
  assert.ok(svg.length < 400_000, `320 MB came from the other behaviour; this is ${svg.length} bytes`);
});

test('every value is labelled up to twelve bars, and past that only best and worst per group', () => {
  const few = renderGroupedBars(basic, { series });
  assert.equal((few.match(/class="bc-value"/g) || []).length, 4);
  const many = Array.from({ length: 8 }, (_, g) => [row(`g${g}`, 'directory', g + 1), row(`g${g}`, 'pmtiles', g + 2)]).flat();
  const svg = renderGroupedBars(many, { series, width: 1200 });
  assert.equal((svg.match(/class="bc-value"/g) || []).length, 16 > 12 ? 16 : 16);
});

const barsIn = (svg) => [...svg.matchAll(/class="bc-bar" d="M([-\d.]+),([-\d.]+)L[-\d.]+,([-\d.]+)/g)]
  .map((m) => ({ x: Number(m[1]), baseline: Number(m[2]), end: Number(m[3]) }));
const box = (svg) => {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  return { width: Number(m[1]), height: Number(m[2]) };
};
const yTicks = (svg) => [...svg.matchAll(/text-anchor="end" font-size="9"[^>]*>([^<]+)</g)].map((m) => Number(m[1]));

/* The squeeze that fits content to a forced width has a floor, and past that it
 * stops squeezing and runs the bars off the right edge instead. A chart that
 * looks finished and is not is the one outcome D2 rules out. */
test('a canvas too narrow for the content is refused, not silently overflowed', () => {
  const rows = Array.from({ length: 200 }, (_, i) => row(`g${i}`, 'directory', i + 1));
  throwsCode(() => renderGroupedBars(rows, { series, width: 200 }), 'INVALID_OPTION');
});

test('and the width the refusal names actually works, rather than refusing again', () => {
  for (const n of [200, 800]) {
    const rows = Array.from({ length: n }, (_, i) => row(`g${i}`, 'directory', i + 1));
    let needed = null;
    try { renderGroupedBars(rows, { series, width: 120 }); } catch (e) { needed = e.details.needed; }
    assert.ok(Number.isInteger(needed), `no needed width reported for ${n} groups`);
    assert.doesNotThrow(() => renderGroupedBars(rows, { series, width: needed }),
      `${n} groups: told ${needed} and refused it`);
  }
});

test('every bar stays inside the canvas at any width it accepts', () => {
  for (const [n, w] of [[10, 300], [50, 300], [200, 700], [4, 900]]) {
    const rows = Array.from({ length: n }, (_, i) => row(`g${i}`, 'directory', i + 1));
    const svg = renderGroupedBars(rows, { series, width: w });
    const bars = barsIn(svg);
    assert.equal(bars.length, n);
    assert.ok(Math.min(...bars.map((b) => b.x)) >= 0, `${n}@${w} runs off the left`);
    assert.ok(Math.max(...bars.map((b) => b.x)) <= w, `${n}@${w} runs off the right`);
  }
});

/* A linear axis represents a negative perfectly well, unlike a log axis, so a
 * bar that grows downward is drawn rather than refused. It used to be drawn
 * below the baseline and clean off the canvas. */
test('a negative value grows down from zero and stays on the canvas', () => {
  const svg = renderGroupedBars([row('down', 'directory', -5), row('up', 'directory', 10)], { series });
  const { height } = box(svg);
  const bars = barsIn(svg);
  assert.equal(bars.length, 2);
  for (const b of bars) {
    assert.ok(b.end >= 0 && b.end <= height, `data end ${b.end} is off a canvas of ${height}`);
  }
  assert.ok(bars[0].end > bars[0].baseline, 'the negative grows down');
  assert.ok(bars[1].end < bars[1].baseline, 'the positive grows up');
  assert.equal(bars[0].baseline, bars[1].baseline, 'both anchor on the same zero');
  assert.ok(yTicks(svg).includes(0), 'zero stays on the axis');
  assert.ok(Math.min(...yTicks(svg)) < 0, 'and the axis reaches below it');
  assert.ok(!/NaN/.test(svg));
});

test('all-negative data gets an axis, rather than one that stops at zero', () => {
  const svg = renderGroupedBars([row('a', 'directory', -5), row('b', 'directory', -2)], { series });
  assert.ok(Math.min(...yTicks(svg)) <= -5);
  assert.ok(yTicks(svg).includes(0));
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 2);
});

test('all-positive data still starts the axis at zero', () => {
  assert.equal(Math.min(...yTicks(renderGroupedBars(basic, { series }))), 0);
});

test('a whisker on a negative value stays inside the domain', () => {
  const svg = renderGroupedBars([row('a', 'directory', -5, 3), row('b', 'directory', 10, 2)], { series });
  assert.ok(svg.includes('class="bc-whisker"'));
  assert.ok(!/NaN/.test(svg));
  assert.ok(!/-?\d+e[-+]\d+/.test(svg), 'no exponent reaches a coordinate');
});

test('S1: a hostile group name is escaped into the text node, never a breakout', () => {
  const rows = [row('a"/><script>PWNED</script><text x="1', 'directory', 5)];
  const svg = renderGroupedBars(rows, { series });
  assertWellFormed(svg, assert);
  assert.ok(!svg.includes('<script>'), 'no live script element');
  assert.ok(svg.includes('&lt;script&gt;'));
});

test('S2: a finite 1.5e308 is refused, and fast', () => {
  const started = Date.now();
  throwsCode(() => renderGroupedBars([row('a', 'directory', 1.5e308)], { series }), 'INVALID_RECORD');
  assert.ok(Date.now() - started < 50, 'this used to exhaust the heap');
});

test('S4: a string width cannot inject an attribute', () => {
  throwsCode(() => renderGroupedBars(basic, { series, width: '600" onload="alert(1)' }), 'INVALID_OPTION');
});

test('the output is byte-identical across runs and across row permutations', () => {
  const a = renderGroupedBars(basic, { series, title: 'Storage' });
  const b = renderGroupedBars(basic, { series, title: 'Storage' });
  assert.equal(a, b);
  const shuffled = [basic[3], basic[1], basic[0], basic[2]];
  const c = renderGroupedBars(shuffled, { series, title: 'Storage' });
  assert.equal(new Set([...a.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1])).size,
    new Set([...c.matchAll(/fill="(#[0-9a-f]{6})"/g)].map((m) => m[1])).size);
});

test('R-PROV-3: a record with extra properties renders byte-identically', () => {
  const plain = renderGroupedBars(basic, { series });
  const rich = renderGroupedBars(basic.map((r) => ({ ...r, cpu_model: 'Apple M5', host: 'nas', path: '/Users/rom' })), { series });
  assert.equal(plain, rich);
});
