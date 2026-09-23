/**
 * The canvas and its furniture: surface, theme tokens, legend, ticks,
 * placeholder.
 *
 * This module knows nothing about the three families (ADR-006 rule 4). Chrome
 * does not know what it frames.
 *
 * @module
 */

import { escapeXml, formatCoord, formatNumber } from './format.js';
import { INK } from './palette.js';
import { validateDimension, validateLabel, validateOptions } from './validate.js';

/**
 * The current charts name `ui-sans-serif` alone, which Firefox does not
 * understand, so it falls through to a serif.
 */
export const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const LEGEND_ROW_HEIGHT = 18;
export const LEGEND_SWATCH = 10;
export const LEGEND_GAP = 16;
const SWATCH_TEXT_GAP = 4;

const TOKENS = {
  surface: 'bc-surface',
  primary: 'bc-primary',
  secondary: 'bc-secondary',
  muted: 'bc-muted',
  grid: 'bc-grid',
  axis: 'bc-axis',
  deemphasis: 'bc-deemphasis',
};

/** @param {Record<string, string>} mode */
const declare = (mode) =>
  Object.entries(TOKENS).map(([k, name]) => `--${name}:${mode[k]}`).join(';');

/**
 * The theme block.
 *
 * `auto` carries both sets. Inside an SVG loaded through `<img>` the
 * `prefers-color-scheme` query is the only one that can fire, because the
 * document has no host to take a `data-theme` attribute from; the third tier
 * reaches inlined charts only, and is documented as such in ADR-004. A host
 * with its own toggle renders `light` and `dark` files and picks between them.
 *
 * @param {'auto'|'light'|'dark'} theme
 * @returns {string}
 */
export function themeStyle(theme) {
  if (theme === 'light') return `:root{${declare(INK.light)}}`;
  if (theme === 'dark') return `:root{${declare(INK.dark)}}`;
  return [
    `:root{${declare(INK.light)}}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${declare(INK.dark)}}}`,
    `:root[data-theme="dark"]{${declare(INK.dark)}}`,
  ].join('');
}

/**
 * Wrap a body in the root element, with the style block and, unless asked
 * otherwise, an opaque surface.
 *
 * @param {{ width: number, height: number, body: string,
 *           theme?: 'auto'|'light'|'dark', surface?: 'opaque'|'transparent' }} opts
 * @returns {string}
 */
export function svgDocument({ width, height, body, theme = 'auto', surface = 'opaque' }) {
  validateDimension(width, 'width');
  validateDimension(height, 'height');
  const background = surface === 'transparent'
    ? ''
    : `<rect class="bc-surface" x="0" y="0" width="${formatCoord(width)}" height="${formatCoord(height)}" fill="var(--${TOKENS.surface})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatCoord(width)} ${formatCoord(height)}" width="${formatCoord(width)}" height="${formatCoord(height)}" font-family="${escapeXml(FONT_STACK)}">`
    + `<style>${themeStyle(theme)}</style>`
    + background
    + body
    + '</svg>';
}

/**
 * The empty-state tile, for a caller who has DECIDED a chart is legitimately
 * absent. The library cannot tell that from a broken producer, which is why it
 * is exported rather than used as a default.
 *
 * @param {{ width: number, height: number, message: string,
 *           theme?: 'auto'|'light'|'dark', surface?: 'opaque'|'transparent' }} opts
 * @returns {string}
 */
export function renderPlaceholder(opts) {
  validateOptions(/** @type {any} */ (opts ?? {}), {
    width: 'dimension', height: 'dimension', message: 'label',
    theme: ['auto', 'light', 'dark'], surface: ['opaque', 'transparent'],
  });
  const { width, height, message } = opts;
  validateDimension(width, 'width');
  validateDimension(height, 'height');
  validateLabel(message, 'message');
  const body = `<text x="${formatCoord(width / 2)}" y="${formatCoord(height / 2)}" text-anchor="middle"`
    + ` font-size="12" fill="var(--${TOKENS.muted})">${escapeXml(message)}</text>`;
  return svgDocument({ width, height, body, theme: opts.theme, surface: opts.surface });
}

/**
 * Rough advance-width estimate, in the absence of a font.
 *
 * It only has to be good enough to keep a legend inside the plot, and it is
 * deliberately generous: over-estimating wraps a row early, under-estimating
 * runs a swatch off the edge, and only one of those is visible in the output.
 *
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
export function estimateTextWidth(text, fontSize) {
  let units = 0;
  for (const ch of String(text)) {
    if ("iIl|.,:;'!".includes(ch)) units += 0.30;
    else if ('fjrt()[]{}-'.includes(ch)) units += 0.40;
    else if ('WM@%'.includes(ch)) units += 0.95;
    else if (ch >= 'A' && ch <= 'Z') units += 0.68;
    else if (ch === ' ') units += 0.28;
    else units += 0.55;
  }
  return units * fontSize;
}

/**
 * Lay a legend out across as many rows as it needs, measuring each entry rather
 * than assuming a pitch.
 *
 * The constant pitch this replaces put the sixth entry past the right edge.
 *
 * @param {ReadonlyArray<{key: string, label: string, color: string}>} items
 * @param {number} maxWidth
 * @param {number} fontSize
 */
export function layoutLegend(items, maxWidth, fontSize) {
  /** @type {Array<Array<{key: string, label: string, color: string, x: number, width: number}>>} */
  const rows = [];
  let row = [];
  let x = 0;
  for (const item of items) {
    const width = LEGEND_SWATCH + SWATCH_TEXT_GAP + estimateTextWidth(item.label, fontSize);
    if (row.length > 0 && x + width > maxWidth) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({ ...item, x, width });
    x += width + LEGEND_GAP;
  }
  if (row.length > 0) rows.push(row);
  return { rows, height: rows.length * LEGEND_ROW_HEIGHT };
}

/**
 * Render a laid-out legend.
 *
 * @param {ReturnType<typeof layoutLegend>} layout
 * @param {number} originX
 * @param {number} originY
 * @param {number} fontSize
 */
export function legendMarkup(layout, originX, originY, fontSize) {
  /** @type {string[]} */ const parts = [];
  layout.rows.forEach((row, r) => {
    const y = originY + r * LEGEND_ROW_HEIGHT;
    for (const entry of row) {
      const sx = originX + entry.x;
      parts.push(
        `<rect x="${formatCoord(sx)}" y="${formatCoord(y)}" width="${formatCoord(LEGEND_SWATCH)}" height="${formatCoord(LEGEND_SWATCH)}"`
        + ` rx="2" fill="${escapeXml(entry.color)}"/>`
        + `<text x="${formatCoord(sx + LEGEND_SWATCH + SWATCH_TEXT_GAP)}" y="${formatCoord(y + LEGEND_SWATCH - 1)}"`
        + ` font-size="${formatCoord(fontSize)}" fill="var(--${TOKENS.secondary})">${escapeXml(entry.label)}</text>`,
      );
    }
  });
  return parts.join('');
}

/**
 * Ticks for a bar axis: always from zero, four to six of them, on round steps.
 *
 * @param {number} max
 * @param {number} [target]
 * @returns {number[]}
 */
export function niceTicks(max, target = 4) {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  // Pick the step by the count it produces rather than by rounding the ideal
  // step up, which is what collapsed a domain of 1 to three ticks: 0.25 rounds
  // to 0.5 and halves the interval count on the way.
  const exp = Math.floor(Math.log10(max));
  let best = null;
  for (let k = exp - 2; k <= exp + 1; k++) {
    for (const mantissa of [1, 2, 2.5, 5]) {
      const step = mantissa * 10 ** k;
      if (!Number.isFinite(step) || step <= 0) continue;
      const intervals = Math.ceil(max / step);
      if (intervals < 3 || intervals > 5) continue;
      const score = Math.abs(intervals - target);
      if (!best || score < best.score || (score === best.score && step < best.step)) {
        best = { step, intervals, score };
      }
    }
  }
  if (!best) best = { step: max / target, intervals: target, score: 0 };
  const ticks = [];
  for (let i = 0; i <= best.intervals; i++) {
    ticks.push(Number.parseFloat((i * best.step).toPrecision(12)));
  }
  return ticks;
}

/**
 * Snap a domain out to 1-2-5 bounds rather than to the enclosing decade.
 *
 * A sweep holding four lines between 2200 and 4500 on an axis stretched to
 * 1000..10000 reads as a hair's width. Snapping to 2000..5000 keeps the real
 * differences visible.
 *
 * @param {number} min
 * @param {number} max
 * @returns {[number, number]}
 */
export function snap125(min, max) {
  const lo = Number.isFinite(min) && min > 0 ? min : 1;
  const hi = Number.isFinite(max) && max > lo ? max : lo * 10;
  const down = (/** @type {number} */ v) => {
    const mag = 10 ** Math.floor(Math.log10(v));
    const n = v / mag;
    return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
  };
  const up = (/** @type {number} */ v) => {
    const mag = 10 ** Math.floor(Math.log10(v));
    const n = v / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  };
  const l = down(lo);
  const h = up(hi);
  return [Number.isFinite(l) && l > 0 ? l : 1, Number.isFinite(h) && h > l ? h : l * 10];
}

/**
 * Build a `points` attribute value from coordinate pairs.
 *
 * It exists so a family never holds pre-formatted geometry in a bare local: the
 * R-ESC-1 scanner can see that every number in here went through formatCoord,
 * and cannot see that about a variable called `pts`.
 *
 * @param {ReadonlyArray<[number, number]>} pairs
 * @returns {string}
 */
export function pointsAttr(pairs) {
  return pairs.map(([px, py]) => `${formatCoord(px)},${formatCoord(py)}`).join(' ');
}

/** Shared token names, so a family never spells one itself. */
export const INK_VAR = Object.freeze(
  Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, `var(--${v})`])),
);

export { formatNumber };
