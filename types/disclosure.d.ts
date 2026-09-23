/**
 * Scan a rendered SVG for anything that should never reach a public site.
 *
 * Returns every match rather than a boolean, so a consumer can print what it
 * found. An empty array is the only passing result.
 *
 * @param {string} svg
 * @returns {Disclosure[]}
 */
export function scanForDisclosure(svg: string): Disclosure[];
export type Disclosure = {
    rule: string;
    match: string;
    index: number;
};
