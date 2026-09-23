/**
 * Is this value plottable on a linear axis? Finite, and inside the window.
 * @param {number} v
 * @returns {boolean}
 */
export function isPlottable(v: number): boolean;
/**
 * Is this value plottable on a LOG axis? Additionally positive and at or above
 * the log floor, because `Math.log10` of anything smaller is not a coordinate.
 * @param {number} v
 * @returns {boolean}
 */
export function isPlottableLog(v: number): boolean;
/**
 * Snap a positive domain out to the enclosing powers of ten, so the data
 * endpoints land on labelled decade ticks rather than a bare sub-decade axis.
 *
 * `[0.18, 11.8]` becomes `[0.1, 100]`. A single-value domain expands one decade
 * either side. A non-positive domain is handed back untouched, because a log
 * axis cannot hold it and the caller has to decide what that means.
 *
 * The exponent is clamped before `10 **` ever runs, which is what makes this
 * total: the input can be `Number.MAX_VALUE` and the output is still finite.
 *
 * @param {number} min
 * @param {number} max
 * @returns {[number, number]}
 */
export function enclosingDecades(min: number, max: number): [number, number];
/**
 * Log-spaced ticks over a positive domain: `major` at each power of ten in
 * range, `minor` at the 2 to 9 multiples of each decade.
 *
 * A non-finite or non-positive bound yields an empty tick set. That case used
 * to be a loop with a non-terminating upper bound, which is the failure
 * R-VAL-5 names.
 *
 * @param {number} min
 * @param {number} max
 * @returns {{ major: number[], minor: number[] }}
 */
export function decadeTicks(min: number, max: number): {
    major: number[];
    minor: number[];
};
/**
 * A log10 axis mapping a positive domain onto a pixel range, so every decade
 * occupies an equal span. Returns `(value) => pixel`.
 *
 * A domain it cannot map collapses to `rangeMin` rather than leaking `NaN` into
 * a coordinate attribute.
 *
 * @param {number} domainMin
 * @param {number} domainMax
 * @param {number} rangeMin
 * @param {number} rangeMax
 * @returns {(v: number) => number}
 */
export function log10Scale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): (v: number) => number;
/**
 * A linear axis. A zero-width domain collapses to `rangeMin`.
 *
 * @param {number} domainMin
 * @param {number} domainMax
 * @param {number} rangeMin
 * @param {number} rangeMax
 * @returns {(v: number) => number}
 */
export function linearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): (v: number) => number;
/**
 * Axis primitives, and the numeric window that keeps them total.
 *
 * Internal for 1.0 (D8): nothing here is re-exported from `index.js`. A
 * `/primitives` subpath can be added later without breaking anyone, and
 * removing one could not.
 *
 * @module
 */
/**
 * The largest magnitude a value may carry and still be plotted (R-VAL-4).
 *
 * This is a value check, not a finiteness check, and that distinction is the
 * whole point. `JSON.parse('1.5e308')` is finite, so `Number.isFinite` waves it
 * through, and `10 ** 309` then overflows to `Infinity` and the render dies on
 * heap exhaustion. The near misses below the overflow are worse, because they
 * succeed: a finite 1e300 draws a 301-decade, 263 KB axis in under a
 * millisecond, so no timing budget would ever catch it.
 */
export const VALUE_MAX: 1e+300;
/** The smallest positive magnitude a log axis will accept (R-VAL-4). */
export const VALUE_MIN_LOG: 1e-300;
/** 1e-300 to 1e300 inclusive, which is the most decades an axis can hold. */
export const MAX_DECADES: 601;
