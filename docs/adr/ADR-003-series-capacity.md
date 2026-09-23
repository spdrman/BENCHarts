# ADR-003: Capacity is a property of the palette, not a constant to derive

## Status

Proposed. Resolves SPEC §9 Q2 and closes D9.

## Context

D9 is open because the number underneath it was wrong. Three review areas were
briefed with a claim that the storage family has eleven series and each sized a
fallback palette against it: eight colours, twelve, eight validated hexes. The
claim came from me, it went into issue #104 and then into `chart.mjs:7`, `:99`
and `series-theme.test.mjs:7` at `013e72a`, and it was restated to the panel as
eleven *series* rather than eleven *scenarios*.

Measured from `archive/storage/20260915T071511Z-*.json`, 539 cells: `backend`
has **2** distinct values, `scenario` has 12, `cell` has 6. Scenarios are the
group axis. Storage needs two colours.

D9 then says the ceiling "must be re-derived from the `format` family once its
series list exists, or dropped". Both branches of that sentence treat capacity
as a global number the library has to know. I think that framing is the actual
mistake, and it is the reason a wrong number could propagate into three
specifications at once.

## Decision

The library has no capacity constant. Capacity is the length of the fallback
palette in play, and that palette is an argument.

- `DEFAULT_FALLBACK_COLORS` ships the eight validated slots from §5.
- `defineSeries(defs, { fallbackColors })` takes any validated array, so a
  caller who needs more supplies more.
- Exceeding whatever palette is in play throws `FALLBACK_PALETTE_EXHAUSTED`,
  naming the count it had and the count it needed. It never wraps, because two
  series sharing a stroke is a chart that lies.
- The refusal message points at faceting, per D10.

No number is waiting on the `format` family. When that family lands, it either
fits in eight or it passes its own palette, and either way nothing in the
library changes.

## Alternatives considered

- **Re-derive a ceiling from the `format` family**, as D9 suggests. It makes the
  library's capacity depend on one consumer's data, which is the coupling D4
  spent its whole argument removing. It also means the next family re-opens the
  question. Rejected.
- **Drop the ceiling and wrap modulo the palette**, which is what the code does
  today. Two series get the same stroke and the chart is silently wrong.
  Rejected outright.
- **Ship twelve fallback colours so the question stops coming up.** Every colour
  past the eighth is harder to separate under CVD, so this trades a loud refusal
  for a quiet accessibility failure at exactly the sizes where a reader needs
  help most. Rejected.

## Consequences

- Positive: the wrong number cannot propagate again, because no number is load
  bearing. The invariant is "colours outnumber series or we refuse".
- Positive: D9 closes now rather than waiting on a family that does not exist.
- Positive: a caller with nine series is not blocked. They pass nine validated
  colours and own the CVD result, or they facet.
- Negative: the library cannot promise a caller-supplied palette passes CVD
  validation. It validates the hex format at construction, not the separation.
  The eight we ship are validated; anything else is the caller's claim. The
  README has to say that in those words.

## Trade-offs

I am trading a single documented capacity number for an invariant that cannot
be wrong. It gives up the ability to say "BENCHarts supports N series" in one
line, and gains never having to correct that line.
