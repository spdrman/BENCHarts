/**
 * Colour maths for the palette gate. Test-only: it never ships, because a
 * consumer needs the validated palette, not the validator.
 *
 * sRGB to CIELAB for separation, Viénot-Brettel-Mollon dichromat projection for
 * colour vision deficiency, and WCAG relative luminance for contrast.
 */

/** @param {string} hex @returns {[number, number, number]} */
export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (/** @type {number} */ c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (/** @type {number} */ v) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
};

/** WCAG relative luminance. @param {string} hex @returns {number} */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. @returns {number} */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** @param {string} hex @returns {[number, number, number]} L*a*b* */
export function lab(hex) {
  const [r, g, b] = parseHex(hex).map(toLinear);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (/** @type {number} */ t) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 separation. Simple, and the floor is stated in the same units. */
export function deltaE(a, b) {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Machado, Oliveira and Gnanasekaran (2009) severity-1.0 matrices, applied to
 * LINEAR RGB. One 3x3 per deficiency, which is why this is the method to use:
 * there is almost nothing to get wrong.
 *
 * I tried the Viénot-Brettel-Mollon LMS projection first and it did not survive
 * a ground-truth check. These matrices do: blue against yellow collapses under
 * tritan and nowhere else, a luminance-matched red against green collapses
 * under deutan, and two nearby blues collapse under tritan. Any simulation that
 * fails those three is measuring something other than colour vision.
 */
const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};

/**
 * Simulate dichromat vision.
 *
 * @param {string} hex
 * @param {'protan'|'deutan'|'tritan'} kind
 * @returns {string}
 */
export function simulate(hex, kind) {
  const rgb = parseHex(hex).map(toLinear);
  const m = CVD[kind];
  const out = m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
  const hx = (/** @type {number} */ v) => fromLinear(v).toString(16).padStart(2, '0');
  return `#${hx(out[0])}${hx(out[1])}${hx(out[2])}`;
}

/** Separation under a given vision type. */
export function deltaEUnder(a, b, kind) {
  return kind === 'normal' ? deltaE(a, b) : deltaE(simulate(a, kind), simulate(b, kind));
}

export const VISION = ['normal', 'protan', 'deutan', 'tritan'];
