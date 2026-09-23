/**
 * Table-driven checking for options and records.
 *
 * The rule the README states: BENCHarts throws on anything that is a
 * programming or pipeline error, and degrades only on the three things that are
 * legitimate data semantics the caller chose. This module is the first half.
 *
 * @module
 */

import { ERROR_CODES, fail } from './error.js';
import { VALUE_MAX, isPlottable } from './scale.js';

/** R-VAL-3. A viewBox larger than this is a mistake, not a chart. */
export const DIMENSION_MAX = 16384;

/** R-VAL-1. */
export const LABEL_MAX = 256;

/**
 * Characters a drawn string may not contain.
 *
 * C0 and C1 controls, because XML 1.0 forbids them and emitting one makes the
 * whole document invalid so the chart vanishes rather than degrading. Bidi
 * overrides and zero-width characters, because they change what a reader sees
 * without changing what a reviewer reads. The two noncharacters.
 *
 * They are refused rather than stripped (R-ESC-3): silently rewriting a label
 * means the chart says something the caller did not.
 */
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁯﷐-﷯﻿￾￿]/;

/**
 * @param {unknown} s
 * @param {string} field
 * @returns {string}
 */
export function validateLabel(s, field) {
  if (typeof s !== 'string') {
    fail(ERROR_CODES.INVALID_OPTION,
      `${field} must be a string, and is not coerced`, { field, got: typeof s });
  }
  const points = [...s];
  if (points.length < 1 || points.length > LABEL_MAX) {
    fail(ERROR_CODES.INVALID_OPTION,
      `${field} must be 1 to ${LABEL_MAX} characters, got ${points.length}`,
      { field, length: points.length, cap: LABEL_MAX });
  }
  if (FORBIDDEN.test(s)) {
    fail(ERROR_CODES.INVALID_OPTION,
      `${field} carries a control, bidi or zero-width character, which is refused rather than stripped`,
      { field });
  }
  for (const point of points) {
    const cp = /** @type {number} */ (point.codePointAt(0));
    // A well-formed pair reads as one code point here, so this catches only
    // lone surrogates, which UTF-8 encoding would otherwise quietly replace.
    if (cp >= 0xd800 && cp <= 0xdfff) {
      fail(ERROR_CODES.INVALID_OPTION, `${field} carries a lone surrogate`, { field });
    }
  }
  return s;
}

/**
 * @param {unknown} v
 * @param {string} name
 * @returns {number}
 */
export function validateDimension(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > DIMENSION_MAX) {
    fail(ERROR_CODES.INVALID_OPTION,
      `${name} must be a finite number in (0, ${DIMENSION_MAX}], got ${typeof v === 'number' ? v : typeof v}`,
      { field: name, cap: DIMENSION_MAX });
  }
  return v;
}

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
export function validateOptions(opts, allowed) {
  if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
    fail(ERROR_CODES.INVALID_OPTION, 'options must be an object', { got: typeof opts });
  }
  const names = Object.keys(allowed).sort();
  for (const [name, value] of Object.entries(opts)) {
    if (!(name in allowed)) {
      fail(ERROR_CODES.UNKNOWN_OPTION,
        `unknown option ${name}; this renderer takes ${names.join(', ')}`,
        { option: name, allowed: names });
    }
    if (value === undefined) continue;
    const spec = allowed[name];
    if (Array.isArray(spec)) {
      if (!spec.includes(/** @type {string} */ (value))) {
        fail(ERROR_CODES.INVALID_OPTION,
          `${name} must be one of ${spec.join(', ')}`, { option: name, allowed: spec });
      }
    } else if (spec === 'dimension') {
      validateDimension(value, name);
    } else if (spec === 'label') {
      validateLabel(value, name);
    } else if (spec === 'number') {
      if (typeof value !== 'number' || !isPlottable(value)) {
        fail(ERROR_CODES.INVALID_OPTION,
          `${name} must be a finite number no larger than ${VALUE_MAX}`, { option: name });
      }
    } else if (spec === 'boolean') {
      if (typeof value !== 'boolean') {
        fail(ERROR_CODES.INVALID_OPTION, `${name} must be a boolean`, { option: name });
      }
    } else if (typeof value !== spec) {
      fail(ERROR_CODES.INVALID_OPTION, `${name} must be a ${spec}`, { option: name, got: typeof value });
    }
  }
  return opts;
}

/**
 * @typedef {{ group: string, series: string, value: number, error?: number }} BarRow
 * @typedef {{ step: number, series: string, value: number, label?: string }} TrendPoint
 * @typedef {{ x: number, series: string, value: number }} SweepPoint
 */

/**
 * What a checked record set looks like: the clean rows, the nested cell index,
 * and the axis and series orders the renderer draws in.
 *
 * @template T
 * @typedef {{
 *   rows: T[],
 *   index: Map<any, Map<string, number>>,
 *   axisValues: any[],
 *   seriesKeys: string[],
 *   stepLabels: Map<number, string>,
 * }} Checked
 */

/** One fixed record shape per family (D1). No accessors, no field pointers. */
const FAMILIES = {
  bar: { axis: 'group', axisKind: 'string', extra: 'error' },
  trend: { axis: 'step', axisKind: 'number', extra: 'label' },
  sweep: { axis: 'x', axisKind: 'number', extra: null },
};

const own = (/** @type {object} */ o, /** @type {string} */ k) =>
  Object.prototype.hasOwnProperty.call(o, k);

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
export function validateRecords(rows, family) {
  const shape = FAMILIES[family];
  if (!Array.isArray(rows)) {
    fail(ERROR_CODES.INVALID_INPUT, `records must be an array, got ${typeof rows}`, { got: typeof rows });
  }
  if (rows.length === 0) {
    fail(ERROR_CODES.EMPTY_INPUT,
      'no records. An empty chart is a pipeline failure, and drawing a blank one buries it; ' +
      'call renderPlaceholder if you have decided the chart is legitimately absent.', {});
  }

  /** @type {Map<unknown, Map<string, number>>} */ const index = new Map();
  /** @type {unknown[]} */ const axisValues = [];
  /** @type {string[]} */ const seriesKeys = [];
  /** @type {Map<number, string>} */ const stepLabels = new Map();
  /** @type {Array<Record<string, unknown>>} */ const out = [];

  rows.forEach((row, i) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      fail(ERROR_CODES.INVALID_RECORD, `record ${i} must be an object`, { index: i, got: typeof row });
    }
    const where = { index: i };

    if (!own(row, shape.axis)) {
      fail(ERROR_CODES.INVALID_RECORD, `record ${i} has no ${shape.axis}`, { ...where, field: shape.axis });
    }
    const axis = row[shape.axis];
    if (shape.axisKind === 'string') {
      if (typeof axis !== 'string') {
        fail(ERROR_CODES.INVALID_RECORD,
          `record ${i} has a non-string ${shape.axis}`, { ...where, field: shape.axis, got: typeof axis });
      }
      try {
        validateLabel(axis, shape.axis);
      } catch (e) {
        fail(ERROR_CODES.INVALID_RECORD, `record ${i}: ${/** @type {Error} */ (e).message}`,
          { ...where, field: shape.axis });
      }
    } else if (typeof axis !== 'number' || !isPlottable(axis)) {
      fail(ERROR_CODES.INVALID_RECORD,
        `record ${i} needs a finite ${shape.axis} no larger than ${VALUE_MAX}`,
        { ...where, field: shape.axis, cap: VALUE_MAX });
    }

    if (!own(row, 'series') || typeof row.series !== 'string') {
      fail(ERROR_CODES.INVALID_RECORD,
        `record ${i} has no string series`, { ...where, field: 'series' });
    }
    try {
      validateLabel(row.series, 'series');
    } catch (e) {
      fail(ERROR_CODES.INVALID_RECORD, `record ${i}: ${/** @type {Error} */ (e).message}`,
        { ...where, field: 'series' });
    }

    if (!own(row, 'value') || typeof row.value !== 'number') {
      fail(ERROR_CODES.INVALID_RECORD, `record ${i} has no numeric value`, { ...where, field: 'value' });
    }
    // A non-finite value is NOT an error: it is how a caller says they measured
    // and have nothing to show. A finite value past the window is an error,
    // because nothing legitimately measures 1e308 milliseconds and a 301-decade
    // axis is what comes of pretending otherwise.
    if (Number.isFinite(row.value) && !isPlottable(row.value)) {
      fail(ERROR_CODES.INVALID_RECORD,
        `record ${i} has a value outside the plottable window of +/-${VALUE_MAX}`,
        { ...where, field: 'value', cap: VALUE_MAX });
    }

    /** @type {Record<string, unknown>} */
    const clean = { [shape.axis]: axis, series: row.series, value: row.value };

    if (shape.extra === 'error' && own(row, 'error') && row.error !== undefined) {
      if (typeof row.error !== 'number' || !isPlottable(row.error) || row.error < 0) {
        fail(ERROR_CODES.INVALID_RECORD,
          `record ${i} has a non-finite or negative error`, { ...where, field: 'error' });
      }
      clean.error = row.error;
    }
    if (shape.extra === 'label' && own(row, 'label') && row.label !== undefined) {
      try {
        validateLabel(row.label, 'label');
      } catch (e) {
        fail(ERROR_CODES.INVALID_RECORD, `record ${i}: ${/** @type {Error} */ (e).message}`,
          { ...where, field: 'label' });
      }
      const seen = stepLabels.get(/** @type {number} */ (axis));
      if (seen !== undefined && seen !== row.label) {
        fail(ERROR_CODES.INCONSISTENT_STEP_LABEL,
          `step ${axis} is labelled both ${seen} and ${row.label}`,
          { ...where, step: axis, labels: [seen, row.label] });
      }
      stepLabels.set(/** @type {number} */ (axis), /** @type {string} */ (row.label));
      clean.label = row.label;
    }

    let bySeries = index.get(axis);
    if (bySeries === undefined) {
      bySeries = new Map();
      index.set(axis, bySeries);
      axisValues.push(axis);
    }
    if (bySeries.has(row.series)) {
      fail(ERROR_CODES.DUPLICATE_RECORD,
        `records ${bySeries.get(row.series)} and ${i} both claim ${shape.axis} ${String(axis)} for series ${row.series}`,
        { ...where, first: bySeries.get(row.series), [shape.axis]: axis, series: row.series });
    }
    bySeries.set(row.series, i);
    if (!seriesKeys.includes(row.series)) seriesKeys.push(row.series);
    out.push(clean);
  });

  return { rows: out, index, axisValues, seriesKeys, stepLabels };
}

/* The three typed entry points. `validateRecords` is table-driven and cannot
 * express "the shape depends on the family argument" in JSDoc, so the cast
 * happens once per family here rather than at every use site. */

/** @param {unknown} rows @returns {Checked<BarRow>} */
export function checkBarRows(rows) {
  return /** @type {any} */ (validateRecords(rows, 'bar'));
}

/** @param {unknown} points @returns {Checked<TrendPoint>} */
export function checkTrendPoints(points) {
  return /** @type {any} */ (validateRecords(points, 'trend'));
}

/** @param {unknown} points @returns {Checked<SweepPoint>} */
export function checkSweepPoints(points) {
  return /** @type {any} */ (validateRecords(points, 'sweep'));
}
