# Architecture decision records

| # | Decision | Resolves |
| --- | --- | --- |
| [001](ADR-001-distribution.md) | Publish publicly rather than vendor or stay private | SPEC §9 Q1, superseded in part by 007 |
| [002](ADR-002-source-language.md) | JSDoc annotated JavaScript, declarations generated | revises SPEC §7 |
| [003](ADR-003-series-capacity.md) | Capacity is a property of the palette, not a constant | SPEC §9 Q2, D9 |
| [004](ADR-004-surface-and-theme.md) | The SVG paints its own surface, theme arrives per file | SPEC §9 Q3 |
| [005](ADR-005-republishing-scope.md) | Re-rendering published charts is separate work | SPEC §9 Q4 |
| [006](ADR-006-module-boundaries.md) | The import graph is a test, not a convention | SPEC §7 |
| [007](ADR-007-public-home.md) | `github.com/spdrman/BENCHarts`, public, published as `bencharts` | supersedes 001 |

D1 to D10 live in `docs/SPEC.md` §1 and are not re-opened here. The system level
view that these decisions sit inside is `docs/ARCHITECTURE.md`.
