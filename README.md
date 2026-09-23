# BENCHarts

Benchmark results as SVG. A library of pure functions: records in, a
deterministic string out. No DOM, no canvas, no async, no runtime dependencies.

**Status: specified, not built.** `docs/SPEC.md` and `docs/ARCHITECTURE.md` are
the whole repo. There is no `src/` yet and nothing is published to npm. If you
found this looking for a charting library you can install, it is not one yet.

## What it will draw

- **Grouped bars**, one column group per benchmark config, one bar per series,
  optional error whiskers
- **Trend**, a timeline of released versions, one polyline per series, with gaps
  where a series is missing from a snapshot
- **Sweep**, a log-log or linear scan of one independent variable against one
  metric

## The one rule worth knowing before you read further

It throws on anything that is a programming or pipeline error, and degrades only
on the three things that are legitimate data semantics the caller chose. Nothing
degrades silently, and nothing ever returns a well-formed chart with no marks in
it, because output goes straight to a file that a script then publishes. A
placeholder makes that script succeed and buries the real signal in an SVG
nobody opens.

A missing measurement is `NaN`, never a missing field. That one line carries the
whole policy.

## Documents

| File | What it holds |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | The design: decisions D1 to D10, the public surface, refusal semantics, security requirements, the palette, the performance budgets, and the build order |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Requirements, the context and module graphs, risks, and what has to happen before the first phase |
| [`docs/adr/`](docs/adr/) | Seven decision records, each naming the alternative it rejected |

## Where it came from

The code began as a chart renderer inside one benchmark harness, was ported by
hand into a second, and the two diverged until a fix to either could not reach
the other. There are four divergent descendants now. This repo exists so there
is one.

`docs/SPEC.md` §4 documents six reproduced defects in those descendants. They
are real and they are not fixed yet. The requirements in that section are what
the library has to do so they cannot recur.
