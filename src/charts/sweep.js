/**
 * Sweep: a log-log or linear scan of one independent variable against one
 * metric, one polyline per series.
 *
 * @module
 */

import { ERROR_CODES, fail } from '../error.js';
import { escapeXml, formatCoord, formatLogTick, formatNumber } from '../format.js';
import { isSeriesSet } from '../series.js';
import { validateOptions, checkSweepPoints } from '../validate.js';
import { log10Scale, linearScale, decadeTicks, isPlottableLog, isPlottable } from '../scale.js';
import {
  svgDocument, layoutLegend, legendMarkup, niceTicks, snap125, pointsAttr, INK_VAR,
} from '../svg.js';

const ALLOWED = {
  series: 'object',
  title: 'label',
  unit: 'label',
  better: ['lower', 'higher'],
  width: 'dimension',
  height: 'dimension',
  scale: ['log', 'linear'],
  xLabel: 'label',
  yLabel: 'label',
  xMin: 'number',
  theme: ['auto', 'light', 'dark'],
  surface: ['opaque', 'transparent'],
};

const PAD_L = 60;
const PAD_R = 24;
const PAD_B = 52;
const PLOT_H = 240;
const MAX_TICKS = 12;

/**
 * @typedef {object} SweepOptions
 * @property {import('../series.js').SeriesSet} series
 * @property {string} [title]
 * @property {string} [unit]
 * @property {'lower'|'higher'} [better]
 * @property {number} [width]
 * @property {number} [height]
 * @property {'auto'|'light'|'dark'} [theme]
 * @property {'opaque'|'transparent'} [surface]
 * @property {'log'|'linear'} [scale]
 * @property {string} [xLabel]
 * @property {string} [yLabel]
 * @property {number} [xMin]
 */

/**
 * @param {unknown} points
 * @param {Partial<SweepOptions>} [opts]
 * @returns {string}
 */
export function renderSweep(points, opts = {}) {
  validateOptions(/** @type {any} */ (opts), ALLOWED);
  const o = /** @type {SweepOptions} */ (opts);
  const { series, title, unit, better, scale = 'log', xLabel, yLabel, xMin, theme, surface } = o;
  if (!isSeriesSet(series)) {
    fail(ERROR_CODES.INVALID_OPTION,
      'series must be the SeriesSet defineSeries returned', { option: 'series' });
  }

  const data = checkSweepPoints(points);
  const windowed = data.rows.filter((r) => (xMin === undefined ? true : r.x >= xMin));
  const logMode = scale === 'log';
  const plottableValue = (/** @type {number} */ v) => (logMode ? isPlottableLog(v) : isPlottable(v));

  const drawable = windowed.filter((r) => plottableValue(r.value) && (logMode ? isPlottableLog(r.x) : isPlottable(r.x)));
  // Dropped ON A LOG AXIS is a documented degradation, not an error: the caller
  // measured a zero and a log axis cannot hold it.
  const omitted = windowed.filter((r) => !plottableValue(r.value) && Number.isFinite(r.value));
  if (drawable.length === 0) {
    fail(ERROR_CODES.NO_PLOTTABLE_POINTS,
      xMin === undefined
        ? 'no point is plottable on this axis'
        : `no point survives xMin ${xMin}`,
      { records: data.rows.length, windowed: windowed.length, xMin });
  }

  /** @type {string[]} */ const presentKeys = [];
  for (const r of drawable) if (!presentKeys.includes(r.series)) presentKeys.push(r.series);
  const resolved = series.resolve(presentKeys);
  const present = resolved.present;

  const xs = drawable.map((r) => r.x);
  const vs = drawable.map((r) => r.value);
  const [xLo, xHi] = logMode ? snap125(Math.min(...xs), Math.max(...xs)) : [Math.min(...xs), Math.max(...xs)];
  const [yLo, yHi] = logMode ? snap125(Math.min(...vs), Math.max(...vs)) : [0, Math.max(...vs)];

  const width = o.width ?? 720;
  const available = width - PAD_L - PAD_R;
  const subtitleParts = [];
  if (unit) subtitleParts.push(unit);
  if (better) subtitleParts.push(`${better} is better`);
  if (omitted.length > 0) {
    subtitleParts.push(`${omitted.length} point${omitted.length === 1 ? '' : 's'} omitted: a log axis cannot hold a non-positive value`);
  }
  const subtitle = subtitleParts.join(' · ');

  const headerH = (title ? 24 : 4) + (subtitle ? 16 : 0);
  const legend = layoutLegend(
    present.map((/** @type {string} */ key) => ({ key, label: resolved.labelOf(key), color: resolved.colorOf(key) })),
    available, 11,
  );
  const legendY = headerH + 2;
  const plotTop = legendY + legend.height + 10;
  const height = o.height ?? plotTop + PLOT_H + PAD_B;
  const plotBottom = height - PAD_B;

  const x = logMode ? log10Scale(xLo, xHi, PAD_L, PAD_L + available) : linearScale(xLo, xHi, PAD_L, PAD_L + available);
  const y = logMode ? log10Scale(yLo, yHi, plotBottom, plotTop) : linearScale(yLo, yHi, plotBottom, plotTop);

  const parts = [];
  if (title) {
    parts.push(`<text x="${formatCoord(PAD_L)}" y="18" font-size="13" font-weight="600"`
      + ` fill="${INK_VAR.primary}">${escapeXml(title)}</text>`);
  }
  if (subtitle) {
    parts.push(`<text x="${formatCoord(PAD_L)}" y="${formatCoord(headerH - 2)}" font-size="11"`
      + ` fill="${INK_VAR.secondary}">${escapeXml(subtitle)}</text>`);
  }
  parts.push(legendMarkup(legend, PAD_L, legendY, 11));

  const yTicks = logMode ? logTicks(yLo, yHi) : niceTicks(yHi);
  for (const tick of yTicks) {
    const ty = y(tick);
    parts.push(`<line x1="${formatCoord(PAD_L)}" y1="${formatCoord(ty)}" x2="${formatCoord(PAD_L + available)}"`
      + ` y2="${formatCoord(ty)}" stroke="${INK_VAR.grid}" stroke-width="1"/>`
      + `<text class="bc-ytick" x="${formatCoord(PAD_L - 6)}" y="${formatCoord(ty + 3)}" text-anchor="end"`
      + ` font-size="9" fill="${INK_VAR.muted}">${escapeXml(logMode ? formatLogTick(tick) : formatNumber(tick))}</text>`);
  }
  const xTicks = logMode ? logTicks(xLo, xHi) : niceTicks(xHi);
  for (const tick of xTicks) {
    const tx = x(tick);
    parts.push(`<text class="bc-xtick" x="${formatCoord(tx)}" y="${formatCoord(plotBottom + 16)}"`
      + ` text-anchor="middle" font-size="9" fill="${INK_VAR.muted}">`
      + `${escapeXml(logMode ? formatLogTick(tick) : formatNumber(tick))}</text>`);
  }

  for (const key of present) {
    const colour = resolved.colorOf(key);
    const line = drawable.filter((r) => r.series === key).sort((a, b) => a.x - b.x);
    if (line.length === 1) {
      parts.push(`<circle class="bc-dot" cx="${formatCoord(x(line[0].x))}" cy="${formatCoord(y(line[0].value))}"`
        + ` r="3" fill="${escapeXml(colour)}"/>`);
    } else if (line.length > 1) {
      parts.push('<polyline class="bc-line" points="'
        + `${pointsAttr(line.map((r) => [x(r.x), y(r.value)]))}" fill="none" stroke="${escapeXml(colour)}"`
        + ' stroke-width="2" stroke-linejoin="round"/>');
    }
    for (const r of omitted.filter((o) => o.series === key)) {
      if (!isPlottableLog(r.x) && logMode) continue;
      parts.push(`<circle class="bc-omitted" cx="${formatCoord(x(r.x))}" cy="${formatCoord(plotBottom)}"`
        + ` r="3" fill="none" stroke="${escapeXml(colour)}" stroke-width="1"/>`);
    }
  }

  if (xLabel) {
    parts.push(`<text x="${formatCoord(PAD_L + available / 2)}" y="${formatCoord(height - 12)}"`
      + ` text-anchor="middle" font-size="10" fill="${INK_VAR.secondary}">${escapeXml(xLabel)}</text>`);
  }
  if (yLabel) {
    const cy = (plotTop + plotBottom) / 2;
    parts.push(`<text x="14" y="${formatCoord(cy)}" text-anchor="middle" font-size="10"`
      + ` fill="${INK_VAR.secondary}" transform="rotate(-90 14 ${formatCoord(cy)})">${escapeXml(yLabel)}</text>`);
  }

  return svgDocument({ width, height, body: parts.join(''), theme, surface });
}

/**
 * Ticks for a log axis.
 *
 * A span of less than a decade contains no power of ten at all, so decade
 * majors come back empty and the axis would carry no labels. That is the same
 * failure as stretching 2200..4500 out to 1000..10000: the reader loses the
 * scale. 1-2-5 ticks inside the snapped bounds keep it.
 */
/** @param {number} lo @param {number} hi @returns {number[]} */
function logTicks(lo, hi) {
  const major = decadeTicks(lo, hi).major;
  if (major.length >= 2) return thin(major);
  /** @type {number[]} */ const out = [];
  const from = Math.floor(Math.log10(lo));
  const to = Math.ceil(Math.log10(hi));
  for (let k = from; k <= to && out.length < MAX_TICKS; k++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** k;
      if (Number.isFinite(v) && v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v);
    }
  }
  return out.length >= 2 ? out : [lo, hi];
}

/** Keep a 301-decade axis from emitting 301 labelled gridlines. */
/** @param {number[]} ticks @returns {number[]} */
function thin(ticks) {
  if (ticks.length <= MAX_TICKS) return ticks;
  const stride = Math.ceil(ticks.length / MAX_TICKS);
  return ticks.filter((_, /** @type {number} */ i) => i % stride === 0 || i === ticks.length - 1);
}
