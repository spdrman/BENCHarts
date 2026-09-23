# ADR-004: The SVG paints its own surface, and theme arrives per file

## Status

Proposed. Resolves SPEC §9 Q3. One premise needs a measurement at P10, noted below.

## Context

Both sites embed these charts with `<img>`. That is the whole constraint, and it
has a measured consequence already: the published causl charts carry
`fill="#444"` on 42 text nodes, which against causl's `--causl-void: #070A0F`
is **2.04:1**. Inheriting the host's ink is not a thing an `<img>` can do, so
the charts that tried it are unreadable on the site that serves them.

An `<img>` referenced SVG is a separate document. Host CSS does not cascade in,
and the host cannot hand it a token. What does reach it is the user agent's
colour scheme preference, so a `prefers-color-scheme` query inside the SVG
fires while a selector keyed on a host attribute never can.

That splits the spec's three tier style block in §5:

| Tier | Embedded with `<img>` | Inlined in the page |
| --- | --- | --- |
| `:root` light default | live | live |
| `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` | live, the guard is always true | live |
| `:root[data-theme="dark"]` | **inert**, nothing can set the attribute | live |

So a site with a manual light and dark toggle gets a chart that follows the
operating system instead of the toggle, and can therefore be a light card on a
dark page even though the SVG carries perfectly good dark tokens.

## Decision

The SVG paints its own surface, opaque, by default. It carries both token sets
and the `prefers-color-scheme` tier. `:root[data-theme="dark"]` stays in the
style block, documented as reaching only inlined charts.

Two options carry the rest:

- `surface: 'opaque' | 'transparent'`, default `'opaque'`. A caller who inlines
  the SVG and wants the page's background chooses `'transparent'` and takes
  responsibility for contrast.
- `theme: 'auto' | 'light' | 'dark'`, default `'auto'`. `'light'` and `'dark'`
  emit one fixed token set and no media query.

A host with a manual toggle renders both files and picks between them itself:

```html
<picture>
  <source srcset="chart-dark.svg" media="(prefers-color-scheme: dark)">
  <img src="chart-light.svg" alt="…">
</picture>
```

Theme is a file, not an attribute. Any host that needs its toggle respected
switches the `src`, which is the only mechanism that actually works across the
`<img>` boundary.

## Alternatives considered

- **Transparent, inherit the host.** It is what the current charts attempt and
  it measurably fails at 2.04:1. It cannot work through `<img>` at all.
  Rejected as the default, kept as an option for inlined use.
- **One file, `prefers-color-scheme` only, no fixed variants.** Simpler, and it
  is wrong on every site whose toggle disagrees with the OS. Rejected.
- **Ship only fixed light and dark files, no `auto`.** Predictable, and it makes
  the common case (a site with no toggle, embedding one file) worse for no gain.
  Rejected.
- **Let the caller inject ink tokens as options.** Re-opens every contrast and
  CVD guarantee the palette work established, since the library could no longer
  claim any of its measured numbers. Rejected.

## Consequences

- Positive: a chart is legible on both sites without either site changing, which
  is not true today.
- Positive: the contrast and CVD numbers in §5 stay true, because the library
  controls every colour it emits.
- Positive: `theme: 'light' | 'dark'` gives a host with a toggle a real answer
  rather than a caveat.
- Negative: a chart on a page of an unusual background looks like a card. That
  is the price of being readable through `<img>`, and `'transparent'` is there
  for anyone who would rather own it.
- Negative: a host wanting toggle-accurate charts renders and publishes two
  files per chart, so the 28 chart run becomes 56 outputs and the byte budget
  per run applies per theme.

## To verify at P10

I have reasoned that `prefers-color-scheme` inside an `<img>` referenced SVG
fires on the engines we publish to, and that a host attribute selector cannot.
The second is certain: it is a separate document with no attribute set. The
first I have not measured. P10 already screenshots the auto file under dark
emulation, so that phase proves or breaks this ADR. If it turns out an engine
we care about ignores the query in `<img>`, `auto` becomes a light-only file and
every host moves to the two-file form.
