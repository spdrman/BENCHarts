/**
 * The publish gate a consumer runs before an SVG leaves the building.
 *
 * Renderers read only the closed field set, so nothing here should ever fire.
 * That is exactly why it exists: a canary stamped into all 407 string fields of
 * a real report produced 0 leaks across 18 SVGs, which says the field selection
 * is correct today and says nothing about tomorrow. One careless title is all
 * it takes.
 *
 * @module
 */

/** @typedef {{ rule: string, match: string, index: number }} Disclosure */

/** Hosts that appear in every chart by specification, not by leak. */
const NAMESPACE_HOSTS = new Set(['www.w3.org', 'w3.org']);

/** @type {ReadonlyArray<readonly [string, RegExp]>} */
const RULES = [
  ['posix-home', /\/(?:Users|home)\/[A-Za-z0-9._-]+/g],
  ['windows-path', /[A-Za-z]:\\(?:[^\\\s"<>]+\\?)+/g],
  ['hostname', /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|dev|ca|local|internal|lan)\b/gi],
  ['ipv4', /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g],
  ['long-hex', /\b[0-9a-f]{16,}\b/gi],
  ['iso-8601', /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?\b/g],
  ['compact-timestamp', /\b\d{8}T\d{6}Z\b/g],
];

/**
 * Scan a rendered SVG for anything that should never reach a public site.
 *
 * Returns every match rather than a boolean, so a consumer can print what it
 * found. An empty array is the only passing result.
 *
 * @param {string} svg
 * @returns {Disclosure[]}
 */
export function scanForDisclosure(svg) {
  const text = String(svg);
  /** @type {Disclosure[]} */
  const found = [];
  for (const [rule, pattern] of RULES) {
    pattern.lastIndex = 0;
    /** @type {RegExpExecArray | null} */
    let m;
    while ((m = pattern.exec(text)) !== null) {
      // A gate that cries wolf gets switched off, so the two constants every
      // chart carries are exempt: the SVG namespace host, which is required on
      // the root element, and a six-digit colour, which is not a hex run.
      if (rule === 'long-hex' && /^[0-9a-f]{6}$/i.test(m[0])) continue;
      if (rule === 'hostname' && NAMESPACE_HOSTS.has(m[0].toLowerCase())) continue;
      found.push({ rule, match: m[0], index: m.index });
      if (m[0].length === 0) pattern.lastIndex++;
    }
  }
  return found.sort((a, b) => a.index - b.index);
}
