import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWellFormed } from './lib/xml.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const blocks = [...readme.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);

test('the README carries the two worked examples', () => {
  assert.equal(blocks.length, 2, 'one per family shown');
});

/* Running them is the point: an example that drifts from the API is worse than
 * no example, because it is read as authoritative. */
test('the grouped bars example runs and renders parseable SVG', async () => {
  const src = blocks[0]
    .replace(/^import .*$/gm, '')
    .replace("writeFileSync('storage.svg', svg);", '')
    .replace('report.cells', 'REPORT.cells');
  const fn = new Function('defineSeries', 'renderGroupedBars', 'REPORT', `${src}\nreturn svg;`);
  const api = await import('../src/index.js');
  const svg = fn(api.defineSeries, api.renderGroupedBars, {
    cells: [
      { scenario: 'read', backend: 'directory', wall_ms: 12.4, ci95: 0.8 },
      { scenario: 'read', backend: 'pmtiles', wall_ms: 9.1, ci95: 0.5 },
      { scenario: 'write', backend: 'directory', wall_ms: 22.0, ci95: 1.1 },
    ],
  });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('Storage backends') && svg.includes('95% CI'));
});

test('the sweep example runs, and its disclosure gate passes on its own output', async () => {
  const src = blocks[1].replace(/^import .*$/gm, '');
  const fn = new Function('defineSeries', 'renderSweep', 'scanForDisclosure', 'points', `${src}\nreturn svg;`);
  const api = await import('../src/index.js');
  const points = [1, 2, 4, 8].flatMap((x) => [
    { x, series: 'alpha', value: 2000 + x * 50 },
    { x, series: 'beta', value: 2200 + x * 40 },
  ]);
  const svg = fn(api.defineSeries, api.renderSweep, api.scanForDisclosure, points);
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('Concurrency scan'));
});

test('the README does not promise an option the renderers refuse', async () => {
  const api = await import('../src/index.js');
  const series = api.defineSeries([{ key: 'a' }]);
  for (const claimed of [{ theme: 'dark' }, { theme: 'light' }, { surface: 'transparent' }]) {
    assert.doesNotThrow(() => api.renderGroupedBars([{ group: 'g', series: 'a', value: 1 }], { series, ...claimed }),
      JSON.stringify(claimed));
  }
});
