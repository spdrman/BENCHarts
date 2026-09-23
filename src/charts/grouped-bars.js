/**
 * Grouped bars: one column group per benchmark config, one bar per series,
 * optional error whiskers.
 *
 * @module
 */

import { ERROR_CODES, fail } from '../error.js';
import { escapeXml, formatCoord, formatNumber } from '../format.js';
import { isSeriesSet } from '../series.js';
import { validateOptions, validateRecords } from '../validate.js';
import {
  svgDocument, layoutLegend, legendMarkup, niceTicks, estimateTextWidth,
  LEGEND_ROW_HEIGHT, INK_VAR,
} from '../svg.js';

const ALLOWED = {
  series: 'object',
  title: 'label',
  unit: 'label',
  better: ['lower', 'higher'],
  width: 'dimension',
  height: 'dimension',
  errorLabel: 'label',
  theme: ['auto', 'light', 'dark'],
  surface: ['opaque', 'transparent'],
};

const BAR_W = 20;
const BAR_GAP = 2;
const GROUP_GAP = 32;
const PAD_L = 56;
const PAD_R = 20;
const PAD_B = 44;
const PLOT_H = 200;
const LABEL_ALL_UP_TO = 12;

/**
 * @param {readonly {group: string, series: string, value: number, error?: number}[]} rows
 * @param {object} [opts]
 * @returns {string}
 */
export function renderGroupedBars(rows, opts = {}) {
  validateOptions(/** @type {any} */ (opts), ALLOWED);
  const { series, title, unit, better, errorLabel, theme, surface } = /** @type {any} */ (opts);
  if (!isSeriesSet(series)) {
    fail(ERROR_CODES.INVALID_OPTION,
      'series must be the SeriesSet defineSeries returned, checked by brand rather than by shape',
      { option: 'series' });
  }

  const data = validateRecords(rows, 'bar');
  const resolved = series.resolve(data.seriesKeys);
  const groups = data.axisValues;
  const present = resolved.present;

  const values = data.rows.map((r) => r.value).filter((v) => Number.isFinite(v));
  if (values.length === 0) {
    fail(ERROR_CODES.NO_PLOTTABLE_POINTS,
      'every record has a non-finite value, so there is nothing to draw',
      { records: data.rows.length });
  }
  const drewWhiskers = data.rows.some((r) => typeof r.error === 'number' && r.error > 0);
  const ticks = niceTicks(Math.max(...values, ...data.rows.map((r) =>
    Number.isFinite(r.value) && typeof r.error === 'number' ? r.value + r.error : Number.NEGATIVE_INFINITY)));
  const yMax = ticks[ticks.length - 1];

  // Content-sized unless the caller fixes it, and squeezed to fit when they do.
  const naturalGroup = present.length * BAR_W + Math.max(0, present.length - 1) * BAR_GAP;
  const naturalContent = groups.length * naturalGroup + Math.max(0, groups.length - 1) * GROUP_GAP;
  // Floor the plot region, not the whole canvas: a floor on the total masks
  // content sizing entirely until the content outgrows it, which is most small
  // charts.
  const width = opts.width ?? PAD_L + Math.max(160, naturalContent) + PAD_R;
  const available = width - PAD_L - PAD_R;
  const squeeze = naturalContent > available ? available / naturalContent : 1;
  const barW = Math.max(1, BAR_W * squeeze);
  const barGap = BAR_GAP * squeeze;
  const groupGap = GROUP_GAP * squeeze;
  const groupW = present.length * barW + Math.max(0, present.length - 1) * barGap;

  const subtitleParts = [];
  if (unit) subtitleParts.push(unit);
  if (better) subtitleParts.push(`${better} is better`);
  if (drewWhiskers && errorLabel) subtitleParts.push(errorLabel);
  const subtitle = subtitleParts.join(' · ');

  const headerH = (title ? 24 : 4) + (subtitle ? 16 : 0);
  const legend = layoutLegend(
    present.map((key) => ({ key, label: resolved.labelOf(key), color: resolved.colorOf(key) })),
    available, 11,
  );
  const legendY = headerH + 2;
  const plotTop = legendY + legend.height + 10;
  const height = opts.height ?? plotTop + PLOT_H + PAD_B;
  const plotBottom = height - PAD_B;
  const plotH = Math.max(1, plotBottom - plotTop);
  const y = (/** @type {number} */ v) => plotBottom - (v / yMax) * plotH;

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

  for (const tick of ticks) {
    const ty = y(tick);
    parts.push(`<line x1="${formatCoord(PAD_L)}" y1="${formatCoord(ty)}" x2="${formatCoord(width - PAD_R)}"`
      + ` y2="${formatCoord(ty)}" stroke="${tick === 0 ? INK_VAR.axis : INK_VAR.grid}" stroke-width="1"/>`
      + `<text x="${formatCoord(PAD_L - 6)}" y="${formatCoord(ty + 3)}" text-anchor="end" font-size="9"`
      + ` fill="${INK_VAR.muted}">${escapeXml(formatNumber(tick))}</text>`);
  }

  const totalCells = groups.length * present.length;
  groups.forEach((group, gi) => {
    const gx = PAD_L + gi * (groupW + groupGap);
    const bySeries = data.index.get(group);
    const finite = present
      .map((key) => ({ key, row: bySeries?.get(key) !== undefined ? data.rows[bySeries.get(key)] : undefined }))
      .filter((c) => c.row && Number.isFinite(c.row.value));
    let labelled = new Set(present);
    if (totalCells > LABEL_ALL_UP_TO && finite.length > 0) {
      const sorted = [...finite].sort((a, b) => a.row.value - b.row.value);
      labelled = new Set([sorted[0].key, sorted[sorted.length - 1].key]);
    }

    present.forEach((key, si) => {
      const x = gx + si * (barW + barGap);
      const mid = x + barW / 2;
      const hit = bySeries?.get(key);
      const record = hit === undefined ? undefined : data.rows[hit];
      const colour = resolved.colorOf(key);

      if (record === undefined || !Number.isFinite(record.value)) {
        // Absent and unmeasurable both keep the slot and say so. "Not
        // benchmarked" must never read as "0".
        parts.push(`<text class="bc-absent" x="${formatCoord(mid)}" y="${formatCoord(plotBottom - 4)}"`
          + ` text-anchor="middle" font-size="9" fill="${INK_VAR.muted}">n/a</text>`);
        return;
      }

      const value = record.value;
      const top = value === 0 ? plotBottom - 2 : y(value);
      const h = Math.max(2, plotBottom - top);
      const r = Math.min(4, barW / 2, h);
      // Rounded at the data end, square at the baseline, so the bar reads as
      // growing from the axis rather than floating.
      parts.push(`<path class="bc-bar" d="M${formatCoord(x)},${formatCoord(plotBottom)}`
        + `L${formatCoord(x)},${formatCoord(top + r)}`
        + `Q${formatCoord(x)},${formatCoord(top)} ${formatCoord(x + r)},${formatCoord(top)}`
        + `L${formatCoord(x + barW - r)},${formatCoord(top)}`
        + `Q${formatCoord(x + barW)},${formatCoord(top)} ${formatCoord(x + barW)},${formatCoord(top + r)}`
        + `L${formatCoord(x + barW)},${formatCoord(plotBottom)}Z" fill="${escapeXml(colour)}"/>`);

      if (typeof record.error === 'number' && record.error > 0) {
        const hi = y(Math.min(yMax, value + record.error));
        const lo = y(Math.max(0, value - record.error));
        const cap = Math.max(2, barW / 3);
        parts.push(`<g class="bc-whisker" stroke="${INK_VAR.primary}" stroke-width="1">`
          + `<line x1="${formatCoord(mid)}" y1="${formatCoord(hi)}" x2="${formatCoord(mid)}" y2="${formatCoord(lo)}"/>`
          + `<line x1="${formatCoord(mid - cap)}" y1="${formatCoord(hi)}" x2="${formatCoord(mid + cap)}" y2="${formatCoord(hi)}"/>`
          + `<line x1="${formatCoord(mid - cap)}" y1="${formatCoord(lo)}" x2="${formatCoord(mid + cap)}" y2="${formatCoord(lo)}"/>`
          + '</g>');
      }

      if (labelled.has(key)) {
        parts.push(`<text class="bc-value" x="${formatCoord(mid)}" y="${formatCoord(top - 4)}"`
          + ` text-anchor="middle" font-size="9" fill="${INK_VAR.secondary}">${escapeXml(formatNumber(value))}</text>`);
      }
    });

    const label = String(group);
    const fits = estimateTextWidth(label, 10) <= groupW + groupGap;
    parts.push(`<text x="${formatCoord(gx + groupW / 2)}" y="${formatCoord(plotBottom + 16)}"`
      + ` text-anchor="middle" font-size="10" fill="${INK_VAR.secondary}"`
      + `${fits ? '' : ` transform="rotate(-30 ${formatCoord(gx + groupW / 2)} ${formatCoord(plotBottom + 16)})"`}`
      + `>${escapeXml(label)}</text>`);
  });

  return svgDocument({ width, height, body: parts.join(''), theme, surface });
}
