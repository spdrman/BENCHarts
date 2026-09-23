/**
 * The R-ESC-1 scanner: every interpolation in a template that emits markup has
 * to be an approved formatter call or a token that passed validation.
 *
 * Deliberately dumb. It refuses anything it cannot classify rather than
 * guessing, because a scanner that guesses turns a real escaping bug into a
 * pass.
 */

/**
 * Calls whose output is known safe: they escape, they emit digits only, or they
 * emit palette tokens the P3 gate already validated as `#rrggbb`.
 *
 * `declare` is on the list because the theme block it builds reads as markup to
 * this scanner: `:root:not([data-theme="light"])` looks like an attribute. It
 * maps over INK, and every value in INK is asserted to be a validated colour.
 */
const APPROVED_CALLS = /^(escapeXml|formatCoord|formatNumber|formatLogTick|themeStyle|pointsAttr|legendMarkup|declare)\s*\(/;

/** Validated constant tokens. */
const APPROVED_MEMBERS = /^(INK_VAR|TOKENS)\.\w+$/;

/**
 * Identifiers holding markup this library composed itself. Each one is a
 * deliberate exception, and adding to this list is the reviewable moment.
 */
const APPROVED_IDENTS = new Set([
  'background', // svgDocument: the surface rect, built two lines above
  'body', // svgDocument: the family's own parts, already scanned where built
  'head', // grouped-bars: the opening of a text element, built two lines above
  'rotate', // grouped-bars: a transform attribute built from formatCoord
]);

const EMPTY_STRING = /^(''|"")$/;

/** @param {string} src */
export function stripComments(src) {
  let out = '';
  let i = 0;
  let inString = null;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (!inString && two === '/*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (!inString && two === '//') {
      const end = src.indexOf('\n', i);
      i = end === -1 ? src.length : end;
      continue;
    }
    const c = src[i];
    if (inString) {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === inString) inString = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inString = c;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Pull out every template literal, with its literal text and its top-level
 * interpolations. Nested templates come back as their own entries.
 *
 * @param {string} src
 * @returns {Array<{ text: string, expressions: string[] }>}
 */
export function templateLiterals(src) {
  const found = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '`') continue;
    const parsed = readTemplate(src, i);
    if (!parsed) continue;
    found.push({ text: parsed.text, expressions: parsed.expressions });
    for (const expr of parsed.expressions) found.push(...templateLiterals(expr));
    i = parsed.end;
  }
  return found;
}

function readTemplate(src, start) {
  let text = '';
  const expressions = [];
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return { text, expressions, end: i };
    if (c === '$' && src[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      let nested = null;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (nested) {
          if (d === '\\') { j += 2; continue; }
          if (d === nested) nested = null;
        } else if (d === '"' || d === "'" || d === '`') nested = d;
        else if (d === '{') depth++;
        else if (d === '}') depth--;
        if (depth === 0) break;
        j++;
      }
      expressions.push(src.slice(i + 2, j));
      i = j + 1;
      continue;
    }
    text += c;
    i++;
  }
  return null;
}

/** Does this template emit markup? */
export function emitsMarkup(text) {
  return /<\/?[A-Za-z]/.test(text) || /\w+="/.test(text);
}

/** @param {string} expr */
export function expressionIsSafe(expr) {
  const e = expr.trim();
  if (e === '') return true;
  if (EMPTY_STRING.test(e)) return true;
  if (APPROVED_CALLS.test(e)) return true;
  if (APPROVED_MEMBERS.test(e)) return true;
  if (APPROVED_IDENTS.has(e)) return true;
  const ternary = /^[^?]+\?([^:]+):(.+)$/s.exec(e);
  if (ternary) return expressionIsSafe(ternary[1]) && expressionIsSafe(ternary[2]);
  return false;
}

/**
 * @param {string} src
 * @param {string} name
 * @returns {Array<{ file: string, expression: string }>}
 */
export function unsafeInterpolations(src, name) {
  const bad = [];
  for (const tpl of templateLiterals(stripComments(src))) {
    if (!emitsMarkup(tpl.text)) continue;
    for (const expr of tpl.expressions) {
      if (!expressionIsSafe(expr)) bad.push({ file: name, expression: expr.trim() });
    }
  }
  return bad;
}
