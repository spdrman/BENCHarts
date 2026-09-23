/**
 * Trend: a timeline of released versions, one polyline per series, with gaps
 * where a series is missing from a snapshot.
 *
 * @module
 */

import { ERROR_CODES, fail } from '../error.js';
import { escapeXml, formatCoord, formatNumber } from '../format.js';
import { isSeriesSet } from '../series.js';
import { validateOptions, validateRecords } from '../validate.js';
import { linearScale } from '../scale.js';
import {
  svgDocument, layoutLegend, legendMarkup, niceTicks, INK_VAR,
} from '../svg.js';

const ALLOWED = {
  series: 'object',
  title: 'label',
  unit: 'label',
  better: ['lower', 'higher'],
  width: 'dimension',
  height: 'dimension',
  theme: ['auto', 'light', 'dark'],
  surface: ['opaque', 'transparent'],
};

const PAD_L = 56;
const PAD_R = 24;
const PAD_B = 44;
const PLOT_H = 220;

/**
 * @param {readonly {step: number, series: string, value: number, label?: string}[]} points
 * @param {object} [opts]
 * @returns {string}
 */
export function renderTrend(points, opts = {}) {
  validateOptions(/** @type {any} */ (opts), ALLOWED);
  const { series, title, unit, better, theme, surface } = /** @type {any} */ (opts);
  if (!isSeriesSet(series)) {
    fail(ERROR_CODES.INVALID_OPTION,
      'series must be the SeriesSet defineSeries returned', { option: 'series' });
  }

  const data = validateRecords(points, 'trend');
  const resolved = series.resolve(data.seriesKeys);
  const steps = [...data.axisValues].sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b));
  const present = resolved.present;

  const values = data.rows.map((r) => r.value).filter((v) => Number.isFinite(v));
  if (values.length === 0) {
    fail(ERROR_CODES.NO_PLOTTABLE_POINTS,
      'no step carries a finite value', { records: data.rows.length });
  }

  // Padded, not zero-based. The golden history renders three engines as flat
  // lines at 85 to 95 on a 0 to 141 scale, where a 5% regression is
  // indistinguishable from noise, and that is the one chart an engineer uses to
  // decide whether a change made things slower.
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
  // Pad first, then snap out to the tick step, so every datum sits between two
  // labelled gridlines rather than above the lowest one.
  const roughSpan = (hi + pad) - (lo - pad);
  const tickStep = niceTicks(roughSpan)[1] || 1;
  const yLo = Math.floor((lo - pad) / tickStep) * tickStep;
  const yHi = Math.ceil((hi + pad) / tickStep) * tickStep;

  const width = opts.width ?? Math.max(420, PAD_L + steps.length * 90 + PAD_R);
  const available = width - PAD_L - PAD_R;
  const subtitleParts = ['y axis is not zero-based'];
  if (unit) subtitleParts.unshift(unit);
  if (better) subtitleParts.splice(1, 0, `${better} is better`);
  const subtitle = subtitleParts.join(' · ');

  const headerH = (title ? 24 : 4) + 16;
  const legend = layoutLegend(
    present.map((key) => ({ key, label: resolved.labelOf(key), color: resolved.colorOf(key) })),
    available, 11,
  );
  const legendY = headerH + 2;
  const plotTop = legendY + legend.height + 10;
  const height = opts.height ?? plotTop + PLOT_H + PAD_B;
  const plotBottom = height - PAD_B;

  const y = linearScale(yLo, yHi, plotBottom, plotTop);
  const x = steps.length === 1
    ? () => PAD_L + available / 2
    : linearScale(/** @type {number} */ (steps[0]), /** @type {number} */ (steps[steps.length - 1]),
      PAD_L, PAD_L + available);

  const parts = [];
  if (title) {
    parts.push(`<text x="${formatCoord(PAD_L)}" y="18" font-size="13" font-weight="600"`
      + ` fill="${INK_VAR.primary}">${escapeXml(title)}</text>`);
  }
  parts.push(`<text x="${formatCoord(PAD_L)}" y="${formatCoord(headerH - 2)}" font-size="11"`
    + ` fill="${INK_VAR.secondary}">${escapeXml(subtitle)}</text>`);
  parts.push(legendMarkup(legend, PAD_L, legendY, 11));

  const stepSize = tickStep;
  const first = Math.ceil(yLo / stepSize) * stepSize;
  for (let v = first, guard = 0; v <= yHi + stepSize * 1e-9 && guard < 12; v += stepSize, guard++) {
    const ty = y(v);
    parts.push(`<line x1="${formatCoord(PAD_L)}" y1="${formatCoord(ty)}" x2="${formatCoord(PAD_L + available)}"`
      + ` y2="${formatCoord(ty)}" stroke="${INK_VAR.grid}" stroke-width="1"/>`
      + `<text class="bc-ytick" x="${formatCoord(PAD_L - 6)}" y="${formatCoord(ty + 3)}" text-anchor="end"`
      + ` font-size="9" fill="${INK_VAR.muted}">${escapeXml(formatNumber(v))}</text>`);
  }

  // A step where nothing at all was measured must not break every line: that
  // shatters the chart into single points. A step where SOME series reported is
  // a genuine gap for the ones that did not.
  const measured = new Set(steps.filter((s) => {
    const bySeries = data.index.get(s);
    return present.some((k) => {
      const i = bySeries?.get(k);
      return i !== undefined && Number.isFinite(data.rows[i].value);
    });
  }));

  for (const key of present) {
    const colour = resolved.colorOf(key);
    /** @type {string[][]} */ const segments = [];
    let current = [];
    for (const step of steps) {
      const i = data.index.get(step)?.get(key);
      const row = i === undefined ? undefined : data.rows[i];
      if (row && Number.isFinite(row.value)) {
        current.push(`${formatCoord(x(/** @type {number} */ (step)))},${formatCoord(y(row.value))}`);
      } else if (measured.has(step)) {
        if (current.length) segments.push(current);
        current = [];
      }
    }
    if (current.length) segments.push(current);

    for (const segment of segments) {
      if (segment.length === 1) {
        const [cx, cy] = segment[0].split(',');
        parts.push(`<circle class="bc-dot" cx="${cx}" cy="${cy}" r="3" fill="${escapeXml(colour)}"/>`);
      } else {
        parts.push(`<polyline class="bc-line" points="${segment.join(' ')}" fill="none"`
          + ` stroke="${escapeXml(colour)}" stroke-width="2" stroke-linejoin="round"/>`);
      }
    }
  }

  for (const step of steps) {
    const label = data.stepLabels.get(/** @type {number} */ (step)) ?? String(step);
    parts.push(`<text class="bc-xtick" x="${formatCoord(x(/** @type {number} */ (step)))}"`
      + ` y="${formatCoord(plotBottom + 16)}" text-anchor="middle" font-size="9"`
      + ` fill="${INK_VAR.muted}">${escapeXml(label)}</text>`);
  }

  return svgDocument({ width, height, body: parts.join(''), theme, surface });
}
