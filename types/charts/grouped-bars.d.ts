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
export function renderGroupedBars(rows: unknown, opts?: Partial<GroupedBarsOptions> | undefined): string;
export type GroupedBarsOptions = {
    series: import("../series.js").SeriesSet;
    title?: string | undefined;
    unit?: string | undefined;
    better?: "lower" | "higher" | undefined;
    width?: number | undefined;
    height?: number | undefined;
    theme?: "light" | "dark" | "auto" | undefined;
    surface?: "opaque" | "transparent" | undefined;
    errorLabel?: string | undefined;
};
