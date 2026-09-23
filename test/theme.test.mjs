import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGroupedBars } from '../src/index.js';
import { defineSeries } from '../src/series.js';
import { themeStyle } from '../src/svg.js';
import { INK } from '../src/palette.js';
import { BAR_ROWS, SERIES_DEFS } from './fixtures/data.mjs';

const series = defineSeries(SERIES_DEFS);
const render = (theme) => renderGroupedBars(BAR_ROWS, { series, title: 'Storage', theme });
const tokensIn = (css, selector) => {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `no ${selector} block`);
  const open = css.indexOf('{', at + selector.length);
  return Object.fromEntries([...css.slice(open + 1, css.indexOf('}', open)).matchAll(/--([\w-]+):(#[0-9a-fA-F]{6})/g)]
    .map((m) => [m[1], m[2].toLowerCase()]));
};

test('the dark tier of an auto chart declares exactly the fixed dark tokens', () => {
  const auto = themeStyle('auto');
  const fixed = tokensIn(themeStyle('dark'), ':root');
  const media = tokensIn(auto, ':root:not([data-theme="light"])');
  const attribute = tokensIn(auto, ':root[data-theme="dark"]');
  assert.deepEqual(media, fixed, 'the auto media tier must be the fixed dark file');
  assert.deepEqual(attribute, fixed, 'and so must the attribute tier');
});

test('the light tier of an auto chart declares exactly the fixed light tokens', () => {
  assert.deepEqual(tokensIn(themeStyle('auto'), ':root'), tokensIn(themeStyle('light'), ':root'));
});

test('every ink token reaches the style block, so nothing is hardcoded past it', () => {
  const css = themeStyle('auto');
  for (const [mode, tokens] of Object.entries(INK)) {
    for (const value of Object.values(tokens)) {
      assert.ok(css.toLowerCase().includes(value.toLowerCase()), `${mode} ${value} never reaches the CSS`);
    }
  }
});

test('marks reference tokens rather than literal ink, so a theme can move them', () => {
  const svg = render('auto');
  for (const literal of [INK.light.primary, INK.light.muted, INK.light.grid]) {
    const uses = svg.split(literal).length - 1;
    const inCss = themeStyle('auto').split(literal).length - 1;
    assert.equal(uses, inCss, `${literal} appears outside the style block, so dark mode cannot move it`);
  }
});

test('a fixed theme carries one tier and no negotiation', () => {
  for (const theme of ['light', 'dark']) {
    const svg = render(theme);
    assert.ok(!svg.includes('prefers-color-scheme'), `${theme} must not negotiate`);
    assert.ok(!svg.includes('data-theme'), `${theme} must not carry a tier it cannot use`);
  }
});

/* ADR-004 is explicit that the attribute tier can only ever fire on an INLINED
 * chart: an <img>-referenced SVG is a separate document with no host to take a
 * data-theme attribute from. This records the structure that claim rests on. */
test('the attribute tier exists but is documented as reaching inlined charts only', () => {
  const svg = render('auto');
  assert.ok(svg.includes(':root[data-theme="dark"]'));
  assert.ok(svg.includes('@media (prefers-color-scheme: dark)'),
    'the media tier is the only one an <img> embed can reach');
});

test('the three themes differ from each other in the rendered file', () => {
  const [auto, light, dark] = ['auto', 'light', 'dark'].map(render);
  assert.notEqual(auto, light);
  assert.notEqual(auto, dark);
  assert.notEqual(light, dark);
});
