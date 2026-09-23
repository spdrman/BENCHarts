import test from 'node:test';
import assert from 'node:assert/strict';
import { wellFormed, assertWellFormed, hasForbiddenChars } from './lib/xml.mjs';
import {
  renderPlaceholder, svgDocument, themeStyle, estimateTextWidth,
  layoutLegend, niceTicks, snap125, LEGEND_ROW_HEIGHT, FONT_STACK,
} from '../src/svg.js';

test('the well-formedness checker agrees with itself before anything relies on it', () => {
  const cases = [
    ['<svg><text>ok</text></svg>', true],
    ['<svg><text>a &amp; b</text></svg>', true],
    ['<svg><text>a & b</text></svg>', false],
    ['<svg><text>a < b</text></svg>', false],
    ['<svg><rect fill=#000 /></svg>', false],
    ['<svg><g><rect x="1"/></svg>', false],
    ['<svg><rect title="a > b"/></svg>', true],
  ];
  for (const [xml, want] of cases) assert.equal(wellFormed(xml).ok, want, xml);
  assert.ok(wellFormed('<svg><script>x</script></svg>').ok,
    'a script element is WELL FORMED, which is exactly why S1 needs its own check');
});

test('a placeholder is well-formed and carries its message escaped', () => {
  const svg = renderPlaceholder({ width: 400, height: 200, message: 'no data for <storage>' });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('&lt;storage&gt;'));
  assert.ok(!svg.includes('<storage>'));
});

test('a placeholder refuses a hostile message rather than drawing it', () => {
  assert.throws(() => renderPlaceholder({ width: 400, height: 200, message: 'a\u0001b' }),
    (e) => e.code === 'INVALID_OPTION');
  assert.throws(() => renderPlaceholder({ width: '400', height: 200, message: 'x' }),
    (e) => e.code === 'INVALID_OPTION');
});

test('the document is well-formed and declares the SVG namespace', () => {
  const svg = svgDocument({ width: 600, height: 300, body: '<rect x="1" y="1" width="2" height="2"/>' });
  assertWellFormed(svg, assert);
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(!hasForbiddenChars(svg));
});

test('ADR-004: an auto-themed chart carries both token sets', () => {
  const css = themeStyle('auto');
  assert.ok(css.includes('prefers-color-scheme: dark'));
  assert.ok(css.includes(':root:not([data-theme="light"])'));
  assert.ok(css.includes(':root[data-theme="dark"]'));
  assert.ok(css.includes('#ffffff') && css.includes('#1a1a19'));
});

test('ADR-004: a fixed theme carries one token set and no media query', () => {
  for (const [theme, surface, other] of [['light', '#ffffff', '#1a1a19'], ['dark', '#1a1a19', '#ffffff']]) {
    const css = themeStyle(theme);
    assert.ok(!css.includes('prefers-color-scheme'), `${theme} must not negotiate`);
    assert.ok(css.includes(surface));
    assert.ok(!css.includes(other));
  }
});

test('ADR-004: the SVG paints its own surface by default, and can be told not to', () => {
  const opaque = svgDocument({ width: 100, height: 100, body: '' });
  const clear = svgDocument({ width: 100, height: 100, body: '', surface: 'transparent' });
  assert.ok(opaque.includes('class="bc-surface"'));
  assert.ok(!clear.includes('class="bc-surface"'));
  assertWellFormed(clear, assert);
});

test('the font stack names a family Firefox understands', () => {
  assert.ok(FONT_STACK.includes('system-ui'));
  assert.ok(FONT_STACK.includes('sans-serif'), 'ui-sans-serif alone falls through to a serif in Firefox');
});

test('text width estimation grows with length and with size', () => {
  assert.ok(estimateTextWidth('mm', 11) > estimateTextWidth('m', 11));
  assert.ok(estimateTextWidth('mmmm', 22) > estimateTextWidth('mmmm', 11));
  assert.ok(estimateTextWidth('iiii', 11) < estimateTextWidth('MMMM', 11), 'narrow glyphs measure narrower');
  assert.ok(estimateTextWidth('', 11) === 0);
});

/* P4's stated proof. The old legend used a constant `i * 150` pitch, which put
 * the sixth entry past the right edge: at eleven series the swatches ran from
 * x = 1106 to 1556 inside a 1042-wide viewBox. */
test('every legend entry sits inside the plot width, for 1 to 8 series', () => {
  const maxWidth = 560;
  for (let n = 1; n <= 8; n++) {
    const items = Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: 'fourteen-chars'.slice(0, 14), color: '#34a853' }));
    const { rows, height } = layoutLegend(items, maxWidth, 11);
    assert.equal(rows.flat().length, n, `${n} series must all be placed`);
    for (const entry of rows.flat()) {
      assert.ok(entry.x >= 0, `entry x ${entry.x} is off the left edge at n=${n}`);
      assert.ok(entry.x + entry.width <= maxWidth,
        `entry ends at ${entry.x + entry.width} past ${maxWidth} at n=${n}`);
    }
    assert.equal(height, rows.length * LEGEND_ROW_HEIGHT);
  }
});

test('a label too long for the width still gets placed rather than dropped', () => {
  const { rows } = layoutLegend([{ key: 'a', label: 'x'.repeat(200), color: '#34a853' }], 200, 11);
  assert.equal(rows.flat().length, 1);
  assert.equal(rows.flat()[0].x, 0);
});

test('bar ticks run from zero and land on round numbers', () => {
  for (const max of [1, 7, 23, 99, 100, 1234, 0.04]) {
    const ticks = niceTicks(max);
    assert.equal(ticks[0], 0, 'a bar axis always starts at zero');
    assert.ok(ticks.length >= 4 && ticks.length <= 6, `${ticks.length} ticks for max ${max}`);
    assert.ok(ticks[ticks.length - 1] >= max, 'the domain must enclose the data');
    assert.ok(ticks.every(Number.isFinite));
  }
});

test('niceTicks survives a degenerate domain', () => {
  for (const max of [0, Number.NaN, Infinity, -5]) {
    const ticks = niceTicks(max);
    assert.ok(ticks.length >= 2 && ticks.every(Number.isFinite), `max ${max} gave ${ticks}`);
    assert.equal(ticks[0], 0);
  }
});

test('a sweep spanning less than a decade snaps to 1-2-5, not to the enclosing decade', () => {
  const [lo, hi] = snap125(2200, 4500);
  assert.ok(lo >= 1000 && lo <= 2200, `lo ${lo}`);
  assert.ok(hi <= 10000 && hi >= 4500, `hi ${hi}`);
  assert.ok(hi / lo < 10, 'the whole point: not stretched to 1000..10000');
});

test('snap125 stays finite for anything finite', () => {
  for (const [a, b] of [[1, 1], [0, 5], [-1, 5], [1e-320, 1e308]]) {
    const [lo, hi] = snap125(a, b);
    assert.ok(Number.isFinite(lo) && Number.isFinite(hi), `${a}..${b} -> ${lo}..${hi}`);
  }
});
