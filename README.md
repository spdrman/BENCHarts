# BENCHarts

Benchmark results as SVG. A library of pure functions: records in, a
deterministic string out. No DOM, no canvas, no async, no runtime dependencies.

```
npm i bencharts
```

Three chart families: **grouped bars** (one column group per benchmark config,
one bar per series, optional error whiskers), **trend** (a timeline of released
versions, one polyline per series, gaps where a series is missing from a
snapshot), and **sweep** (a log-log or linear scan of one independent variable
against one metric).

## The rule worth knowing first

BENCHarts throws on anything that is a programming or pipeline error, and
degrades only on the three things that are legitimate data semantics you chose.
Nothing degrades silently.

It never hands back a well-formed chart with no marks in it. Output goes
straight to a file that a script then publishes, so a placeholder makes that
script succeed, writes a plausible artefact, and buries the real signal inside
an SVG nobody opens.

**A missing measurement is `NaN`, never a missing field.** That one line carries
the whole policy. `NaN` is how you say you measured and have nothing to show, so
the slot stays and reads `n/a`. A missing *field* is a broken producer, and that
throws.

## Grouped bars

```js
import { defineSeries, renderGroupedBars } from 'bencharts';
import { writeFileSync } from 'node:fs';

const series = defineSeries([
  { key: 'directory', label: 'Directory', color: '#34a853' },
  { key: 'pmtiles', label: 'PMTiles', color: '#2196f3' },
]);

const rows = report.cells.map((cell) => ({
  group: cell.scenario,
  series: cell.backend,
  value: cell.wall_ms,
  error: cell.ci95,
}));

const svg = renderGroupedBars(rows, {
  series,
  title: 'Storage backends',
  unit: 'ms',
  better: 'lower',
  errorLabel: '95% CI',
});

writeFileSync('storage.svg', svg);
```

One `.map()` is the whole adapter. There is no `seriesKey`, no `xKey` and no
accessor function: each family reads one fixed record shape, so a renderer can
check that `row.series` is a string, which it could never do for an arbitrary
accessor.

## Sweep

```js
import { defineSeries, renderSweep, scanForDisclosure } from 'bencharts';

const series = defineSeries([
  { key: 'alpha', label: 'Alpha' },
  { key: 'beta', label: 'Beta' },
]);

const svg = renderSweep(points, {
  series,
  scale: 'log',
  xLabel: 'workers',
  yLabel: 'tiles/s',
  title: 'Concurrency scan',
});

const leaks = scanForDisclosure(svg);
if (leaks.length > 0) {
  throw new Error(`refusing to publish: ${leaks.map((l) => `${l.rule} ${l.match}`).join(', ')}`);
}
```

Leaving `color` off a series draws the next free slot from the validated
palette. Run `scanForDisclosure` before anything is published: renderers read
only a closed field set, so it should never fire, which is exactly why it is
worth running.

## Record shapes

| Family | Shape |
| --- | --- |
| `renderGroupedBars` | `{ group: string, series: string, value: number, error?: number }` |
| `renderTrend` | `{ step: number, series: string, value: number, label?: string }` |
| `renderSweep` | `{ x: number, series: string, value: number }` |

Extra properties are ignored, so you can pass richer objects and a record with
a `cpu_model` on it renders byte-identically to one without.

## What it refuses, and what it degrades

**Throws**, with a stable `code` on a `BenchartsError` and the offending index
and field in `details`: an unreadable record, an unknown option name, a
duplicate cell, an empty array, a colour that is not `#rrggbb`, a series key
`defineSeries` never saw, a dimension that is not a finite number in
`(0, 16384]`, a label carrying a control or bidi character, and a finite value
outside `±1e300`.

**Degrades**, by design and documented: a `NaN` or infinite value draws a
labelled `n/a` slot; a `(group, series)` cell with no row keeps its slot with no
mark, because "not benchmarked" must never read as "0"; and on a log axis a
finite value at or below zero is dropped from the line, drawn hollow on the axis
floor, and counted in a note on the chart.

## Themes

Charts paint their own surface and carry both token sets, because both
consuming sites embed them with `<img>` and an `<img>` cannot inherit a host
token. Pass `theme: 'light' | 'dark'` for a fixed file, or `surface:
'transparent'` if you are inlining the SVG and want the page behind it.

A host with its own light and dark toggle needs two files, because a
`data-theme` attribute on the host cannot reach a separate document:

```html
<picture>
  <source srcset="chart-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="chart-light.svg" alt="Storage backends, ms, lower is better">
</picture>
```

## Documents

| File | What it holds |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | The design: D1 to D10, the public surface, refusal semantics, security requirements, the palette, the budgets, the build order |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Requirements, the context and module graphs, risks |
| [`docs/adr/`](docs/adr/) | Seven decision records, each naming the alternative it rejected |

## Development

```
node --test          # the suite, no dependencies needed
npx tsc --noEmit     # the types are checked against the code
npx tsc              # regenerate types/, which is committed
node tools/update-goldens.mjs
```

Types are JSDoc on the source with the declarations generated, so a declaration
cannot claim a signature the function does not have. There is no build step: the
files that ship are the files in `src/`.
