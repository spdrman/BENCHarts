/**
 * @typedef {object} TrendOptions
 * @property {import('../series.js').SeriesSet} series
 * @property {string} [title]
 * @property {string} [unit]
 * @property {'lower'|'higher'} [better]
 * @property {number} [width]
 * @property {number} [height]
 * @property {'auto'|'light'|'dark'} [theme]
 * @property {'opaque'|'transparent'} [surface]
 */
/**
 * @param {unknown} points
 * @param {Partial<TrendOptions>} [opts]
 * @returns {string}
 */
export function renderTrend(points: unknown, opts?: Partial<TrendOptions> | undefined): string;
export type TrendOptions = {
    series: import("../series.js").SeriesSet;
    title?: string | undefined;
    unit?: string | undefined;
    better?: "lower" | "higher" | undefined;
    width?: number | undefined;
    height?: number | undefined;
    theme?: "light" | "dark" | "auto" | undefined;
    surface?: "opaque" | "transparent" | undefined;
};
