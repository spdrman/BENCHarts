/**
 * Throw helper, so a call site reads as one line and every refusal is built the
 * same way.
 *
 * @param {BenchartsErrorCode} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {never}
 */
export function fail(code: BenchartsErrorCode, message: string, details?: Record<string, unknown> | undefined): never;
/**
 * The one error this library throws, and the codes it carries.
 *
 * This module imports nothing. It is a leaf by rule (ADR-006), so every other
 * module can reach it without a cycle.
 *
 * @module
 */
/**
 * Every refusal BENCHarts can produce, as a frozen const object rather than an
 * enum: the codes are a stable API, and a caller should be able to read them at
 * runtime as well as in a type position.
 *
 * Each key equals its value, so a mistyped member cannot silently alias another.
 */
export const ERROR_CODES: Readonly<{
    INVALID_SERIES_DEFINITION: "INVALID_SERIES_DEFINITION";
    INVALID_COLOR: "INVALID_COLOR";
    DUPLICATE_SERIES_KEY: "DUPLICATE_SERIES_KEY";
    DUPLICATE_SERIES_COLOR: "DUPLICATE_SERIES_COLOR";
    UNKNOWN_SERIES: "UNKNOWN_SERIES";
    FALLBACK_PALETTE_EXHAUSTED: "FALLBACK_PALETTE_EXHAUSTED";
    UNKNOWN_OPTION: "UNKNOWN_OPTION";
    INVALID_OPTION: "INVALID_OPTION";
    INVALID_INPUT: "INVALID_INPUT";
    INVALID_RECORD: "INVALID_RECORD";
    DUPLICATE_RECORD: "DUPLICATE_RECORD";
    INCONSISTENT_STEP_LABEL: "INCONSISTENT_STEP_LABEL";
    EMPTY_INPUT: "EMPTY_INPUT";
    NO_PLOTTABLE_POINTS: "NO_PLOTTABLE_POINTS";
}>;
/**
 * @typedef {typeof ERROR_CODES[keyof typeof ERROR_CODES]} BenchartsErrorCode
 */
/**
 * The single error type. `code` is the stable part a caller branches on;
 * `message` is prose that may change; `details` carries the offending index,
 * field or value so a pipeline can say which record was wrong without parsing
 * the message.
 */
export class BenchartsError extends Error {
    /**
     * @param {BenchartsErrorCode} code
     * @param {string} message
     * @param {Record<string, unknown>} [details]
     */
    constructor(code: BenchartsErrorCode, message: string, details?: Record<string, unknown> | undefined);
    /** @type {BenchartsErrorCode} */
    code: BenchartsErrorCode;
    /** @type {Readonly<Record<string, unknown>>} */
    details: Readonly<Record<string, unknown>>;
}
export type BenchartsErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
