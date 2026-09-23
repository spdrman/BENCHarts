/**
 * A small XML well-formedness check, because Node ships no parser and
 * R-ESC-3 is asserted in a lot of places.
 *
 * It is deliberately strict and deliberately dumb: it tokenises tags, keeps a
 * stack, and refuses anything it cannot classify. A checker that guesses is
 * worse than none, because it turns a real escaping bug into a pass.
 */

const VOID_OK = new Set();

/** @param {string} xml @returns {{ ok: true } | { ok: false, why: string }} */
export function wellFormed(xml) {
  const stack = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) return checkText(xml.slice(i)) ?? finish(stack);
    const bad = checkText(xml.slice(i, lt));
    if (bad) return bad;
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) return { ok: false, why: 'unterminated comment' };
      if (xml.slice(lt + 4, end).includes('--')) return { ok: false, why: '-- inside a comment' };
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      if (end === -1) return { ok: false, why: 'unterminated CDATA' };
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt);
      if (end === -1) return { ok: false, why: 'unterminated processing instruction' };
      i = end + 2;
      continue;
    }
    const gt = findTagEnd(xml, lt);
    if (gt === -1) return { ok: false, why: `unterminated tag at ${lt}` };
    const raw = xml.slice(lt + 1, gt);
    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const open = stack.pop();
      if (open !== name) return { ok: false, why: `</${name}> closes <${open ?? 'nothing'}>` };
    } else {
      const selfClosing = raw.endsWith('/');
      const body = selfClosing ? raw.slice(0, -1) : raw;
      const m = /^([A-Za-z_][\w.:-]*)/.exec(body);
      if (!m) return { ok: false, why: `unparseable tag <${raw.slice(0, 30)}>` };
      const attrs = checkAttrs(body.slice(m[1].length));
      if (attrs) return attrs;
      if (!selfClosing && !VOID_OK.has(m[1])) stack.push(m[1]);
    }
    i = gt + 1;
  }
  return finish(stack);
}

/** A `>` inside a quoted attribute value does not end the tag. */
function findTagEnd(xml, from) {
  let quote = null;
  for (let i = from + 1; i < xml.length; i++) {
    const c = xml[i];
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') return i;
  }
  return -1;
}

function checkAttrs(s) {
  const re = /\s+([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let consumed = '';
  let m;
  while ((m = re.exec(s)) !== null) consumed += m[0];
  const leftover = s.length - consumed.length;
  if (leftover > 0 && s.replace(re, '').trim().length > 0) {
    return { ok: false, why: `unquoted or malformed attribute in "${s.trim().slice(0, 60)}"` };
  }
  for (const value of [...s.matchAll(re)].map((x) => x[3] ?? x[4])) {
    if (value.includes('<')) return { ok: false, why: 'raw < inside an attribute value' };
    const bad = badEntity(value);
    if (bad) return bad;
  }
  return null;
}

function checkText(text) {
  if (text.includes('<')) return { ok: false, why: 'raw < in text' };
  if (text.includes('>') && false) return null;
  return badEntity(text);
}

/** An ampersand must begin a well-formed entity reference. */
function badEntity(s) {
  const re = /&(#x[0-9A-Fa-f]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g;
  const stripped = s.replace(re, '');
  if (stripped.includes('&')) return { ok: false, why: `bare & in "${s.slice(0, 40)}"` };
  return null;
}

function finish(stack) {
  return stack.length ? { ok: false, why: `unclosed <${stack[stack.length - 1]}>` } : { ok: true };
}

/** @param {string} xml */
export function assertWellFormed(xml, assert, note = '') {
  const v = wellFormed(xml);
  assert.ok(v.ok, `${note}${v.ok ? '' : ` not well-formed XML: ${v.why}`}`);
}

/** Every character XML 1.0 forbids outright. */
export function hasForbiddenChars(xml) {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/.test(xml);
}
