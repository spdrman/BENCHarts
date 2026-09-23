import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptions, validateDimension, validateLabel, validateRecords } from '../src/validate.js';
import { VALUE_MAX } from '../src/scale.js';

const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.name, 'BenchartsError');
  assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
  return true;
});

test('an unknown option throws, because a typo changes the picture silently', () => {
  const allowed = { title: 'string', width: 'dimension' };
  throwsCode(() => validateOptions({ titel: 'x' }, allowed), 'UNKNOWN_OPTION');
  for (const stale of ['theme', 'xKey', 'unitSuffix', 'logScale']) {
    throwsCode(() => validateOptions({ [stale]: 'x' }, allowed), 'UNKNOWN_OPTION');
  }
});

test('the refusal names the option and what was allowed', () => {
  assert.throws(() => validateOptions({ nope: 1 }, { title: 'string' }), (e) => {
    assert.equal(e.details.option, 'nope');
    assert.ok(String(e.message).includes('title'));
    return true;
  });
});

test('an option of the wrong type throws', () => {
  throwsCode(() => validateOptions({ title: 7 }, { title: 'string' }), 'INVALID_OPTION');
  throwsCode(() => validateOptions({ better: 'sideways' }, { better: ['lower', 'higher'] }), 'INVALID_OPTION');
});

test('R-VAL-3: a dimension is a finite number inside the canvas cap, never a coerced string', () => {
  assert.equal(validateDimension(800, 'width'), 800);
  throwsCode(() => validateDimension('800', 'width'), 'INVALID_OPTION');
  throwsCode(() => validateDimension(0, 'width'), 'INVALID_OPTION');
  throwsCode(() => validateDimension(-1, 'width'), 'INVALID_OPTION');
  throwsCode(() => validateDimension(16385, 'width'), 'INVALID_OPTION');
  throwsCode(() => validateDimension(Number.NaN, 'width'), 'INVALID_OPTION');
  throwsCode(() => validateDimension(Infinity, 'width'), 'INVALID_OPTION');
  assert.equal(validateDimension(16384, 'width'), 16384);
});

test('S4: a string width cannot inject an attribute on the root element', () => {
  throwsCode(() => validateDimension('800" onload="alert(1)', 'width'), 'INVALID_OPTION');
});

test('the cap is named in the refusal, so a caller can act on it', () => {
  assert.throws(() => validateDimension(20000, 'width'), (e) => {
    assert.ok(String(e.message).includes('16384'), e.message);
    return true;
  });
});

test('R-VAL-1: a label refuses control characters rather than stripping them', () => {
  assert.equal(validateLabel('v1.2.3', 'title'), 'v1.2.3');
  throwsCode(() => validateLabel('v1\x01', 'title'), 'INVALID_OPTION');
  throwsCode(() => validateLabel('a\u0000b', 'title'), 'INVALID_OPTION');
  throwsCode(() => validateLabel('a\u009Fb', 'title'), 'INVALID_OPTION');
});

test('R-VAL-1: bidi overrides and zero-width characters are refused', () => {
  for (const bad of ['‮', '‪', '⁦', '​', '‍', '﻿', '‎']) {
    throwsCode(() => validateLabel(`ok${bad}ok`, 'title'), 'INVALID_OPTION');
  }
});

test('R-ESC-3: the XML noncharacters are refused, never silently stripped', () => {
  throwsCode(() => validateLabel('a￾b', 'title'), 'INVALID_OPTION');
  throwsCode(() => validateLabel('a￿b', 'title'), 'INVALID_OPTION');
});

test('a lone surrogate is refused, a well-formed pair is not', () => {
  throwsCode(() => validateLabel('a\uD800b', 'title'), 'INVALID_OPTION');
  assert.equal(validateLabel('a\u{1F600}b', 'title'), 'a\u{1F600}b');
});

test('printable non-ASCII stays legal, because the titles already use it', () => {
  assert.equal(validateLabel('Wall time · lower is better', 'title'), 'Wall time · lower is better');
  assert.equal(validateLabel('µs', 'unit'), 'µs');
});

test('a label is 1 to 256 characters', () => {
  throwsCode(() => validateLabel('', 'title'), 'INVALID_OPTION');
  assert.equal(validateLabel('x'.repeat(256), 'title').length, 256);
  throwsCode(() => validateLabel('x'.repeat(257), 'title'), 'INVALID_OPTION');
});

test('a label that is not a string is refused rather than coerced', () => {
  throwsCode(() => validateLabel(7, 'title'), 'INVALID_OPTION');
  throwsCode(() => validateLabel(null, 'title'), 'INVALID_OPTION');
  throwsCode(() => validateLabel({ toString: () => 'x' }, 'title'), 'INVALID_OPTION');
});

const bar = (group, series, value, error) => ({ group, series, value, ...(error === undefined ? {} : { error }) });

test('records must be an array, and a non-empty one', () => {
  throwsCode(() => validateRecords('nope', 'bar'), 'INVALID_INPUT');
  throwsCode(() => validateRecords(null, 'bar'), 'INVALID_INPUT');
  throwsCode(() => validateRecords([], 'bar'), 'EMPTY_INPUT');
});

test('EVERY record is checked, not just the first', () => {
  const rows = Array.from({ length: 60 }, (_, i) => bar(`g${i}`, 's', i));
  delete rows[57].series;
  assert.throws(() => validateRecords(rows, 'bar'), (e) => {
    assert.equal(e.code, 'INVALID_RECORD');
    assert.equal(e.details.index, 57, 'the old shape probes only looked at record 0');
    return true;
  });
});

test('each family reads its own axis field and refuses the wrong type', () => {
  throwsCode(() => validateRecords([{ group: 7, series: 's', value: 1 }], 'bar'), 'INVALID_RECORD');
  throwsCode(() => validateRecords([{ step: 'one', series: 's', value: 1 }], 'trend'), 'INVALID_RECORD');
  throwsCode(() => validateRecords([{ x: 'one', series: 's', value: 1 }], 'sweep'), 'INVALID_RECORD');
  assert.ok(validateRecords([{ step: 1, series: 's', value: 1 }], 'trend'));
});

test('a missing field is refused, and a NaN value is not', () => {
  throwsCode(() => validateRecords([{ group: 'g', series: 's' }], 'bar'), 'INVALID_RECORD');
  const ok = validateRecords([bar('g', 's', Number.NaN)], 'bar');
  assert.equal(ok.rows.length, 1, 'NaN is how a caller says they measured and have nothing');
});

test('R-VAL-4: a finite value past the window is refused, with the cap named', () => {
  assert.throws(() => validateRecords([bar('g', 's', 1.5e308)], 'bar'), (e) => {
    assert.equal(e.code, 'INVALID_RECORD');
    assert.ok(String(e.message).includes('1e+300') || String(e.message).includes('1e300'), e.message);
    return true;
  });
  assert.ok(validateRecords([bar('g', 's', VALUE_MAX)], 'bar'), 'the boundary itself is in');
});

test('a negative error bar is refused', () => {
  throwsCode(() => validateRecords([bar('g', 's', 1, -2)], 'bar'), 'INVALID_RECORD');
  assert.ok(validateRecords([bar('g', 's', 1, 0.5)], 'bar'));
});

test('S6: two rows sharing a cell are caught, and the key is never a joined string', () => {
  throwsCode(() => validateRecords([bar('g', 's', 1), bar('g', 's', 2)], 'bar'), 'DUPLICATE_RECORD');
  // The collision the old joined `config|series` key could not see.
  assert.ok(validateRecords([bar('a|b', 'c', 1), bar('a', 'b|c', 2)], 'bar'),
    'these are different cells and must both survive');
});

test('a duplicate is caught on each family own axis', () => {
  throwsCode(() => validateRecords([{ step: 1, series: 's', value: 1 }, { step: 1, series: 's', value: 2 }], 'trend'), 'DUPLICATE_RECORD');
  throwsCode(() => validateRecords([{ x: 2, series: 's', value: 1 }, { x: 2, series: 's', value: 2 }], 'sweep'), 'DUPLICATE_RECORD');
});

test('two trend points at one step disagreeing on label is its own refusal', () => {
  throwsCode(() => validateRecords([
    { step: 1, series: 'a', value: 1, label: 'v1' },
    { step: 1, series: 'b', value: 2, label: 'v2' },
  ], 'trend'), 'INCONSISTENT_STEP_LABEL');
  assert.ok(validateRecords([
    { step: 1, series: 'a', value: 1, label: 'v1' },
    { step: 1, series: 'b', value: 2, label: 'v1' },
  ], 'trend'));
});

test('extra properties are ignored, so a caller may pass richer objects', () => {
  const out = validateRecords([{ group: 'g', series: 's', value: 1, cpu_model: 'leaky', host: 'secret' }], 'bar');
  assert.deepEqual(Object.keys(out.rows[0]).sort(), ['group', 'series', 'value']);
});

test('the axis values and series keys come back in first-seen order', () => {
  const out = validateRecords([bar('b', 'y', 1), bar('a', 'x', 2), bar('b', 'x', 3)], 'bar');
  assert.deepEqual(out.axisValues, ['b', 'a']);
  assert.deepEqual(out.seriesKeys, ['y', 'x']);
});

test('a record that is not an object is refused', () => {
  throwsCode(() => validateRecords([null], 'bar'), 'INVALID_RECORD');
  throwsCode(() => validateRecords(['x'], 'bar'), 'INVALID_RECORD');
  throwsCode(() => validateRecords([[]], 'bar'), 'INVALID_RECORD');
});

test('a series key on a record goes through the label class too', () => {
  throwsCode(() => validateRecords([bar('g', 'a‮b', 1)], 'bar'), 'INVALID_RECORD');
  throwsCode(() => validateRecords([bar('a\x01', 's', 1)], 'bar'), 'INVALID_RECORD');
});
