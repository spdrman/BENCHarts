/**
 * @typedef {{ key: string, label?: string, color?: string }} SeriesDef
 * @typedef {{ key: string, label: string, color: string }} ResolvedDef
 *
 * @typedef {object} ResolvedSeries
 * @property {readonly string[]} keys declared order, then sorted undeclared
 * @property {readonly string[]} present what the renderer actually draws
 * @property {(key: string) => boolean} isDeclared
 * @property {(key: string) => string} colorOf throws UNKNOWN_SERIES, never falls back
 * @property {(key: string) => string} labelOf
 *
 * @typedef {object} SeriesSet
 * @property {ReadonlyArray<Readonly<ResolvedDef>>} entries
 * @property {readonly string[]} keys
 * @property {(key: string) => boolean} has
 * @property {(key: string) => string} colorOf
 * @property {(key: string) => string} labelOf
 * @property {(present: Iterable<string>) => ResolvedSeries} resolve
 */
/**
 * Is this a SeriesSet this library produced? A brand check, not duck typing: a
 * renderer that accepted anything shaped right would accept an object whose
 * `colorOf` returns whatever it likes straight into a `fill=`.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function isSeriesSet(v: unknown): boolean;
/**
 * Declare the series a chart knows about.
 *
 * Everything is checked here rather than at render time, because a colour that
 * reaches a `fill=` unvalidated is script execution, not a typo.
 *
 * @param {readonly SeriesDef[]} defs
 * @param {{ fallbackColors?: readonly string[] }} [opts]
 * @returns {SeriesSet}
 */
export function defineSeries(defs: readonly SeriesDef[], opts?: {
    fallbackColors?: readonly string[];
} | undefined): SeriesSet;
export type SeriesDef = {
    key: string;
    label?: string;
    color?: string;
};
export type ResolvedDef = {
    key: string;
    label: string;
    color: string;
};
export type ResolvedSeries = {
    /**
     * declared order, then sorted undeclared
     */
    keys: readonly string[];
    /**
     * what the renderer actually draws
     */
    present: readonly string[];
    isDeclared: (key: string) => boolean;
    /**
     * throws UNKNOWN_SERIES, never falls back
     */
    colorOf: (key: string) => string;
    labelOf: (key: string) => string;
};
export type SeriesSet = {
    entries: ReadonlyArray<Readonly<ResolvedDef>>;
    keys: readonly string[];
    has: (key: string) => boolean;
    colorOf: (key: string) => string;
    labelOf: (key: string) => string;
    resolve: (present: Iterable<string>) => ResolvedSeries;
};
