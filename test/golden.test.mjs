import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bencharts from '../src/index.js';
import { defineSeries } from '../src/series.js';
import { CHARTS, SERIES_DEFS } from './fixtures/data.mjs';
import { assertWellFormed, hasForbiddenChars } from './lib/xml.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const series = defineSeries(SERIES_DEFS);
const render = ([, fn, rows, opts]) => bencharts[fn](rows, { ...opts, series });
const goldenPath = (name) => join(root, 'golden', 'svg', `${name}.svg`);

for (const chart of CHARTS) {
  const [name] = chart;
  test(`${name} matches its golden byte for byte`, () => {
    assert.equal(render(chart), readFileSync(goldenPath(name), 'utf8'),
      'run tools/update-goldens.mjs and review the diff if this change was intended');
  });

  test(`${name} renders identically twice, so nothing in it is ambient`, () => {
    assert.equal(render(chart), render(chart));
  });

  test(`${name} is well-formed XML carrying no forbidden character`, () => {
    const svg = render(chart);
    assertWellFormed(svg, assert, `${name}: `);
    assert.ok(!hasForbiddenChars(svg));
  });

  test(`${name} carries no script element`, () => {
    assert.ok(!/<script[\s>]/i.test(render(chart)), 'S1 is the reason this is its own check');
  });

  test(`${name} discloses nothing`, () => {
    const found = bencharts.scanForDisclosure(render(chart));
    assert.deepEqual(found, [], found.map((f) => `${f.rule}: ${f.match}`).join(', '));
  });

  test(`${name} is inside the byte budget`, () => {
    const svg = render(chart);
    assert.ok(svg.length <= 24_000, `${svg.length} bytes, budget 24000`);
  });
}

test('the manifest agrees with the files on disk', () => {
  const manifest = readFileSync(join(root, 'golden', 'RENDERS.sha256'), 'utf8').trim().split('\n');
  assert.equal(manifest.length, CHARTS.length);
  for (const line of manifest) {
    const [sha, rel] = line.split(/\s+/);
    const body = readFileSync(join(root, 'golden', rel.replace(/^svg\//, 'svg/')), 'utf8');
    assert.equal(createHash('sha256').update(body).digest('hex'), sha, `${rel} drifted from the manifest`);
  }
});

/* The per-record budget belongs on the MARGINAL cost, not on total/records.
 * A chart carries fixed overhead (the token block, the legend, the axis), so
 * dividing a small fixture's total by seven measures the overhead rather than
 * the per-mark cost the budget exists to police. */
test('output bytes grow linearly with records, so a per-mark duplication shows up', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ group: `g${i}`, series: 'alpha', value: i + 1 }));
  const small = bencharts.renderGroupedBars(rows(10), { series, width: 4000 }).length;
  const large = bencharts.renderGroupedBars(rows(40), { series, width: 4000 }).length;
  const perRecord = (large - small) / 30;
  assert.ok(perRecord < 800, `${Math.round(perRecord)} bytes per extra record`);
  assert.ok(large < small * 6, 'growth must be linear, not quadratic');
});
