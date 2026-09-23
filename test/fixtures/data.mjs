/**
 * Chart-input shaped, synthetic, never harness output.
 *
 * A fixture built from a real report drags the report's vocabulary and its
 * provenance into the test suite, and the provenance is the thing the library
 * promises to keep out.
 */

export const BAR_ROWS = [
  { group: 'read-cold', series: 'directory', value: 128.4, error: 6.1 },
  { group: 'read-cold', series: 'pmtiles', value: 96.2, error: 4.4 },
  { group: 'read-warm', series: 'directory', value: 42.7, error: 2.0 },
  { group: 'read-warm', series: 'pmtiles', value: 31.9, error: 1.7 },
  { group: 'write', series: 'directory', value: 210.5, error: 11.2 },
  { group: 'write', series: 'pmtiles', value: 233.1, error: 12.8 },
  { group: 'trim', series: 'directory', value: 0 },
];

export const TREND_POINTS = [0, 1, 2, 3, 4].flatMap((step) => [
  { step, series: 'alpha', value: 88 + step * 1.5, label: `v0.${step + 1}` },
  { step, series: 'beta', value: 92 - step * 0.8, label: `v0.${step + 1}` },
]);

export const SWEEP_POINTS = [1, 2, 4, 8, 16, 32].flatMap((x) => [
  { x, series: 'alpha', value: 2200 + x * 70 },
  { x, series: 'beta', value: 2400 + x * 62 },
]);

export const SERIES_DEFS = [
  { key: 'directory', label: 'Directory', color: '#34a853' },
  { key: 'pmtiles', label: 'PMTiles', color: '#2196f3' },
  { key: 'alpha', label: 'Alpha', color: '#ab47bc' },
  { key: 'beta', label: 'Beta', color: '#c62828' },
];

export const CHARTS = [
  ['grouped-bars', 'renderGroupedBars', BAR_ROWS,
    { title: 'Storage backends', unit: 'ms', better: 'lower', errorLabel: '95% CI' }],
  ['trend', 'renderTrend', TREND_POINTS, { title: 'Release history', unit: 'ms', better: 'lower' }],
  ['sweep', 'renderSweep', SWEEP_POINTS,
    { title: 'Concurrency scan', scale: 'log', xLabel: 'workers', yLabel: 'tiles/s' }],
];
