# ADR-005: Re-rendering the published charts is separate work, filed as bugs now

## Status

Proposed. Resolves SPEC §9 Q4.

## Context

Two defects are live on public sites right now:

- The engine palette fails colourblind validation. `#ea4335` (MapReduce) against
  `#34a853` (Streaming) is ΔE 4.1 deutan, below the 6.0 floor, and the pair sits
  adjacent in every bar group and crosses in every sweep. Direct labelling does
  not rescue a pair that close.
- The causl charts under `pages/benchmarks/v0.9.0/charts/` show 18 zero-height
  bars labelled `0ms` for cells that were never measured. libviprs fixed that
  same bug in `chart.mjs` and the fix never crossed over. A reader cannot tell
  "not benchmarked" from "instant", and the chart says the wrong one.

Q4 asks whether re-rendering those is in scope for BENCHarts 1.0. Folding them
in is tempting, because 1.0 produces exactly the renderer that draws them
correctly.

## Decision

Out of scope for 1.0, and filed as two bug reports immediately, against the
repositories that publish the charts rather than against this one.

Each report carries the four headings, expected, actual, proposed solution,
alternatives, and each gets its companion draft PR with red tests before any
fix. These are visual defects, so the evidence in the body is the rendered
artefact: the published SVG as served, plus a deuteranopia simulation for the
palette one and the 18 labelled cells for the other. A still chart has no
animation to record, so the image is what the GIF requirement is asking for.

Re-rendering then happens as the last step of each consumer's adoption, once
BENCHarts is the renderer, and the before and after appear side by side in that
PR.

## Alternatives considered

- **Fold republishing into 1.0.** It ties a library release to two site
  deployments, so 1.0 cannot ship until both sites are re-rendered and reviewed,
  and the palette diff arrives in the same PR as the library that produced it.
  A reviewer would be reading a new renderer and a re-baselined site at once.
  Rejected.
- **Leave it unfiled until 1.0 lands.** The defects stay live and untracked for
  the length of a twelve phase build. An accessibility failure on a public site
  is not a follow-up item. Rejected.
- **Hand patch the published SVGs.** Fastest, and it creates a fifth divergent
  artefact, edited by hand, that no renderer produces. Rejected for the reason
  this repo exists.

## Consequences

- Positive: 1.0 stays a library release with a library's definition of done.
- Positive: the live defects get tracked today, with reproductions, instead of
  waiting on a build.
- Positive: each site re-baselines in its own PR, where the diff is reviewable
  as a visual change rather than buried in a renderer.
- Negative: the wrong charts stay up until the consumers adopt. The bug reports
  make that a visible, dated decision rather than an oversight.
- Negative: two more open issues before P0 begins.
