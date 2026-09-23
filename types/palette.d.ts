/**
 * The frozen palette: eight categorical slots and the ink tokens, in both
 * modes.
 *
 * This module imports nothing. It is a leaf by rule (ADR-006).
 *
 * Every value here is validator output rather than taste. `test/palette.test.mjs`
 * re-derives the verdict on each run and fails the build on any FAIL, so a
 * colour cannot be edited in without clearing the same six checks.
 *
 * @module
 */
/**
 * Categorical colours in draw order, the same hex in light and dark.
 *
 * The order is load bearing. Putting blue between green and red is what keeps
 * the green and the red apart in a bar group, since they are what a reader
 * compares. Each of the first four keeps the hue family its engine already had
 * in the published articles, so a reader still finds libvips purple and
 * MapReduce red.
 */
export const CATEGORICAL: readonly string[];
/**
 * The fallback colours an undeclared series draws from.
 *
 * Capacity is the length of this array and nothing else (ADR-003). More series
 * than colours throws rather than wrapping, because two series sharing a stroke
 * is a chart that lies. A caller who needs more passes their own validated
 * array, and owns the result.
 */
export const DEFAULT_FALLBACK_COLORS: readonly string[];
/**
 * Ink and surface tokens. The dark values are independently chosen rather than
 * an inversion of the light ones.
 *
 * The SVG paints its own surface (ADR-004), because it is embedded with `<img>`
 * on both sites and an `<img>` cannot inherit a host token. The charts that
 * tried carry `fill="#444"` against a near-black page, which measures 2.04:1.
 */
export const INK: Readonly<{
    light: Readonly<{
        surface: "#ffffff";
        primary: "#1f1f1f";
        secondary: "#52514e";
        muted: "#898781";
        grid: "#e3e2dd";
        axis: "#c3c2b7";
        deemphasis: "#c3c2b7";
    }>;
    dark: Readonly<{
        surface: "#1a1a19";
        primary: "#f2f2f0";
        secondary: "#c3c2b7";
        muted: "#898781";
        grid: "#2c2c2a";
        axis: "#383835";
        deemphasis: "#4a4a47";
    }>;
}>;
/**
 * The surfaces the gate checks a series colour against: this library's own two,
 * plus the three the consuming sites actually paint behind an embedded chart.
 */
export const CHECKED_SURFACES: readonly string[];
/** Separation floor, in CIE76 units, below which secondary encoding stops excusing it. */
export const DELTA_E_FLOOR: 6;
/** WCAG 1.4.11 non-text contrast floor for a graphical object. */
export const CONTRAST_FLOOR: 3;
