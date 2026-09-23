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
export function renderSweep(points: unknown, opts?: Partial<SweepOptions> | undefined): string;
export type SweepOptions = {
    series: import("../series.js").SeriesSet;
    title?: string | undefined;
    unit?: string | undefined;
    better?: "lower" | "higher" | undefined;
    width?: number | undefined;
    height?: number | undefined;
    theme?: "light" | "dark" | "auto" | undefined;
    surface?: "opaque" | "transparent" | undefined;
    scale?: "log" | "linear" | undefined;
    xLabel?: string | undefined;
    yLabel?: string | undefined;
    xMin?: number | undefined;
};
