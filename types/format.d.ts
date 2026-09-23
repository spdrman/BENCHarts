/**
 * Number and string formatting. Every value that reaches an SVG attribute or a
 * text node passes through this module, so a fix here reaches all three chart
 * families at once. That is the point of the import rule in ADR-006.
 *
 * @module
 */
/**
 * Escape a string for both XML text nodes and double-quoted attributes.
 *
 * R-ESC-2 requires all five. The apostrophe is the one the ported code left
 * out: there are no single-quoted attributes today, but "today" is not a
 * guarantee, and the cost of covering it is one replace.
 *
 * The ampersand goes first. Any other order double-escapes the entities the
 * later replacements introduce.
 *
 * @param {unknown} s
 * @returns {string}
 */
export function escapeXml(s: unknown): string;
/**
 * Format a value for a DATA LABEL: the number a reader sees next to a bar or
 * at the end of a line.
 *
 * Ported unchanged in behaviour: `n/a` for anything non-finite, integers at
 * magnitudes at or above 100, otherwise up to two trimmed decimals. It is
 * locale-independent by construction, with no `Intl` and no separators.
 *
 * It deliberately collapses small magnitudes, so 0.001 and 0.0001 both read as
 * `0`. That is right for a bar label and wrong for a log axis tick, which is
 * why {@link formatLogTick} exists.
 *
 * @param {number} n
 * @returns {string}
 */
export function formatNumber(n: number): string;
/**
 * Format a value for a LOG-AXIS DECADE TICK.
 *
 * Compact scientific outside `[0.01, 1e5)`, a trimmed decimal within. The
 * split exists so two adjacent decades never render as the same string, which
 * {@link formatNumber} would do to 0.001 and 0.0001 and thereby label two
 * different gridlines identically.
 *
 * @param {number} v
 * @returns {string}
 */
export function formatLogTick(v: number): string;
/**
 * Format a coordinate for SVG GEOMETRY: two decimals, rounding halves away
 * from zero.
 *
 * BENCHarts defines this rule rather than inheriting one, because the two
 * obvious implementations disagree. `toFixed(2)` rounds on the decimal
 * expansion of the stored double; `Math.round(n * 100)` rounds after a
 * multiply that carries its own error. They part company wherever the product
 * lands near a half, and 2.675, 1.115 and 184.065 all do:
 *
 * ```
 * 2.675     toFixed(2) -> 2.67     arithmetic -> 2.68
 * 1.115     toFixed(2) -> 1.11     arithmetic -> 1.12
 * 184.065   toFixed(2) -> 184.06   arithmetic -> 184.07
 * ```
 *
 * The rule named in the spec is "half away from zero", and the bare
 * `Math.round(n * 100) / 100` it also names does not implement that: `Math.round`
 * breaks ties toward positive infinity, so `-2.675` comes back as `-2.67` while
 * `2.675` comes back as `2.68`. Rounding the magnitude and reapplying the sign
 * is what makes the rule symmetric, and negative coordinates are ordinary here
 * because a trend y domain is padded rather than zero-based.
 *
 * Two decimals rather than five costs 0.35% of pixels at 1x to 4x, all of it
 * one-pixel antialiasing, and saves 6.5% of raw bytes.
 *
 * Non-finite collapses to `0` rather than leaking `NaN` into an attribute, and
 * the result never carries an exponent, which SVG cannot parse as a coordinate.
 *
 * @param {number} n
 * @returns {string}
 */
export function formatCoord(n: number): string;
