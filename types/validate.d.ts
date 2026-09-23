/**
 * @param {unknown} s
 * @param {string} field
 * @returns {string}
 */
export function validateLabel(s: unknown, field: string): string;
/**
 * @param {unknown} v
 * @param {string} name
 * @returns {number}
 */
export function validateDimension(v: unknown, name: string): number;
/**
 * Check an options bag against a table of what this renderer accepts.
 *
 * An unknown name throws rather than being ignored. A typo changes the picture
 * silently, and every stale name from the old API (`theme`, `xKey`,
 * `unitSuffix`, `logScale`) would otherwise be accepted and do nothing at all.
 *
 * @param {Record<string, unknown>} opts
 * @param {Record<string, string|readonly string[]>} allowed
 * @returns {Record<string, unknown>}
 */
export function validateOptions(opts: Record<string, unknown>, allowed: Record<string, string | readonly string[]>): Record<string, unknown>;
/**
 * Check every record, build the cell index, and hand back only the closed field
 * set.
 *
 * Every record, not just the first: the shape probes this replaces looked at
 * record 0 alone, so a file where record 57 lost its series field sailed
 * through and drew a well-formed chart missing a line.
 *
 * The index is a nested Map rather than a joined `group|series` string, because
 * a joined key collides: `{group:'a|b', series:'c'}` and `{group:'a',
 * series:'b|c'}` produce the same string and one bar silently overwrites the
 * other (R-LOOK-2).
 *
 * @param {unknown} rows
 * @param {'bar'|'trend'|'sweep'} family
 */
export function validateRecords(rows: unknown, family: "bar" | "trend" | "sweep"): {
    rows: Record<string, unknown>[];
    index: Map<unknown, Map<string, number>>;
    axisValues: unknown[];
    seriesKeys: string[];
    stepLabels: Map<number, string>;
};
/** @param {unknown} rows @returns {Checked<BarRow>} */
export function checkBarRows(rows: unknown): Checked<BarRow>;
/** @param {unknown} points @returns {Checked<TrendPoint>} */
export function checkTrendPoints(points: unknown): Checked<TrendPoint>;
/** @param {unknown} points @returns {Checked<SweepPoint>} */
export function checkSweepPoints(points: unknown): Checked<SweepPoint>;
/** R-VAL-3. A viewBox larger than this is a mistake, not a chart. */
export const DIMENSION_MAX: 16384;
/** R-VAL-1. */
export const LABEL_MAX: 256;
export type BarRow = {
    group: string;
    series: string;
    value: number;
    error?: number;
};
export type TrendPoint = {
    step: number;
    series: string;
    value: number;
    label?: string;
};
export type SweepPoint = {
    x: number;
    series: string;
    value: number;
};
/**
 * What a checked record set looks like: the clean rows, the nested cell index,
 * and the axis and series orders the renderer draws in.
 */
export type Checked<T> = {
    rows: T[];
    index: Map<any, Map<string, number>>;
    axisValues: any[];
    seriesKeys: string[];
    stepLabels: Map<number, string>;
};
