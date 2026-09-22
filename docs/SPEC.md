# BENCHarts: specification

Status: **draft for review**. Nothing here is implemented yet.

BENCHarts renders benchmark results as SVG. It is a library of pure functions:
records in, a deterministic SVG string out. No DOM, no canvas, no async, no
runtime dependencies.

Package `bencharts` (npm forbids capitals, so the manifest is lower case
while the project is BENCHarts everywhere else). Repo
`github.com/spdrman/BENCHarts`.

Three chart families:

- **grouped bars**, one column group per benchmark config, one bar per series,
  optional error whiskers
- **trend**, x is a position on a timeline of released versions, one polyline per
  series, with gaps where a series is missing from a snapshot
- **sweep**, a log-log or linear scan of one independent variable against one
  metric, one polyline per series

## Why this repo exists

The code began as causl-bench's `packages/bench/src/chart.ts`. It was ported by
hand into libviprs-bench as `tools/charts/chart.mjs` and adapted to libviprs's
engines. The two then diverged and can no longer be reconciled.

That is not my summary, it is already written down in the repo next door.
`libviprs-bench/tools/contract/README.md` opens by saying the port is exactly why
a neighbouring subsystem chose frozen vendoring plus config instead of porting:

> The reason for the pattern rather than a port is already in this repo once.
> `tools/charts/chart.mjs` started as causl's `chart.ts` and is no longer one, so
> the two cannot be reconciled and a fix to either does not reach the other.

There are now **four** divergent descendants, not two:

| Where | What it is | State |
| --- | --- | --- |
| `causl-bench packages/bench/src/chart.ts` | the original | deleted at `d20ecca` |
| `libviprs-bench tools/charts/chart.mjs` | the hand port | live, the only consumer |
| `causl-org pages/benchmarks/dashboard.js` | in-browser DOM chart, pan and zoom | frozen byte-for-byte inside libviprs-bench |
| `libviprs-org benchmarks/tools/render-latest.mjs` | line chart with era rules and spread bands | live |

And the published causl charts under `causl-org pages/benchmarks/v0.9.0/charts/`
carry a fourth palette again (`#f59e0b #ef4444 #7c3aed #2563eb`), plus 18
zero-height bars labelled `0ms` for cells that were never measured. libviprs
fixed that absent-cell bug in `chart.mjs`; the fix never reached causl. That is
the divergence, live on the site.

## 1. Decisions

Each decision names the alternative it rejected. Where the panel split, the split
is recorded rather than smoothed over.

### D1. No configurable field names. Each family has one fixed record shape.

Renderers read `series`, `value`, and the family's own axis field. There is no
`seriesKey`, no `xKey`, no accessor functions.

The current design made the series field a parameter and left `value`, `config`,
`error`, `runIndex`, `version` hard coded. Half-configurable is the worst of both:
it tells a caller the renderer adapts to their shape, then draws a complete,
well-formed, mark-free chart when it cannot read the field. That failure is the
single worst outcome available, because it looks finished.

The adapter already builds every record by hand, so a fixed shape costs it one
`.map()` it was writing anyway, and it makes every record checkable: a renderer
can verify `row.series` is a string, and it cannot verify that an arbitrary
accessor is the right one.

This also matches what the codebase already concluded twice.
`libviprs-bench/tools/contract/config.schema.json` keeps field pointers
(`seriesFrom`, `rowIdentityFrom`, `scenarioFrom`) on the producer side and says
why: *"a rename is a display decision and identity must not move when a label
does"*. `libviprs-org/benchmarks/tools/render-latest.mjs` says `normalise()` is
the only function that knows the importer's field names.

*Rejected:* configurable pointers on every field (moves the adapter into an
options object and keeps the unreadable-field failure), and accessor functions
(not checkable, not serialisable, opaque in errors).

### D2. Renderers throw. They never return a mark-free or placeholder chart.

Unreadable input, an unknown option, a duplicate cell and an empty record array
all throw `BenchartsError` with a stable `code` and the offending index and field
in `details`.

Output goes straight to a file, usually by a script that then publishes it. A
placeholder makes that script succeed, writes a plausible artefact, and buries the
real signal inside an SVG nobody opens.

`renderPlaceholder()` is exported for a caller who has *decided* a chart is
legitimately absent and wants a tile in a fixed grid. That decision belongs to the
adapter, which knows whether "no rows" is expected; the library cannot tell that
from a broken producer.

*Rejected:* placeholder by default with an opt-out (the failure stays silent for
anyone who does not opt in), and returning `null` (forces a branch at every call
site and gives the caller no information to branch on).

### D3. Series identity resolves in two phases, so a stale argument is impossible.

```js
const set = defineSeries([{ key: 'pmtiles', label: 'PMTiles', color: '#34a853' }]);
const resolved = set.resolve(records.map(r => r.series));  // once, per chart
resolved.colorOf('pmtiles');                               // no second argument exists
```

The old `colorFor(key, ordered)` handed a computed value out and asked for it
back. Passing a stale, foreign or wrong array silently returned a different
colour. The current test suite misuses it in two places
(`series-theme.test.mjs:60` and `:109`, passing `order` where `ordered(points)` is
meant) and passes anyway. When a test suite misuses a parameter and gets away with
it, the parameter should not exist.

`colorOf` on an unknown key **throws**. A silent fallback for an unknown key is
the same "different colour, no error" outcome wearing a different hat.

### D4. Every libviprs word leaves the library.

`ENGINES`, `ENGINE_THEME`, `ENGINE_ORDER`, `COLORS`, `ENGINE_LABELS` and the six
metric wrappers (`renderWallTimeBars` and friends) are gone. Their titles hard
code one project's vocabulary: "Tiles/s", "RSS-MB·s per Tile", "Engine-Tracked
Working Set". A library that knows what a tile is has failed at being extracted.

Two generic pieces survive as options, because they are benchmark vocabulary
rather than project vocabulary: `better: 'lower' | 'higher'` and
`errorLabel: '95% CI'`. They compose the old title text exactly, and `errorLabel`
renders only when a whisker was actually drawn, which a static title could never
manage.

### D5. Lookups are `Map`-backed.

`colors[key]` on a plain object returns something from `Object.prototype` for
`constructor`, `__proto__`, `toString` and `valueOf`. Today a series named
`constructor` puts a JavaScript function into a `fill=` attribute. Under D5 those
are ordinary strings.

*Rejected:* `Object.create(null)` dictionaries. They close the prototype read but
keep the "index a dictionary, get `undefined`, interpolate it" path open.

### D6. Colours are validated `#rrggbb` at construction.

This is a security fix, not a tidiness one. See §4.

### D7. The palette is replaced, and the engine draw order changes with it.

The current four engine colours **fail** colourblind validation. Measured, not
argued:

```
CURRENT   [FAIL] CVD separation  #ea4335 (MapReduce) ↔ #34a853 (Streaming)
                                 ΔE 4.1 deutan, 5.1 tritan
PROPOSED  [PASS] all six checks, light and dark
                                 worst adjacent ΔE 18.3
```

Those two sit adjacent in every bar group and cross each other in every sweep.
4.1 is below the 6.0 floor where secondary encoding stops being an acceptable
excuse, so no amount of direct labelling rescues the current pair.

The six fallback colours are worse: three read as gray, slate ↔ brown is ΔE 12.7
for *normal* vision, and teal ↔ slate is ΔE 0.7 under protanopia, which is to say
identical. With more series than colours they wrap modulo six, so series share
strokes outright.

Full palette and tokens in §5.

### D8. Scale helpers stay internal for 1.0. (split)

The API area wants `log10Scale`, `linearScale`, `enclosingDecades` and
`decadeTicks` unexported, on the grounds that exporting them freezes their
signatures for a future fourth family. The architecture area wants them on a
`/primitives` subpath so a fourth family can be built outside the package.

Internal wins for 1.0 because there is no second consumer asking, and a subpath
can be added later without breaking anything, whereas removing one cannot.

### D9. Fallback palette capacity: unresolved, pending a real number. (open)

The API area specified eight fallback colours, architecture twelve, design eight
validated hexes. All three were briefed with a claim that the storage family has
eleven series. **That claim was wrong**, and it was mine: I wrote "eleven
scenarios" into issue #104 and then into `chart.mjs:7`, `:99` and
`series-theme.test.mjs:7` at commit `013e72a`, then restated it to the panel as
eleven *series*.

Measured from `archive/storage/20260915T071511Z-*.json`, 539 cells:

| Field | Distinct values |
| --- | --- |
| `backend` | **2** (`directory`, `pmtiles`) |
| `scenario` | 12 |
| `cell` | 6 |

Scenarios are the **group** axis, not the series axis. So storage needs two
colours, and the eleven-series capacity requirement has no evidence behind it. The
capacity ceiling must be re-derived from the `format` family (#102) once its
series list exists, or dropped.

What survives regardless: more series than colours **throws**
(`FALLBACK_PALETTE_EXHAUSTED`) rather than wrapping. Two series sharing a stroke
is a chart that lies.

### D10. Past the palette's capacity, facet. Never invent a hue, never fold into "Other".

Benchmarks cannot be aggregated across series (you cannot sum wall times of
different backends), so folding is a fiction. The honest form is small multiples:
one panel per series in the accent hue, every other series as context in
de-emphasis gray, shared y domain.

## 2. The public surface

Nine exported values, plus types.

```ts
export class BenchartsError extends Error {
  readonly name: 'BenchartsError';
  readonly code: BenchartsErrorCode;   // stable API
  readonly details: Readonly<Record<string, unknown>>;
}

export type BenchartsErrorCode =
  | 'INVALID_SERIES_DEFINITION' | 'INVALID_COLOR'
  | 'DUPLICATE_SERIES_KEY'      | 'DUPLICATE_SERIES_COLOR'
  | 'UNKNOWN_SERIES'            | 'FALLBACK_PALETTE_EXHAUSTED'
  | 'UNKNOWN_OPTION'            | 'INVALID_OPTION'
  | 'INVALID_INPUT'             | 'INVALID_RECORD'
  | 'DUPLICATE_RECORD'          | 'INCONSISTENT_STEP_LABEL'
  | 'EMPTY_INPUT'               | 'NO_PLOTTABLE_POINTS';

export function defineSeries(defs: readonly SeriesDef[], opts?): SeriesSet;
export const DEFAULT_FALLBACK_COLORS: readonly string[];

export function renderGroupedBars(rows: readonly BarRow[], opts?): string;
export function renderTrend(points: readonly TrendPoint[], opts?): string;
export function renderSweep(points: readonly SweepPoint[], opts?): string;
export function renderPlaceholder(opts: {width, height, message}): string;

export function formatNumber(n: number): string;
export function formatLogTick(n: number): string;
```

### Record shapes

```ts
interface BarRow    { group: string; series: string; value: number; error?: number }
interface TrendPoint{ step: number;  series: string; value: number; label?: string }
interface SweepPoint{ x: number;     series: string; value: number }
```

Required fields are read as own properties. Extra properties are ignored, so a
caller may pass richer objects, and a renderer reads nothing it was not given.

### Series identity

```ts
interface SeriesSet {
  readonly entries: ReadonlyArray<Readonly<Required<SeriesDef>>>;
  readonly keys: readonly string[];
  has(key: string): boolean;
  colorOf(key: string): string;      // throws UNKNOWN_SERIES
  labelOf(key: string): string;      // throws UNKNOWN_SERIES
  resolve(present: Iterable<string>): ResolvedSeries;
}

interface ResolvedSeries {
  readonly keys: readonly string[];     // declared order, then sorted undeclared
  readonly present: readonly string[];  // what the renderer actually draws
  isDeclared(key: string): boolean;
  colorOf(key: string): string;         // throws UNKNOWN_SERIES, never falls back
  labelOf(key: string): string;
}
```

Colours are a pure function of `ResolvedSeries.keys`, so two data sets with the
same undeclared keys always get the same colours. One documented limit: fallback
assignment is stable for a given set of undeclared series, not across charts with
different sets. If you want a series the same colour everywhere, declare it.

### Options

`CommonOptions`: `series`, `title`, `unit`, `better`, `width`, `height`.
`GroupedBarsOptions` adds `errorLabel`. `SweepOptions` adds `scale: 'log' |
'linear'`, `xLabel`, `yLabel`, `xMin`.

Unknown option names **throw**. An option typo changes the picture silently, and a
stale name from the old API (`theme`, `xKey`, `unitSuffix`, `logScale`) would
otherwise be accepted and do nothing.

## 3. Validation and refusal

One rule for the README: **BENCHarts throws on anything that is a programming or
pipeline error, and degrades only on the three things that are legitimate data
semantics the caller chose.** Nothing degrades silently.

### Throws at construction

`defs` not an array; an entry not an object; `key` missing, non-string or empty;
`label` not a string; `color` not `#rrggbb`; a duplicate `key`; a duplicate
`color`; a malformed or duplicated `fallbackColors` entry.

A fallback colour equal to a declared colour is not an error; `resolve()` skips
it. That keeps `DEFAULT_FALLBACK_COLORS` usable with any declared palette.

### Throws at render

Records not an array; an unknown option name; an option of the wrong type; a
`series` that `defineSeries` did not produce (brand check, not duck typing); any
record failing its shape; two records claiming the same cell, step or x for one
series; two trend points at one step disagreeing on `label`; zero records; records
that exist but none plottable.

Every record is checked, not just the first. The current shape probes in
`render.mjs` look only at record 0 (`render.mjs:321`, `:331`, `:346`), so a file
where record 57 lost its `engine` sails through.

### Degrades, by design, and documented

1. `value` is `NaN` or infinite: the caller measured and has nothing to show. Bars
   draw a zero-height slot labelled `n/a`; lines break and draw no marker.
2. A `(group, series)` cell with no row at all: the slot stays for alignment, no
   mark, muted `n/a`. "Not benchmarked" must never read as "0".
3. In log mode, a finite `value <= 0`: unplottable on that axis. Dropped from the
   line, drawn as a hollow marker on the axis floor, counted in the disclosure
   note.

The distinguishing question is "did the caller mean this?", and `NaN` is how they
say yes. **A missing measurement is `NaN`, never a missing field.** That one line
carries the whole policy.

## 4. Security requirements

The trust boundary is semi-trusted harness JSON in, SVG served on public websites
out. Both causl.org and libviprs.org publish these.

### Confirmed defects, each reproduced

**S1. Theme colours reach `fill=` raw, and that is script execution.** A colour of
`#000"/><script>…</script><rect fill="#000` produces a well-formed SVG containing
a live script element:

```
fill="#000"/><script>PWNED</script><rect fi
```

Driven through Chromium: harmless via `<img src>`, but it **executes on the site
origin when the `.svg` URL is navigated directly**, which anyone can do, and
GitHub Pages cannot add the headers that would stop it.

**S2. A finite number crashes the generator.** `enclosingDecades(1, 1.5e308)`
returns `[1, Infinity]` because `10 ** 309` overflows. `JSON.parse('1.5e308')` is
finite, so no finiteness check catches it. The render dies on heap exhaustion; I
reproduced it under a 512 MB cap. This runs in CI.

**S3. A control character makes the whole chart invalid XML.** `escapeXml` handles
`& < > "` only. A `version` of `v1\x01` emits the raw byte, which XML 1.0 forbids.
Via `<img>` the image is broken and the chart vanishes.

**S4. `width` and `height` are interpolated raw into `viewBox`**, so a string
option injects an attribute on the root element.

**S5. Grouped bars emit `groups × series` cells regardless of row count.** 2000
rows of 98 KB JSON produced a 320 MB SVG and 1.03 GB RSS; 4000 rows threw
`RangeError: Invalid string length` after 28.7 s.

**S6. `config|series` string keys collide.** Rows `{config:'a|b', series:'c'}` and
`{config:'a', series:'b|c'}` share a key and both bars drew the same value.

### Dead ends, stated plainly

All eight **text** interpolation points do go through `escapeXml`, tested with
`"/><script>`, `x" onload=`, `<!--`, `]]>`, pre-escaped entities and U+202E. No
harness string can break out of a text node. `'` is unescaped but there are zero
single-quoted attributes. Prototype *pollution* does not occur:
`Object.fromEntries` with a `__proto__` key defines an own property. Lone
surrogates are neutralised by UTF-8 encoding on write.

### Requirements

- **R-ESC-1.** Every `${}` in a renderer template is `escapeXml(...)`,
  `formatCoord(...)`, a numeric formatter, or a token that passed validation.
  Enforced by a source-scanning test, so a new raw interpolation fails the build.
- **R-ESC-2.** `escapeXml` covers `& < > " '`.
- **R-ESC-3.** No renderer emits anything that is not well-formed XML 1.0 for any
  input it accepts. Inputs that would (controls, U+FFFE, U+FFFF) are **refused**,
  never silently stripped.
- **R-VAL-1.** Every drawn string matches a label class excluding control,
  surrogate, unassigned, bidi-override and zero-width characters, 1 to 256 chars.
  Printable non-ASCII stays legal (titles use U+00B7 today).
- **R-VAL-2.** Colours match `^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$`, checked at
  construction.
- **R-VAL-3.** `width`, `height`, `xMin` are finite numbers, `0 < v <= 16384`.
  Strings are refused, never coerced.
- **R-VAL-4.** Numeric window: a point is plottable only if finite and
  `|v| <= 1e300`, and on a log axis also `>= 1e-300`. No value outside the window
  reaches `Math.log10`, `10 **` or a sum.
- **R-VAL-5.** Axis primitives are total: finite bounds and at most 601 decades for
  every finite input; a non-finite bound yields an empty tick set, never a loop.
- **R-VAL-6.** Caps, with the cap named in the refusal message. Provisional pending
  the performance spec and D9.
- **R-LOOK-1/2.** `Map`-backed colour and label lookups; nested
  `Map<group, Map<series, row>>` for cells, never a joined string key.

### Provenance

- **R-PROV-1. Allowed in a public SVG:** the version string, the series display
  label, the config label built from numeric dimensions, metric numbers and units,
  caller-supplied titles and axis labels. Nothing else.
- **R-PROV-2. Never:** hostnames, usernames, paths, IPs, `cpu_model`, `os`, `arch`,
  kernel strings, container or emulation flags, load averages, cgroup limits, git
  SHAs, timestamps, build profiles, `rustflags`, lockfile hashes, dependency
  versions, `measurement_path`, any registry or package host.
- **R-PROV-3.** Renderers read only the closed field set, so a record with extra
  properties renders byte-identically to one without.
- **R-PROV-4.** `scanForDisclosure(svg)` returns matches for hostname-like tokens,
  `/Users/`, `/home/`, `C:\`, IP literals, long hex runs, ISO-8601 timestamps and
  any internal host name. Every consumer runs it before publishing and fails on a
  non-empty result.
- **R-PROV-5.** A canary test, permanent, in each consumer.

**Good news, measured:** a canary stamped into all 407 string fields of real
report JSON produced **0 leaks across 18 SVGs**. `render.mjs`'s field selection is
correct today. It is also untested, and one careless title away from not being.

### Packaging

`files` allowlist (never `.npmignore`, which is a denylist that ships new file
types by default), `exports`, `type: module`, `sideEffects: false`, no
`dependencies` key, asserted by a test. The packed tarball contains no tests, no
fixtures, no `.npmrc`. A test asserts no tracked file matches a token shape.

## 5. Visual design

Every colour claim below is validator output, not judgement.

### Categorical palette, fixed order, same hex in both modes

| Slot | Hex | Family | Engine |
| --- | --- | --- | --- |
| 1 | `#ab47bc` | purple | libvips |
| 2 | `#34a853` | green | Streaming |
| 3 | `#2196f3` | blue | Monolithic |
| 4 | `#c62828` | red | MapReduce |
| 5 | `#7986cb` | indigo | |
| 6 | `#ad1457` | pink | |
| 7 | `#e65100` | orange | |
| 8 | `#0097a7` | cyan | |

The engine draw order changes from libvips, Monolithic, Streaming, MapReduce to
**libvips, Streaming, Monolithic, MapReduce**. Putting blue between green and red
is what lifts the failing pair from ΔE 4.1 to a pass. Every engine keeps its hue
family, so a reader of the published articles still finds libvips purple and
MapReduce red.

### Ink, grid, surfaces

| Role | Light | Dark |
| --- | --- | --- |
| Surface (painted by the SVG) | `#ffffff` | `#1a1a19` |
| Primary ink | `#1f1f1f` | `#f2f2f0` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted ink | `#898781` | `#898781` |
| Gridline | `#e3e2dd` | `#2c2c2a` |
| Baseline and axis | `#c3c2b7` | `#383835` |
| De-emphasis (facet context) | `#c3c2b7` | `#4a4a47` |

Text never wears a series colour. A swatch or line key beside it carries identity.

### Dark mode

The SVG paints its own surface and carries both token sets in a `<style>` block:
`:root`, then `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme="light"])`, then `:root[data-theme="dark"]`. Dark values are
independently validated, not an inversion.

This matters because the published charts are embedded as `<img>`, which cannot
inherit host CSS. The causl charts carry `fill="#444"` on 42 text nodes; on causl's
`--causl-void: #070A0F` that is **2.04:1**.

### Layout, with numbers

- **Legend.** Top-left under the title, wrapping within the plot width, row height
  18px, canvas grows by `rows × 18`. Pitch is **measured** from label width, not a
  constant. The current `i * 150` puts the sixth entry past the right edge: at
  eleven series I measured swatches at x = 1106 to 1556 in a 1042-wide viewBox.
- **Bars.** 20px wide (cap 24), 4px rounded at the data end, square at the
  baseline, 2px gap within a group, 32px between groups. A y-axis with 4 to 5 nice
  ticks, always from zero.
- **Trend.** y domain is the data's range padded 10%, **not** zero-based, with a
  subtitle saying so. The golden history renders three engines as flat lines at 85
  to 95 on a 0 to 141 scale, where a 5% regression is indistinguishable from noise.
  That is the one chart an engineer uses to decide whether a change made things
  slower.
- **Sweep.** y snaps to the enclosing 1-2-5 tick, not the enclosing decade, when
  the data spans less than a decade. `scalability_throughput_c4.svg` holds four
  lines between 2200 and 4500 on an axis stretched to 1000 to 10000, so real 2x
  differences read as a hair's width.
- **Labels.** Direct end labels on lines from two to four series, pushed 12px apart
  with a leader when they collide. Bars label every value up to 12 bars, then best
  and worst per group.
- **Font stack** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. The
  current `ui-sans-serif` alone is not understood by Firefox and falls through to
  a serif.

### Absent versus zero

A measured zero draws a 2px stub in the series colour plus a `0` label. An absent
cell draws no mark, keeps its slot, and shows a muted `n/a`. On a log axis a
non-positive value gets a hollow marker pinned to the axis floor and is counted in
the disclosure note. Today the zero and the absent cell look identical to anyone
who has not read the code.

## 6. Performance

All numbers measured on an Apple M5, Node v26.9.0, under real load from other
work (loadavg 3.8 to 5.1), so they are conservative rather than lab figures.

### What the real run costs

The checked-in report renders **18** charts plainly and **28** with `--zoom 20`.
Warm medians per chart: history 6 µs, grouped bars 27 to 60 µs, sweep 20 to 45 µs.
The whole 28-chart run is **0.83 ms** of render plus 0.14 ms of parsing, inside a
CLI whose wall clock is 80 ms, 70 ms of which is Node starting up. Output totals
239 KB raw, 43 KB gzipped. Peak RSS is 9.4 MB over bare Node.

Nothing here is slow. The budgets below exist to catch a class of bug, not to
chase microseconds.

### The three paths I suspected were all the wrong ones

Each is confirmed as written and irrelevant at any real size:

| Path | Real cost | Starts mattering at |
| --- | --- | --- |
| `colorFor` → `ordered.indexOf(key)` | 0%, the fallback branch has never executed on real data | 32 unthemed series in one chart |
| `ordered()` rebuilding a Set | 1.2% of the run, called **once** per render, not per series | ~10,000 records |
| `rows.some(...)` inside a `filter` | 0.2 to 0.8%, and 0.1% at 65,536 rows | never |

The actual hot path is **`fmtCoord`, at 55.4% of sampled self time**. Number
formatting *is* the render: a sweep chart formats roughly 600 numeric attributes,
and `Number.parseFloat(n.toFixed(5)).toString()` costs 83 ns a call.

### Coordinate precision

Dropping to 2 decimals saves **6.5% raw bytes and 8.1% gzipped** across the 28
charts. Rasterised at 1x, 2x and 4x and diffed, the change touches 0.35% of pixels,
almost all by 16/255 or less: one-pixel antialiasing along strokes, indistinguishable
side by side. The largest geometric shift is 0.005 user units, and the reason the
code gives for 5 decimals (equal pixel spacing between log decades) survives to
within 0.01 units.

**Correction to the measured recommendation.** The performance work proposed
`String(Math.round(n * 100) / 100)` as both faster (30 ns vs 83 ns) and
byte-identical to `toFixed(2)`. The speed holds. **The equivalence does not.** I
found divergences immediately:

```
x = 2.675     toFixed(2) -> 2.67     arithmetic -> 2.68
x = 1.115     toFixed(2) -> 1.11     arithmetic -> 1.12
x = 184.065   toFixed(2) -> 184.06   arithmetic -> 184.07
```

Three in 200,000 probes. `toFixed` rounds on the decimal expansion of the stored
double; `Math.round(n * 100)` rounds after a multiply that adds its own error, so
they disagree wherever the product lands near `.5`.

So BENCHarts **defines** its coordinate rule rather than inheriting one: round half
away from zero to two decimals via `Math.round(n * 100) / 100`. It is specified in
`docs/CONTRACT.md`, pinned by the goldens, and never described as equivalent to
`toFixed`.

### Budgets

Set where the measurements justify, with headroom for a slower x86 runner.

| Budget | Today | Projected | Limit |
| --- | --- | --- | --- |
| Per-chart render, warm | 6 to 60 µs | ≤ 90 µs | **≤ 200 µs** |
| 28-chart run, in-process | 1.15 ms | ≈ 1.5 ms | **≤ 5 ms** |
| 28 charts, fresh process | 3.5 to 4.3 ms | ≈ 5 ms | **≤ 15 ms** |
| Bytes per chart | 16,251 | ≈ 18,500 | **≤ 24,000** |
| Bytes per run | 239 KB | ≈ 275 KB | **≤ 320 KB raw, ≤ 60 KB gzip** |
| Bytes per record | 508 B | ≈ 600 B | **≤ 800 B** |
| Peak RSS over bare Node | +9.4 MB | +10 MB | **≤ +32 MB** |
| Test suite wall clock | 0.36 s | 0.5 s | **≤ 2 s** |

The per-record byte budget is the one that earns its place: it is deterministic and
catches a per-mark duplication (a legend emitted per bar) that a total budget on
small inputs would never notice.

No budget is set on `ordered()`, the present-filter or `colorFor`. A budget nothing
can trip is noise.

### What the design review costs

Measured by patching the additions in: per-mark `<title>` adds **14.1%** bytes and
24% render time; a y-axis with 5 or 6 majors adds ~0.9 KB per chart; direct end
labels ~100 B per series; the wrapping legend moves elements rather than adding
them. After taking back 6.5% from 2dp coordinates, the biggest chart lands near
18.5 KB, inside the 24 KB budget.

The per-record validation pass D1 requires costs **2 to 3 ns per record**, 0.13% of
an equal-size render at every size. Budget it as zero.

### The numeric window is a value check, not a finiteness check

`1.5e308` kills the process. The finite near-misses are the reason the guard cannot
just test `Number.isFinite`:

| Max y | Decades drawn | Render | Bytes |
| --- | --- | --- | --- |
| 1e6 | 7 | 0.06 ms | 13 KB |
| 1e100 | 101 | 0.30 ms | 92 KB |
| 1e300 | 301 | 0.86 ms | **263 KB** |
| 1.5e308 | ∞ | heap death | — |

A finite `1e300` draws a 263 KB axis in under a millisecond, and nothing in a timing
budget would catch it. Hence R-VAL-4's window.

### Keeping the budgets true without a flaky test

Deterministic assertions carry the weight, because output bytes are a pure function
of input: byte budgets on the goldens, linear byte growth, and helper-call counts
through a counting theme. None can flake.

The clocked assertions use a **min-of-samples** estimator, which matters more than
the metric. Tested under ten spinning CPU hogs on a 10-core machine:

| Estimator | Ambient | Under 2x oversubscription | Verdict |
| --- | --- | --- | --- |
| Wall median, 1024 vs 32 rows | 31 to 33 | 22 to 45 | cannot detect the bug it exists for |
| Wall median, 4096 vs 32 | 124 to 133 | 112 to **256** | grazes the threshold, flaky |
| **Min of 15 interleaved** | ≈132 | **132 to 145** | ±5% under load, detects the injected regression |

Min-of-N picks the sample that ran uncontended, which exists in any 15-sample window
even at 2x oversubscription; both sides of a ratio are sampled interleaved so a load
burst hits both. Total cost 0.26 s.

## 7. Repo layout

```
BENCHarts/
  package.json          bencharts, ESM, no dependencies key, files allowlist
  README.md             what it draws, the record contract, the validation rule
  CHANGELOG.md
  docs/
    SPEC.md             this file
    DECISIONS.md        D1..D10 with rejected alternatives
    CONTRACT.md         normative record shapes and refusal semantics
  src/
    index.js            the nine exports and nothing else
    error.js            BenchartsError + the code union
    format.js           formatNumber, formatLogTick, formatCoord, escapeXml
    scale.js            internal: log10Scale, linearScale, enclosingDecades, decadeTicks
    series.js           defineSeries, SeriesSet, ResolvedSeries
    validate.js         table-driven record and option checking
    palette.js          the eight slots and the ink tokens, frozen
    svg.js              surface, title, subtitle, axes, gridlines, legend, placeholder
    charts/
      grouped-bars.js
      trend.js
      sweep.js
  types/index.d.ts      hand written, shipped
  test/
    *.test.mjs          per module, plus golden/, determinism, security, packaging
    fixtures/           chart-input shaped, synthetic, never harness output
  golden/
    RENDERS.sha256
    svg/
```

## 8. Build order

Each phase is one reviewable change, tests written before the code. "Done" is the
stated proof, not an opinion.

| # | Phase | Done when |
| --- | --- | --- |
| P0 | Skeleton, manifest, `BenchartsError`, packaging tests | `npm pack --dry-run` lists exactly the allowlist; no `dependencies` key |
| P1 | `format.js`, `scale.js` (internal), the numeric window and total axis primitives | the ported formatting tests pass unchanged; `1.5e308` returns a chart in under 50 ms instead of exhausting the heap |
| P2 | `series.js`: `defineSeries`, `resolve` | every construction refusal has a test with the right code; `colorOf('constructor')` throws; ordering is byte-stable across input permutations |
| P3 | `palette.js` + a validator test | the six-check validator passes on `#ffffff`, `#1a1a19`, `#1a1a1a`, `#11182A`, `#070A0F` and the build fails on any FAIL |
| P4 | `validate.js` + `svg.js` chrome, measured wrapping legend | every legend text x plus its estimated width is inside the viewBox for 1 to 8 series with 14-character labels |
| P5 | `charts/grouped-bars.js` | absent cell has no label, measured zero labels `0`, whiskers, content-sized width, empty input throws, golden committed |
| P6 | `charts/trend.js` | gap breaking, a wholly absent step does not shatter, `INCONSISTENT_STEP_LABEL` fires, non-zero-based y domain, golden committed |
| P7 | `charts/sweep.js` | log-log decade spacing, 1-2-5 snapping, omitted note, `xMin` window, golden committed |
| P8 | Security suite | the source-scanning test fails on a deliberately added raw `${title}`; every reproduction in §4 throws |
| P9 | Types, README, `scanForDisclosure` | the two worked examples typecheck against `index.d.ts` and render parseable SVG |
| P10 | Dark mode tokens | a headless-browser screenshot of the auto file under dark emulation matches the fixed dark file |
| P11 | libviprs-bench adoption | its goldens differ only in title text and intended geometry, re-baselined knowingly in the PR |

P1, P2 and P3 are independent after P0. P5, P6 and P7 are independent after P4.

## 9. Open questions

### Blocking

**Q1. Hosting.** Two experts reached this independently from opposite directions.
`libviprs-bench/.github/workflows/contract.yml:13` states the runner cannot reach
private Gitea. libviprs-bench is public on GitHub and is **the only live
consumer**, since causl-bench deleted its chart code at `d20ecca` and causl-org
renders HTML tables. So a private Gitea package currently serves nobody who can
install it.

Three ways out: publish publicly with Gitea as canonical source; keep Gitea and
have libviprs-bench carry a frozen copy verified by a blob-sha manifest (the
`tools/contract` pattern already next door, which works offline but makes the
source public anyway); or keep Gitea private and drop libviprs-bench as a
consumer.

**Q2. Series capacity.** See D9. The eleven-series premise was wrong. The ceiling
needs a real number from the `format` family or it should be dropped.

**Q3. Surface ownership.** Do the sites accept the SVG painting its own
background, or must charts stay transparent and inherit? The second needs the host
to supply ink tokens, which an `<img>` cannot do.

**Q4. Republishing.** Is re-rendering the already-published causl and libviprs
charts on a passing palette in scope, or separate work? The current ones fail
colourblind validation and the causl set also shows 18 zero-height bars labelled
`0ms` for unmeasured cells.

### Later

- A hover layer (crosshair, tooltips) for sites that inline the SVG. Per-mark
  `<title>` is the static stand-in.
- A texture channel for print and forced-colours.
- Whether groups wrap or facet past 1280px.
- A structured return (`{ svg, omitted, present }`) so an adapter can log what was
  dropped without parsing the SVG.
- causl-org's public README links a private Gitea repo, which contradicts the rule
  about never linking them. Worth its own issue.
