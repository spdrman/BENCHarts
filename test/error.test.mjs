import test from 'node:test';
import assert from 'node:assert/strict';
import { BenchartsError, ERROR_CODES } from '../src/error.js';

test('the code union is exactly the fourteen the spec publishes', () => {
  assert.deepEqual(Object.keys(ERROR_CODES).sort(), [
    'DUPLICATE_RECORD', 'DUPLICATE_SERIES_COLOR', 'DUPLICATE_SERIES_KEY',
    'EMPTY_INPUT', 'FALLBACK_PALETTE_EXHAUSTED', 'INCONSISTENT_STEP_LABEL',
    'INVALID_COLOR', 'INVALID_INPUT', 'INVALID_OPTION', 'INVALID_RECORD',
    'INVALID_SERIES_DEFINITION', 'NO_PLOTTABLE_POINTS', 'UNKNOWN_OPTION',
    'UNKNOWN_SERIES',
  ]);
});

test('each code is its own name, so a typo cannot silently alias another', () => {
  for (const [k, v] of Object.entries(ERROR_CODES)) assert.equal(k, v);
});

test('the codes are frozen, because they are a stable API', () => {
  assert.ok(Object.isFrozen(ERROR_CODES));
});

test('a BenchartsError is an Error and carries its code and details', () => {
  const e = new BenchartsError(ERROR_CODES.UNKNOWN_SERIES, 'no such series', { key: 'x', index: 3 });
  assert.ok(e instanceof Error);
  assert.ok(e instanceof BenchartsError);
  assert.equal(e.name, 'BenchartsError');
  assert.equal(e.code, 'UNKNOWN_SERIES');
  assert.equal(e.message, 'no such series');
  assert.deepEqual({ ...e.details }, { key: 'x', index: 3 });
});

test('details are frozen and detached from the caller object', () => {
  const src = { key: 'x' };
  const e = new BenchartsError(ERROR_CODES.UNKNOWN_SERIES, 'm', src);
  src.key = 'mutated';
  assert.equal(e.details.key, 'x');
  assert.ok(Object.isFrozen(e.details));
});

test('details default to an empty object rather than undefined', () => {
  const e = new BenchartsError(ERROR_CODES.EMPTY_INPUT, 'm');
  assert.deepEqual({ ...e.details }, {});
});
