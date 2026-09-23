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
export const VALUE_MAX = 1e300;

/** The smallest positive magnitude a log axis will accept (R-VAL-4). */
export const VALUE_MIN_LOG = 1e-300;

/** 1e-300 to 1e300 inclusive, which is the most decades an axis can hold. */
export const MAX_DECADES = 601;

const EXP_MAX = 300;
const EXP_MIN = -300;

/** @param {number} e @returns {number} */
function clampExp(e) {
  if (!Number.isFinite(e)) return 0;
  return Math.min(EXP_MAX, Math.max(EXP_MIN, e));
}

/**
 * Is this value plottable on a linear axis? Finite, and inside the window.
 * @param {number} v
 * @returns {boolean}
 */
export function isPlottable(v) {
  return Number.isFinite(v) && Math.abs(v) <= VALUE_MAX;
}

/**
 * Is this value plottable on a LOG axis? Additionally positive and at or above
 * the log floor, because `Math.log10` of anything smaller is not a coordinate.
 * @param {number} v
 * @returns {boolean}
 */
export function isPlottableLog(v) {
  return Number.isFinite(v) && v >= VALUE_MIN_LOG && v <= VALUE_MAX;
}

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
export function enclosingDecades(min, max) {
  if (!(min > 0) || !(max > 0) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return [min, max];
  }
  const loIn = Math.max(min, VALUE_MIN_LOG);
  const hiIn = Math.min(max, VALUE_MAX);
  // The epsilons keep float noise in log10 (log10(0.1) sits a hair below -1)
  // from spawning a phantom out-of-range decade.
  const loExp = clampExp(Math.floor(Math.log10(loIn) + 1e-9));
  const hiExp = clampExp(Math.ceil(Math.log10(hiIn) - 1e-9));
  const lo = 10 ** loExp;
  const hi = 10 ** hiExp;
  if (hi <= lo) return [10 ** clampExp(loExp - 1), 10 ** clampExp(loExp + 1)];
  return [lo, hi];
}

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
export function decadeTicks(min, max) {
  /** @type {number[]} */ const major = [];
  /** @type {number[]} */ const minor = [];
  if (!(min > 0) || !(max > 0) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return { major, minor };
  }
  const dLo = clampExp(Math.floor(Math.log10(Math.max(min, VALUE_MIN_LOG)) + 1e-9));
  const dHi = clampExp(Math.ceil(Math.log10(Math.min(max, VALUE_MAX)) - 1e-9));
  const inRange = (/** @type {number} */ v) => v >= min * (1 - 1e-9) && v <= max * (1 + 1e-9);
  for (let d = dLo; d <= dHi && major.length < MAX_DECADES; d++) {
    const base = 10 ** d;
    if (!Number.isFinite(base)) break;
    if (inRange(base)) major.push(base);
    for (let k = 2; k <= 9; k++) {
      const v = k * base;
      if (Number.isFinite(v) && inRange(v)) minor.push(v);
    }
  }
  return { major, minor };
}

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
export function log10Scale(domainMin, domainMax, rangeMin, rangeMax) {
  if (!isPlottableLog(domainMin) || !isPlottableLog(domainMax)) return () => rangeMin;
  const lo = Math.log10(domainMin);
  const span = Math.log10(domainMax) - lo;
  return (v) => {
    if (span === 0 || !isPlottableLog(v)) return rangeMin;
    return rangeMin + ((Math.log10(v) - lo) / span) * (rangeMax - rangeMin);
  };
}

/**
 * A linear axis. A zero-width domain collapses to `rangeMin`.
 *
 * @param {number} domainMin
 * @param {number} domainMax
 * @param {number} rangeMin
 * @param {number} rangeMax
 * @returns {(v: number) => number}
 */
export function linearScale(domainMin, domainMax, rangeMin, rangeMax) {
  if (!isPlottable(domainMin) || !isPlottable(domainMax)) return () => rangeMin;
  const span = domainMax - domainMin;
  return (v) => {
    if (span === 0 || !isPlottable(v)) return rangeMin;
    return rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
  };
}
