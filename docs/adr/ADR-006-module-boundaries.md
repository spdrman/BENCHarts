# ADR-006: The import graph is a test, not a convention

## Status

Proposed. Formalises the layout in `SPEC.md` §7.

## Context

The repo exists because one file was copied and the copies drifted. Inside the
library, the same failure has a smaller form: a helper gets duplicated into a
chart family because importing the shared one felt awkward, and then the two
copies diverge. Escaping and coordinate formatting are the two most likely
candidates, and they are exactly the two where a divergence is a security bug
rather than an inconsistency.

The layout in §7 already implies the right structure. What it does not say is
what keeps it that way after the tenth change.

## Decision

Four import rules, each asserted by a test that reads the source:

1. `error.js` and `palette.js` import nothing. They are leaves.
2. Nothing imports `index.js`. It re-exports the nine exports and holds no logic.
3. No file under `charts/` imports another file under `charts/`.
4. `svg.js` imports no chart family. Chrome does not know what it frames.

Plus the one the spec already requires for a different reason, restated here
because it is the same kind of rule: every `${}` in a renderer template is
`escapeXml(...)`, `formatCoord(...)`, a numeric formatter, or a token that
passed validation, enforced by the same source scan (R-ESC-1).

The test walks `src/`, parses the import specifiers and fails with the offending
file and specifier named. It also fails on any cycle, which the four rules make
impossible but which a future module could reintroduce.

## Alternatives considered

- **Document the layout and rely on review.** It is what most repos do, and it
  works until the change that breaks it looks locally reasonable. This library's
  whole premise is that locally reasonable copies are how the original problem
  started. Rejected.
- **A lint plugin such as `import/no-restricted-paths`.** Equivalent enforcement
  and a dependency, a config format and a plugin version to keep current, for
  ten modules. Rejected, though it would be the right call at fifty.
- **Split the families into separate packages.** Real isolation, and it turns
  one release into four and a shared fix into four bumps. Rejected.

## Consequences

- Positive: a fix to escaping, formatting or the numeric window reaches all
  three families, because there is exactly one of each and nothing can shadow it.
- Positive: the graph stays acyclic and shallow, so a new family is a new file
  under `charts/` plus one line in `index.js`.
- Positive: the test names the violation, so the failure explains itself without
  a reviewer knowing the rule.
- Negative: a genuinely shared piece of chart logic has nowhere to go except
  `svg.js` or a new leaf module, and rule 3 will occasionally force that call
  earlier than it feels ready. That is the intended friction.
- Negative: the source scanner parses imports with a regex or a small parse
  step, and a scanner that is too clever becomes its own maintenance item. Keep
  it dumb and let it fail loudly on anything it cannot classify.
