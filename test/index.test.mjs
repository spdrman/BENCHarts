import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/index.js';

test('the public surface is exactly what the spec publishes', () => {
  assert.deepEqual(Object.keys(api).sort(), [
    'BenchartsError', 'DEFAULT_FALLBACK_COLORS', 'ERROR_CODES', 'defineSeries',
    'formatLogTick', 'formatNumber', 'renderGroupedBars', 'renderPlaceholder',
    'renderSweep', 'renderTrend', 'scanForDisclosure',
  ]);
});

test('D8: the scale helpers are not reachable from the surface', () => {
  for (const internal of ['log10Scale', 'linearScale', 'enclosingDecades', 'decadeTicks', 'escapeXml']) {
    assert.ok(!(internal in api), `${internal} would be frozen by exporting it`);
  }
});

test('D4: no project vocabulary survives on the surface', () => {
  const names = Object.keys(api).join(' ');
  for (const word of ['engine', 'ENGINE', 'vips', 'tile', 'Tile', 'causl', 'wallTime', 'rss']) {
    assert.ok(!names.includes(word), `${word} is one project's vocabulary`);
  }
});

test('the three families and the placeholder are callable', () => {
  for (const fn of ['renderGroupedBars', 'renderTrend', 'renderSweep', 'renderPlaceholder', 'defineSeries']) {
    assert.equal(typeof api[fn], 'function', fn);
  }
});
