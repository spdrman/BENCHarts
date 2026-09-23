import test from 'node:test';
import assert from 'node:assert/strict';
import { defineSeries, isSeriesSet } from '../src/series.js';
import { CATEGORICAL } from '../src/palette.js';

const throwsCode = (fn, code) => assert.throws(fn, (e) => {
  assert.equal(e.name, 'BenchartsError');
  assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
  return true;
});

test('a declared set exposes its entries with every field filled in', () => {
  const set = defineSeries([{ key: 'pmtiles', label: 'PMTiles', color: '#34a853' }]);
  assert.deepEqual(set.keys, ['pmtiles']);
  assert.deepEqual(set.entries, [{ key: 'pmtiles', label: 'PMTiles', color: '#34a853' }]);
  assert.equal(set.colorOf('pmtiles'), '#34a853');
  assert.equal(set.labelOf('pmtiles'), 'PMTiles');
  assert.ok(set.has('pmtiles'));
});

test('label defaults to the key, and colour to the next free palette slot', () => {
  const set = defineSeries([{ key: 'a' }, { key: 'b' }]);
  assert.equal(set.labelOf('a'), 'a');
  assert.equal(set.colorOf('a'), CATEGORICAL[0]);
  assert.equal(set.colorOf('b'), CATEGORICAL[1]);
});

test('an auto-assigned colour never collides with one the caller declared', () => {
  const set = defineSeries([{ key: 'a', color: CATEGORICAL[0] }, { key: 'b' }]);
  assert.notEqual(set.colorOf('b'), CATEGORICAL[0]);
  assert.equal(new Set(set.entries.map((e) => e.color)).size, 2);
});

test('D3: colorOf takes no second argument, so a stale one cannot be passed', () => {
  const set = defineSeries([{ key: 'a', color: '#34a853' }]);
  assert.equal(set.colorOf.length, 1);
  assert.equal(set.resolve(['a']).colorOf.length, 1);
});

test('D5: a series named like an Object member is an ordinary string', () => {
  for (const key of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const set = defineSeries([{ key, color: '#34a853' }]);
    assert.equal(set.colorOf(key), '#34a853');
    assert.equal(typeof set.colorOf(key), 'string');
    assert.ok(set.has(key));
  }
});

test('an unknown key throws rather than quietly returning a different colour', () => {
  const set = defineSeries([{ key: 'a', color: '#34a853' }]);
  throwsCode(() => set.colorOf('constructor'), 'UNKNOWN_SERIES');
  throwsCode(() => set.colorOf('nope'), 'UNKNOWN_SERIES');
  throwsCode(() => set.labelOf('nope'), 'UNKNOWN_SERIES');
  assert.equal(set.has('constructor'), false);
});

test('every construction refusal carries its own code', () => {
  throwsCode(() => defineSeries('nope'), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([null]), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries(['a']), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([{}]), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([{ key: '' }]), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([{ key: 7 }]), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([{ key: 'a', label: 7 }]), 'INVALID_SERIES_DEFINITION');
  throwsCode(() => defineSeries([{ key: 'a', color: 'red' }]), 'INVALID_COLOR');
  throwsCode(() => defineSeries([{ key: 'a', color: '#ggg' }]), 'INVALID_COLOR');
  throwsCode(() => defineSeries([{ key: 'a', color: '#34a85' }]), 'INVALID_COLOR');
  throwsCode(() => defineSeries([{ key: 'a' }, { key: 'a' }]), 'DUPLICATE_SERIES_KEY');
  throwsCode(() => defineSeries([{ key: 'a', color: '#34a853' }, { key: 'b', color: '#34a853' }]), 'DUPLICATE_SERIES_COLOR');
});

test('S1: a colour carrying an SVG breakout is refused at construction, not escaped later', () => {
  throwsCode(() => defineSeries([{ key: 'a', color: '#000"/><script>PWNED</script><rect fill="#000' }]), 'INVALID_COLOR');
});

test('the refusal says which entry and which field', () => {
  assert.throws(() => defineSeries([{ key: 'a' }, { key: 'b', color: 'red' }]), (e) => {
    assert.equal(e.details.index, 1);
    assert.equal(e.details.field, 'color');
    return true;
  });
});

test('an eight-bit alpha is accepted, because R-VAL-2 allows it', () => {
  const set = defineSeries([{ key: 'a', color: '#34a853ff' }]);
  assert.equal(set.colorOf('a'), '#34a853ff');
});

test('resolve keeps declared order, then sorts the undeclared', () => {
  const set = defineSeries([{ key: 'z', color: '#34a853' }, { key: 'a', color: '#2196f3' }]);
  const r = set.resolve(['q', 'a', 'b', 'z']);
  assert.deepEqual(r.keys, ['z', 'a', 'b', 'q']);
  assert.ok(r.isDeclared('z'));
  assert.ok(!r.isDeclared('q'));
});

test('resolve is byte-stable across input permutations', () => {
  const set = defineSeries([{ key: 'z', color: '#34a853' }]);
  const a = set.resolve(['c', 'b', 'a', 'z']);
  const b = set.resolve(['z', 'a', 'b', 'c']);
  const c = set.resolve(['b', 'z', 'c', 'a', 'b']);
  assert.deepEqual(a.keys, b.keys);
  assert.deepEqual(b.keys, c.keys);
  assert.deepEqual(a.keys.map((k) => a.colorOf(k)), c.keys.map((k) => c.colorOf(k)));
});

test('present is what the renderer draws, and it is deduplicated', () => {
  const set = defineSeries([{ key: 'z', color: '#34a853' }, { key: 'unused', color: '#2196f3' }]);
  const r = set.resolve(['a', 'z', 'a']);
  assert.deepEqual(r.present, ['z', 'a']);
  assert.ok(r.keys.includes('unused'), 'a declared series stays in keys even when absent');
  assert.ok(!r.present.includes('unused'));
});

test('an undeclared series draws a fallback, and the same set always gets the same one', () => {
  const set = defineSeries([{ key: 'z', color: '#34a853' }]);
  const first = set.resolve(['a', 'b']);
  const second = set.resolve(['b', 'a']);
  assert.equal(first.colorOf('a'), second.colorOf('a'));
  assert.notEqual(first.colorOf('a'), first.colorOf('b'));
  assert.notEqual(first.colorOf('a'), '#34a853', 'never the declared colour');
});

test('a fallback equal to a declared colour is skipped rather than refused', () => {
  const set = defineSeries([{ key: 'z', color: CATEGORICAL[0] }]);
  const r = set.resolve(['a']);
  assert.notEqual(r.colorOf('a'), CATEGORICAL[0]);
});

test('resolve never falls back for an unknown key', () => {
  const set = defineSeries([{ key: 'z', color: '#34a853' }]);
  const r = set.resolve(['a']);
  throwsCode(() => r.colorOf('never-seen'), 'UNKNOWN_SERIES');
  throwsCode(() => r.labelOf('never-seen'), 'UNKNOWN_SERIES');
});

test('more series than colours throws rather than wrapping', () => {
  const set = defineSeries([]);
  const many = Array.from({ length: CATEGORICAL.length + 1 }, (_, i) => `s${i}`);
  throwsCode(() => set.resolve(many), 'FALLBACK_PALETTE_EXHAUSTED');
  assert.doesNotThrow(() => set.resolve(many.slice(0, CATEGORICAL.length)));
});

test('the refusal names the counts, so a caller can act on it', () => {
  const set = defineSeries([]);
  assert.throws(() => set.resolve(Array.from({ length: 20 }, (_, i) => `s${i}`)), (e) => {
    assert.equal(e.details.needed, 20);
    assert.equal(e.details.available, CATEGORICAL.length);
    return true;
  });
});

test('a caller-supplied fallback palette sets the capacity', () => {
  const set = defineSeries([], { fallbackColors: ['#111111', '#222222'] });
  assert.doesNotThrow(() => set.resolve(['a', 'b']));
  throwsCode(() => set.resolve(['a', 'b', 'c']), 'FALLBACK_PALETTE_EXHAUSTED');
  throwsCode(() => defineSeries([], { fallbackColors: ['nope'] }), 'INVALID_COLOR');
  throwsCode(() => defineSeries([], { fallbackColors: ['#111111', '#111111'] }), 'DUPLICATE_SERIES_COLOR');
});

test('an unknown construction option throws', () => {
  throwsCode(() => defineSeries([], { fallbackColours: [] }), 'UNKNOWN_OPTION');
});

test('the brand is a real brand, so a look-alike object is not a SeriesSet', () => {
  const set = defineSeries([{ key: 'a' }]);
  assert.ok(isSeriesSet(set));
  assert.ok(!isSeriesSet({ keys: ['a'], colorOf: () => '#34a853', entries: [], resolve() {} }));
  assert.ok(!isSeriesSet(null));
  assert.ok(!isSeriesSet(undefined));
});

test('the set is frozen, so a caller cannot edit identity after the fact', () => {
  const set = defineSeries([{ key: 'a', color: '#34a853' }]);
  assert.ok(Object.isFrozen(set));
  assert.ok(Object.isFrozen(set.entries));
  assert.throws(() => { set.entries[0].color = '#000000'; });
});
