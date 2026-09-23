/**
 * BENCHarts: benchmark results as SVG.
 *
 * Records in, a deterministic string out. No DOM, no canvas, no async, no
 * runtime dependencies.
 *
 * This module re-exports and holds no logic (ADR-006 rule 2). The scale helpers
 * stay internal for 1.0 (D8): a `/primitives` subpath can be added later
 * without breaking anyone, and removing one could not.
 *
 * @module
 */

export { BenchartsError, ERROR_CODES } from './error.js';
export { defineSeries } from './series.js';
export { DEFAULT_FALLBACK_COLORS } from './palette.js';
export { renderGroupedBars } from './charts/grouped-bars.js';
export { renderTrend } from './charts/trend.js';
export { renderSweep } from './charts/sweep.js';
export { renderPlaceholder } from './svg.js';
export { formatNumber, formatLogTick } from './format.js';
export { scanForDisclosure } from './disclosure.js';
