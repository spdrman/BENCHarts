import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORICAL, DEFAULT_FALLBACK_COLORS, INK, CHECKED_SURFACES,
  DELTA_E_FLOOR, CONTRAST_FLOOR,
} from '../src/palette.js';
import { deltaEUnder, contrast, simulate, deltaE, VISION } from './lib/color.mjs';

/* The validator has to be checked before it is trusted. A simulation that gets
 * these three wrong is measuring something other than colour vision, and I had
 * one that did: it scored a luminance-matched red against green at 22 under
 * deuteranopia and would have waved through anything. */
test('the CVD simulation reproduces the three textbook confusions', () => {
  const blueYellow = VISION.map((v) => deltaEUnder('#0000ff', '#ffff00', v));
  assert.equal(Math.min(...blueYellow), blueYellow[VISION.indexOf('tritan')],
    'blue against yellow must collapse furthest under tritan and nowhere else');

  const redGreen = VISION.map((v) => deltaEUnder('#e60000', '#00a000', v));
  const rgDeutan = redGreen[VISION.indexOf('deutan')];
  const rgNormal = redGreen[VISION.indexOf('normal')];
  assert.equal(Math.min(...redGreen), rgDeutan,
    'a luminance-matched red against green must collapse furthest under deutan');
  assert.ok(rgDeutan < rgNormal * 0.1,
    `and it must be a collapse, not a nudge: ${rgDeutan.toFixed(1)} from ${rgNormal.toFixed(1)}`);

  const twoBlues = VISION.map((v) => deltaEUnder('#3b7dd8', '#39a3d8', v));
  assert.equal(Math.min(...twoBlues), twoBlues[VISION.indexOf('tritan')],
    'two nearby blues must collapse furthest under tritan');
});

test('simulation is stable, so the gate cannot drift under it', () => {
  assert.equal(simulate('#ff0000', 'deutan'), simulate('#ff0000', 'deutan'));
  assert.equal(deltaE('#ffffff', '#ffffff'), 0);
});

test('every colour is a validated lower-case #rrggbb', () => {
  for (const c of CATEGORICAL) assert.match(c, /^#[0-9a-f]{6}$/);
  for (const mode of Object.values(INK)) {
    for (const c of Object.values(mode)) assert.match(c, /^#[0-9a-fA-F]{6}$/);
  }
});

test('no slot repeats, so two series can never be handed one colour', () => {
  assert.equal(new Set(CATEGORICAL).size, CATEGORICAL.length);
});

/* Checks 1 to 4: separation, under each vision type, for EVERY pair rather than
 * only the adjacent ones. Adjacency is the bar-group case, but any two lines
 * can cross in a sweep and any two swatches sit together in a legend. */
for (const vision of VISION) {
  test(`check: every pair separates under ${vision}`, () => {
    for (let i = 0; i < CATEGORICAL.length; i++) {
      for (let j = i + 1; j < CATEGORICAL.length; j++) {
        const d = deltaEUnder(CATEGORICAL[i], CATEGORICAL[j], vision);
        assert.ok(d >= DELTA_E_FLOOR,
          `slot ${i + 1} ${CATEGORICAL[i]} against slot ${j + 1} ${CATEGORICAL[j]} is ${d.toFixed(1)} under ${vision}`);
      }
    }
  });
}

/* Checks 5 and 6: contrast, light and dark. */
test('check: every colour clears the contrast floor on the light surface', () => {
  const c = contrast(CATEGORICAL[0], '#ffffff');
  assert.ok(Number.isFinite(c));
  for (const colour of CATEGORICAL) {
    const ratio = contrast(colour, '#ffffff');
    assert.ok(ratio >= CONTRAST_FLOOR, `${colour} is ${ratio.toFixed(2)} on #ffffff`);
  }
});

test('check: every colour clears the contrast floor on every dark surface a consumer paints', () => {
  for (const surface of CHECKED_SURFACES.slice(1)) {
    for (const colour of CATEGORICAL) {
      const ratio = contrast(colour, surface);
      assert.ok(ratio >= CONTRAST_FLOOR, `${colour} is ${ratio.toFixed(2)} on ${surface}`);
    }
  }
});

test('ink reads against its own surface', () => {
  for (const [mode, tokens] of Object.entries(INK)) {
    assert.ok(contrast(tokens.primary, tokens.surface) >= 7,
      `${mode} primary ink is ${contrast(tokens.primary, tokens.surface).toFixed(2)}`);
    assert.ok(contrast(tokens.secondary, tokens.surface) >= 4.5,
      `${mode} secondary ink is ${contrast(tokens.secondary, tokens.surface).toFixed(2)}`);
    assert.ok(contrast(tokens.muted, tokens.surface) >= 3,
      `${mode} muted ink is ${contrast(tokens.muted, tokens.surface).toFixed(2)}`);
  }
});

test('the fallback palette is the categorical one, so capacity is its length', () => {
  assert.deepEqual(DEFAULT_FALLBACK_COLORS, CATEGORICAL);
  assert.ok(Object.isFrozen(DEFAULT_FALLBACK_COLORS));
});
