/**
 * Series identity, resolved in two phases.
 *
 * The old API was `colorFor(key, ordered)`: it handed a computed value out and
 * asked for it back, so passing a stale, foreign or simply wrong array returned
 * a different colour and said nothing. The test suite it shipped with misused
 * that parameter twice and passed anyway. A parameter a test suite can misuse
 * and get away with should not exist, so here the ordering is captured once by
 * `resolve()` and `colorOf` takes a key and nothing else.
 *
 * @module
 */

import { ERROR_CODES, fail } from './error.js';
import { CATEGORICAL, DEFAULT_FALLBACK_COLORS } from './palette.js';

/** Module-private brand. A look-alike object cannot carry it. */
const BRAND = Symbol('bencharts.SeriesSet');

/** R-VAL-2. Six hex digits, optionally eight for alpha. Nothing else. */
const COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const ALLOWED_OPTIONS = new Set(['fallbackColors']);

/**
 * @typedef {{ key: string, label?: string, color?: string }} SeriesDef
 * @typedef {{ key: string, label: string, color: string }} ResolvedDef
 */

/**
 * Is this a SeriesSet this library produced? A brand check, not duck typing: a
 * renderer that accepted anything shaped right would accept an object whose
 * `colorOf` returns whatever it likes straight into a `fill=`.
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function isSeriesSet(v) {
  return typeof v === 'object' && v !== null && /** @type {any} */ (v)[BRAND] === true;
}

/** Truncated so a hostile value cannot pad an error message out. */
const show = (/** @type {unknown} */ v) => {
  const s = typeof v === 'string' ? v : Object.prototype.toString.call(v);
  return s.length > 40 ? `${s.slice(0, 40)}...` : s;
};

/**
 * @param {unknown} c
 * @param {Record<string, unknown>} where
 * @returns {string}
 */
function checkColor(c, where) {
  if (typeof c !== 'string' || !COLOR.test(c)) {
    fail(ERROR_CODES.INVALID_COLOR,
      `colour must be #rrggbb or #rrggbbaa, got ${show(c)}`, where);
  }
  return c;
}

/**
 * Declare the series a chart knows about.
 *
 * Everything is checked here rather than at render time, because a colour that
 * reaches a `fill=` unvalidated is script execution, not a typo.
 *
 * @param {readonly SeriesDef[]} defs
 * @param {{ fallbackColors?: readonly string[] }} [opts]
 * @returns {import('./series.js').SeriesSet}
 */
export function defineSeries(defs, opts = {}) {
  if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
    fail(ERROR_CODES.INVALID_OPTION, 'options must be an object', { got: show(opts) });
  }
  for (const name of Object.keys(opts)) {
    if (!ALLOWED_OPTIONS.has(name)) {
      fail(ERROR_CODES.UNKNOWN_OPTION,
        `unknown option ${show(name)}; defineSeries takes ${[...ALLOWED_OPTIONS].join(', ')}`,
        { option: name });
    }
  }
  if (!Array.isArray(defs)) {
    fail(ERROR_CODES.INVALID_SERIES_DEFINITION, 'defs must be an array', { got: show(defs) });
  }

  const fallbacks = opts.fallbackColors ?? DEFAULT_FALLBACK_COLORS;
  if (!Array.isArray(fallbacks)) {
    fail(ERROR_CODES.INVALID_SERIES_DEFINITION, 'fallbackColors must be an array', { got: show(fallbacks) });
  }
  const seenFallback = new Set();
  fallbacks.forEach((c, index) => {
    checkColor(c, { index, field: 'fallbackColors' });
    const norm = c.toLowerCase();
    if (seenFallback.has(norm)) {
      fail(ERROR_CODES.DUPLICATE_SERIES_COLOR,
        `fallbackColors repeats ${c}`, { index, field: 'fallbackColors', color: c });
    }
    seenFallback.add(norm);
  });

  /** @type {ResolvedDef[]} */ const entries = [];
  const byKey = new Map();
  const usedColors = new Set();
  /** @type {number[]} */ const needsColor = [];

  defs.forEach((def, index) => {
    if (typeof def !== 'object' || def === null || Array.isArray(def)) {
      fail(ERROR_CODES.INVALID_SERIES_DEFINITION,
        `entry ${index} must be an object`, { index, got: show(def) });
    }
    const key = /** @type {any} */ (def).key;
    if (typeof key !== 'string' || key.length === 0) {
      fail(ERROR_CODES.INVALID_SERIES_DEFINITION,
        `entry ${index} needs a non-empty string key`, { index, field: 'key', got: show(key) });
    }
    if (byKey.has(key)) {
      fail(ERROR_CODES.DUPLICATE_SERIES_KEY,
        `two entries claim the key ${show(key)}`, { index, field: 'key', key });
    }
    const label = /** @type {any} */ (def).label;
    if (label !== undefined && typeof label !== 'string') {
      fail(ERROR_CODES.INVALID_SERIES_DEFINITION,
        `entry ${index} has a non-string label`, { index, field: 'label', got: show(label) });
    }
    const color = /** @type {any} */ (def).color;
    if (color !== undefined) {
      checkColor(color, { index, field: 'color' });
      const norm = color.toLowerCase();
      if (usedColors.has(norm)) {
        fail(ERROR_CODES.DUPLICATE_SERIES_COLOR,
          `two series claim the colour ${color}`, { index, field: 'color', color });
      }
      usedColors.add(norm);
    } else {
      needsColor.push(index);
    }
    const entry = { key, label: label ?? key, color: /** @type {string} */ (color) };
    entries.push(entry);
    byKey.set(key, entry);
  });

  // Auto-assign only after every explicit colour is known, so an assignment can
  // never land on one the caller already chose further down the list.
  let slot = 0;
  for (const index of needsColor) {
    while (slot < CATEGORICAL.length && usedColors.has(CATEGORICAL[slot].toLowerCase())) slot++;
    if (slot >= CATEGORICAL.length) {
      fail(ERROR_CODES.FALLBACK_PALETTE_EXHAUSTED,
        `${defs.length} declared series need a colour and the palette holds ${CATEGORICAL.length}`,
        { index, needed: defs.length, available: CATEGORICAL.length });
    }
    entries[index].color = CATEGORICAL[slot];
    usedColors.add(CATEGORICAL[slot].toLowerCase());
    slot++;
  }

  const frozenEntries = Object.freeze(entries.map((e) => Object.freeze(e)));
  const keys = Object.freeze(frozenEntries.map((e) => e.key));
  const declaredColors = new Set(frozenEntries.map((e) => e.color.toLowerCase()));

  const set = {
    [BRAND]: true,
    entries: frozenEntries,
    keys,
    has: (/** @type {string} */ key) => byKey.has(key),
    colorOf: (/** @type {string} */ key) => lookup(byKey, key).color,
    labelOf: (/** @type {string} */ key) => lookup(byKey, key).label,
    resolve: (/** @type {Iterable<string>} */ present) =>
      resolveAgainst(byKey, keys, declaredColors, fallbacks, present),
  };
  return Object.freeze(set);
}

/** @param {Map<string, ResolvedDef>} byKey @param {string} key */
function lookup(byKey, key) {
  const hit = byKey.get(key);
  if (hit === undefined) {
    // A silent fallback here is the same "different colour, no error" outcome
    // the two-phase design exists to remove, wearing a different hat.
    fail(ERROR_CODES.UNKNOWN_SERIES, `no series named ${show(key)}`, { key });
  }
  return hit;
}

function resolveAgainst(byKey, declaredKeys, declaredColors, fallbacks, present) {
  if (present === null || present === undefined || typeof present[Symbol.iterator] !== 'function') {
    fail(ERROR_CODES.INVALID_INPUT, 'resolve needs an iterable of series keys', { got: show(present) });
  }
  const seen = new Set();
  for (const key of present) {
    if (typeof key !== 'string' || key.length === 0) {
      fail(ERROR_CODES.INVALID_INPUT, `series key must be a non-empty string, got ${show(key)}`, { got: show(key) });
    }
    seen.add(key);
  }
  // Sorted, so the same set of undeclared series always resolves the same way
  // whatever order the records arrived in.
  const undeclared = [...seen].filter((k) => !byKey.has(k)).sort();
  const usable = fallbacks.filter((c) => !declaredColors.has(c.toLowerCase()));
  if (undeclared.length > usable.length) {
    fail(ERROR_CODES.FALLBACK_PALETTE_EXHAUSTED,
      `${undeclared.length} undeclared series and ${usable.length} fallback colours free. ` +
      'Declare them, pass a larger fallbackColors, or facet: two series sharing a stroke is a chart that lies.',
      { needed: undeclared.length, available: usable.length, undeclared });
  }

  const colors = new Map(byKey.entries().map(([k, e]) => [k, e.color]));
  const labels = new Map(byKey.entries().map(([k, e]) => [k, e.label]));
  undeclared.forEach((key, i) => {
    colors.set(key, usable[i]);
    labels.set(key, key);
  });

  const keys = Object.freeze([...declaredKeys, ...undeclared]);
  const resolved = {
    [BRAND]: true,
    keys,
    present: Object.freeze(keys.filter((k) => seen.has(k))),
    isDeclared: (/** @type {string} */ key) => byKey.has(key),
    colorOf: (/** @type {string} */ key) => {
      const hit = colors.get(key);
      if (hit === undefined) fail(ERROR_CODES.UNKNOWN_SERIES, `no series named ${show(key)}`, { key });
      return hit;
    },
    labelOf: (/** @type {string} */ key) => {
      const hit = labels.get(key);
      if (hit === undefined) fail(ERROR_CODES.UNKNOWN_SERIES, `no series named ${show(key)}`, { key });
      return hit;
    },
  };
  return Object.freeze(resolved);
}
