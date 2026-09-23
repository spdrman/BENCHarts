/**
 * Grouped bars: one column group per benchmark config, one bar per series,
 * optional error whiskers.
 *
 * @module
 */

import { ERROR_CODES, fail } from '../error.js';
import { escapeXml, formatCoord, formatNumber } from '../format.js';
import { isSeriesSet } from '../series.js';
import { validateOptions, checkBarRows } from '../validate.js';
import {
  svgDocument, layoutLegend, legendMarkup, signedTicks, estimateTextWidth,
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
/** Below this a bar is not a mark, so a canvas that cannot give it is refused. */
const MIN_BAR_W = 1;

/**
 * @typedef {object} GroupedBarsOptions
 * @property {import('../series.js').SeriesSet} series
 * @property {string} [title]
 * @property {string} [unit]
 * @property {'lower'|'higher'} [better]
 * @property {number} [width]
 * @property {number} [height]
 * @property {'auto'|'light'|'dark'} [theme]
 * @property {'opaque'|'transparent'} [surface]
 * @property {string} [errorLabel]
 */

/**
 * @param {unknown} rows
 * @param {Partial<GroupedBarsOptions>} [opts]
 * @returns {string}
 */
export function renderGroupedBars(rows, opts = {}) {
  validateOptions(/** @type {any} */ (opts), ALLOWED);
  const o = /** @type {GroupedBarsOptions} */ (opts);
  const { series, title, unit, better, errorLabel, theme, surface } = o;
  if (!isSeriesSet(series)) {
    fail(ERROR_CODES.INVALID_OPTION,
      'series must be the SeriesSet defineSeries returned, checked by brand rather than by shape',
      { option: 'series' });
  }

  const data = checkBarRows(rows);
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
  const reach = data.rows.flatMap((r) => (Number.isFinite(r.value)
    ? (typeof r.error === 'number' ? [r.value - r.error, r.value + r.error] : [r.value])
    : []));
  const ticks = signedTicks(Math.min(...reach), Math.max(...reach));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];

  // Content-sized unless the caller fixes it, and squeezed to fit when they do.
  const naturalGroup = present.length * BAR_W + Math.max(0, present.length - 1) * BAR_GAP;
  const naturalContent = groups.length * naturalGroup + Math.max(0, groups.length - 1) * GROUP_GAP;
  // Floor the plot region, not the whole canvas: a floor on the total masks
  // content sizing entirely until the content outgrows it, which is most small
  // charts.
  const width = o.width ?? PAD_L + Math.max(160, naturalContent) + PAD_R;
  const available = width - PAD_L - PAD_R;
  const squeeze = naturalContent > available ? available / naturalContent : 1;
  const barW = Math.max(MIN_BAR_W, BAR_W * squeeze);
  const barGap = BAR_GAP * squeeze;
  const groupGap = GROUP_GAP * squeeze;
  const groupW = present.length * barW + Math.max(0, present.length - 1) * barGap;
  // The squeeze has a floor, so past a point it stops squeezing and the bars
  // run off the right edge instead. That is a chart that looks finished and is
  // not, which is the one outcome D2 exists to rule out.
  const laidOut = groups.length * groupW + Math.max(0, groups.length - 1) * groupGap;
  if (laidOut > available + 1e-9) {
    // The width at which the natural squeeze lands exactly on the floor. Left
    // as groups x series x MIN_BAR_W it ignores the gaps, and then a caller who
    // passes the number they were given is refused again.
    const needed = Math.ceil(PAD_L + PAD_R + naturalContent * (MIN_BAR_W / BAR_W));
    fail(ERROR_CODES.INVALID_OPTION,
      `width ${width} cannot hold ${groups.length} groups of ${present.length} series at a legible bar width; `
      + `it needs at least ${needed}, or leave width off and let the canvas size itself`,
      { option: 'width', given: width, needed, groups: groups.length, series: present.length });
  }

  const subtitleParts = [];
  if (unit) subtitleParts.push(unit);
  if (better) subtitleParts.push(`${better} is better`);
  if (drewWhiskers && errorLabel) subtitleParts.push(errorLabel);
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
  const plotH = Math.max(1, plotBottom - plotTop);
  const span = yMax - yMin || 1;
  const y = (/** @type {number} */ v) => plotBottom - ((v - yMin) / span) * plotH;
  const baseline = y(0);

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
      .map((/** @type {string} */ key) => {
        const at = bySeries?.get(key);
        return { key, row: at === undefined ? undefined : data.rows[at] };
      })
      .filter((c) => c.row !== undefined && Number.isFinite(c.row.value));
    let labelled = new Set(present);
    if (totalCells > LABEL_ALL_UP_TO && finite.length > 0) {
      const sorted = [...finite].sort((a, b) => Number(a.row?.value) - Number(b.row?.value));
      labelled = new Set([sorted[0].key, sorted[sorted.length - 1].key]);
    }

    present.forEach((/** @type {string} */ key, /** @type {number} */ si) => {
      const x = gx + si * (barW + barGap);
      const mid = x + barW / 2;
      const hit = bySeries?.get(key);
      const record = hit === undefined ? undefined : data.rows[hit];
      const colour = resolved.colorOf(key);

      if (record === undefined || !Number.isFinite(record.value)) {
        // Absent and unmeasurable both keep the slot and say so. "Not
        // benchmarked" must never read as "0".
        parts.push(`<text class="bc-absent" x="${formatCoord(mid)}" y="${formatCoord(baseline - 4)}"`
          + ` text-anchor="middle" font-size="9" fill="${INK_VAR.muted}">n/a</text>`);
        return;
      }

      const value = record.value;
      const down = value < 0;
      // A measured zero is a 2px stub rather than nothing, so it cannot be
      // mistaken for the absent cell three lines above.
      const end = value === 0 ? baseline - 2 : y(value);
      const h = Math.abs(baseline - end);
      const r = Math.min(4, barW / 2, Math.max(0, h));
      // Rounded at the data end and square at the baseline, whichever way the
      // bar grows, so it reads as coming from the axis rather than floating.
      const sign = down ? -1 : 1;
      parts.push(`<path class="bc-bar" d="M${formatCoord(x)},${formatCoord(baseline)}`
        + `L${formatCoord(x)},${formatCoord(end + r * sign)}`
        + `Q${formatCoord(x)},${formatCoord(end)} ${formatCoord(x + r)},${formatCoord(end)}`
        + `L${formatCoord(x + barW - r)},${formatCoord(end)}`
        + `Q${formatCoord(x + barW)},${formatCoord(end)} ${formatCoord(x + barW)},${formatCoord(end + r * sign)}`
        + `L${formatCoord(x + barW)},${formatCoord(baseline)}Z" fill="${escapeXml(colour)}"/>`);

      if (typeof record.error === 'number' && record.error > 0) {
        const hi = y(Math.min(yMax, value + record.error));
        const lo = y(Math.max(yMin, value - record.error));
        const cap = Math.max(2, barW / 3);
        parts.push(`<g class="bc-whisker" stroke="${INK_VAR.primary}" stroke-width="1">`
          + `<line x1="${formatCoord(mid)}" y1="${formatCoord(hi)}" x2="${formatCoord(mid)}" y2="${formatCoord(lo)}"/>`
          + `<line x1="${formatCoord(mid - cap)}" y1="${formatCoord(hi)}" x2="${formatCoord(mid + cap)}" y2="${formatCoord(hi)}"/>`
          + `<line x1="${formatCoord(mid - cap)}" y1="${formatCoord(lo)}" x2="${formatCoord(mid + cap)}" y2="${formatCoord(lo)}"/>`
          + '</g>');
      }

      if (labelled.has(key)) {
        parts.push(`<text class="bc-value" x="${formatCoord(mid)}" y="${formatCoord(down ? end + 11 : end - 4)}"`
          + ` text-anchor="middle" font-size="9" fill="${INK_VAR.secondary}">${escapeXml(formatNumber(value))}</text>`);
      }
    });

    const label = String(group);
    const fits = estimateTextWidth(label, 10) <= groupW + groupGap;
    // Two flat templates rather than one with a nested template inside it, so
    // the R-ESC-1 scanner can read every interpolation here without recursing.
    const head = `<text x="${formatCoord(gx + groupW / 2)}" y="${formatCoord(plotBottom + 16)}"`
      + ` text-anchor="middle" font-size="10" fill="${INK_VAR.secondary}"`;
    const rotate = ` transform="rotate(-30 ${formatCoord(gx + groupW / 2)} ${formatCoord(plotBottom + 16)})"`;
    parts.push(`${head}${fits ? '' : rotate}>${escapeXml(label)}</text>`);
  });

  return svgDocument({ width, height, body: parts.join(''), theme, surface });
}
