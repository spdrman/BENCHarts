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
export function themeStyle(theme: "auto" | "light" | "dark"): string;
/**
 * Wrap a body in the root element, with the style block and, unless asked
 * otherwise, an opaque surface.
 *
 * @param {{ width: number, height: number, body: string,
 *           theme?: 'auto'|'light'|'dark', surface?: 'opaque'|'transparent' }} opts
 * @returns {string}
 */
export function svgDocument({ width, height, body, theme, surface }: {
    width: number;
    height: number;
    body: string;
    theme?: "auto" | "light" | "dark";
    surface?: "opaque" | "transparent";
}): string;
/**
 * The empty-state tile, for a caller who has DECIDED a chart is legitimately
 * absent. The library cannot tell that from a broken producer, which is why it
 * is exported rather than used as a default.
 *
 * @param {{ width: number, height: number, message: string,
 *           theme?: 'auto'|'light'|'dark', surface?: 'opaque'|'transparent' }} opts
 * @returns {string}
 */
export function renderPlaceholder(opts: {
    width: number;
    height: number;
    message: string;
    theme?: "auto" | "light" | "dark";
    surface?: "opaque" | "transparent";
}): string;
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
export function estimateTextWidth(text: string, fontSize: number): number;
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
export function layoutLegend(items: ReadonlyArray<{
    key: string;
    label: string;
    color: string;
}>, maxWidth: number, fontSize: number): {
    rows: {
        key: string;
        label: string;
        color: string;
        x: number;
        width: number;
    }[][];
    height: number;
};
/**
 * Render a laid-out legend.
 *
 * @param {ReturnType<typeof layoutLegend>} layout
 * @param {number} originX
 * @param {number} originY
 * @param {number} fontSize
 */
export function legendMarkup(layout: ReturnType<typeof layoutLegend>, originX: number, originY: number, fontSize: number): string;
/**
 * Ticks for a bar axis: always from zero, four to six of them, on round steps.
 *
 * @param {number} max
 * @param {number} [target]
 * @returns {number[]}
 */
export function niceTicks(max: number, target?: number | undefined): number[];
/**
 * Ticks for an axis that has to hold both signs, anchored on zero.
 *
 * A bar axis is always anchored at zero, which is not the same as saying the
 * data cannot go below it. A linear axis represents a negative perfectly well,
 * unlike a log axis, so refusing one here would be an invented limitation.
 *
 * @param {number} lo
 * @param {number} hi
 * @returns {number[]}
 */
export function signedTicks(lo: number, hi: number): number[];
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
export function snap125(min: number, max: number): [number, number];
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
export function pointsAttr(pairs: ReadonlyArray<[number, number]>): string;
/**
 * The current charts name `ui-sans-serif` alone, which Firefox does not
 * understand, so it falls through to a serif.
 */
export const FONT_STACK: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const LEGEND_ROW_HEIGHT: 18;
export const LEGEND_SWATCH: 10;
export const LEGEND_GAP: 16;
/** Shared token names, so a family never spells one itself. */
export const INK_VAR: Readonly<{
    [k: string]: string;
}>;
export { formatNumber };
import { formatNumber } from './format.js';
