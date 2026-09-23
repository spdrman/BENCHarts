import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unsafeInterpolations, expressionIsSafe, emitsMarkup } from './lib/scan-source.mjs';
import { renderGroupedBars, renderTrend, renderSweep, defineSeries, renderPlaceholder } from '../src/index.js';
import { assertWellFormed } from './lib/xml.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const series = defineSeries([{ key: 'a', label: 'Alpha', color: '#34a853' }]);
const bar = (group, value) => ({ group, series: 'a', value });
const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
  return true;
});

function sources(dir = join(root, 'src'), acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

/* The scanner is checked before it is trusted, the same way the palette
 * validator is. P8's stated proof is this one: a deliberately added raw
 * ${title} has to fail the build. */
test('R-ESC-1: the scanner rejects a raw interpolation of caller data', () => {
  const planted = 'const x = `<text y="1">${title}</text>`;';
  const found = unsafeInterpolations(planted, 'planted.js');
  assert.equal(found.length, 1);
  assert.equal(found[0].expression, 'title');
});

test('R-ESC-1: the scanner rejects a raw interpolation in an attribute too', () => {
  assert.equal(unsafeInterpolations('const x = `<rect fill="${colour}"/>`;', 'p.js').length, 1);
  assert.equal(unsafeInterpolations('const x = `<rect width="${w}"/>`;', 'p.js').length, 1);
});

test('R-ESC-1: the scanner accepts what it should, and nothing more', () => {
  assert.ok(expressionIsSafe('escapeXml(title)'));
  assert.ok(expressionIsSafe('formatCoord(x + 1)'));
  assert.ok(expressionIsSafe('INK_VAR.muted'));
  assert.ok(!expressionIsSafe('title'));
  assert.ok(!expressionIsSafe('String(title)'));
  assert.ok(!expressionIsSafe('title.replace(/</g, "")'), 'a hand-rolled escape is not the approved one');
  assert.ok(emitsMarkup('<text y="1">'));
  assert.ok(!emitsMarkup('record 3 has no value'), 'an error message is not markup');
});

test('R-ESC-1: no source file carries an unapproved interpolation', () => {
  const bad = [];
  for (const file of sources()) {
    bad.push(...unsafeInterpolations(readFileSync(file, 'utf8'), relative(root, file)));
  }
  assert.deepEqual(bad, [],
    bad.map((b) => `${b.file}: \${${b.expression}}`).join('\n'));
});

/* Each reproduction from SPEC.md §4, end to end through a renderer. */

test('S1: a theme colour cannot reach fill= raw, because it never gets that far', () => {
  throwsCode(() => defineSeries([{ key: 'a', color: '#000"/><script>PWNED</script><rect fill="#000' }]), 'INVALID_COLOR');
});

test('S1: a hostile title is escaped, and no script element survives', () => {
  const svg = renderGroupedBars([bar('g', 1)], { series, title: 'a"/><script>PWNED</script><text x="1' });
  assertWellFormed(svg, assert);
  assert.ok(!/<script[\s>]/i.test(svg));
  assert.ok(svg.includes('&lt;script&gt;'));
});

test('S2: a finite 1.5e308 is refused by every family, in bounded time', () => {
  const started = Date.now();
  throwsCode(() => renderGroupedBars([bar('g', 1.5e308)], { series }), 'INVALID_RECORD');
  throwsCode(() => renderTrend([{ step: 0, series: 'a', value: 1.5e308 }], { series }), 'INVALID_RECORD');
  throwsCode(() => renderSweep([{ x: 1, series: 'a', value: 1.5e308 }], { series }), 'INVALID_RECORD');
  assert.ok(Date.now() - started < 100, 'this used to exhaust the heap under a 512 MB cap');
});

test('S3: a control character is refused, so the document cannot become invalid XML', () => {
  throwsCode(() => renderGroupedBars([bar('v1\x01', 1)], { series }), 'INVALID_RECORD');
  throwsCode(() => renderGroupedBars([bar('g', 1)], { series, title: 'v1\x01' }), 'INVALID_OPTION');
  throwsCode(() => renderTrend([{ step: 0, series: 'a', value: 1, label: 'v1\x01' }], { series }), 'INVALID_RECORD');
});

test('S4: width and height are never interpolated raw', () => {
  for (const bad of ['800" onload="alert(1)', '800', {}, [], Number.NaN, Infinity, 0, -1, 16385]) {
    throwsCode(() => renderGroupedBars([bar('g', 1)], { series, width: bad }), 'INVALID_OPTION');
  }
  throwsCode(() => renderPlaceholder({ width: '1" x="2', height: 100, message: 'x' }), 'INVALID_OPTION');
});

test('S5: 2000 rows produce 2000 marks, not groups times series worth of cells', () => {
  const rows = Array.from({ length: 2000 }, (_, i) => bar(`g${i}`, i + 1));
  const started = Date.now();
  const svg = renderGroupedBars(rows, { series, width: 16000 });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 2000);
  assert.ok(svg.length < 1_500_000, `${svg.length} bytes; the old behaviour produced 320 MB`);
  assert.ok(Date.now() - started < 2000, 'and 4000 rows used to throw RangeError after 28.7 s');
});

test('S6: a joined cell key would collide, and the nested index does not', () => {
  const svg = renderGroupedBars([
    { group: 'a|b', series: 'a', value: 1 },
    { group: 'a', series: 'a', value: 2 },
  ], { series });
  assert.equal((svg.match(/class="bc-bar"/g) || []).length, 2, 'two cells, two bars');
});

test('the eight text interpolation points all escape, tested with the known payloads', () => {
  const payloads = ['"/><script>', 'x" onload=', '<!--', ']]>', '&amp;', '&', '· ok'];
  for (const payload of payloads) {
    const svg = renderGroupedBars([bar(payload, 1)], { series, title: payload, unit: payload });
    assertWellFormed(svg, assert, `payload ${JSON.stringify(payload)}: `);
    assert.ok(!/<script[\s>]/i.test(svg));
  }
});

test('a lone surrogate is refused rather than being replaced on write', () => {
  throwsCode(() => renderGroupedBars([bar('a\uD800b', 1)], { series }), 'INVALID_RECORD');
});
