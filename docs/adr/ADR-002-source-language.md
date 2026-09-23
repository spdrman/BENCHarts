# ADR-002: JSDoc annotated JavaScript, with the declarations generated

## Status

Proposed. Revises `SPEC.md` §7, which lists `types/index.d.ts` as hand written.

## Context

The library is pure ESM JavaScript with no runtime dependencies and no build
step, which is a real asset: the consumer runs plain Node with no package
manager at all today, and a library that needs compiling before it runs would
not have fit there.

The spec ships types as a hand written `types/index.d.ts`. That file has to
describe a fourteen member error code union, a `SeriesSet` whose `resolve()`
returns a different interface, three record shapes and three option bags that
refuse unknown keys. Nothing checks it against the implementation. It is a
second document making the same claims as the first, maintained by attention.

Which matters more than usual here, because the seam this library exists to fix
is exactly a seam where two copies of the same idea drifted apart. Shipping a
type surface that can drift from its implementation reproduces the original
failure at a smaller scale.

TypeScript source would fix the drift and cost the build step.

## Decision

Keep the source as `.js` ESM. Annotate it with JSDoc, turn on `checkJs` and
`strict`, and generate `types/index.d.ts` with
`tsc --emitDeclarationOnly --allowJs`. Ship the generated file. TypeScript is a
dev dependency only, so the `dependencies` key stays absent and the packaging
test in P0 is unchanged.

Types the JSDoc cannot express comfortably, the branded `SeriesSet` among them,
live in a small hand written `types/internal.d.ts` that the JSDoc imports. That
file is still checked, because `checkJs` reads it while checking the
implementation.

CI fails if the generated declarations differ from the committed ones, the same
way the goldens work.

Two details that follow from the spec rather than from TypeScript:

- The error code union is a frozen `const` object plus a derived literal union,
  never an enum. The codes are a stable API and a const object is what a
  consumer can actually read at runtime.
- `SeriesSet`'s brand is a module private symbol checked at render time. The
  spec asks for a brand check rather than duck typing, and a compile-time
  branded type does not survive into a JavaScript caller. Both exist, and they
  are different mechanisms for different moments.

## Alternatives considered

- **Hand written declarations**, as specced. Zero tooling, and the drift is
  unbounded and invisible. The only thing keeping it honest would be review, on
  a file reviewers skim. Rejected.
- **TypeScript source compiled to `dist/`.** The strongest type story, and it
  buys a build step, a `prepare` script, a `dist/` that git-URL installs need
  and source maps to ship or not ship. For a library of ten small modules whose
  hard problems are all runtime refusal, the compiler earns less here than it
  costs. Rejected, though I would revisit it if a fourth family ever needs the
  scale helpers exported.
- **No types at all.** The consumer writes `.mjs` and would not notice. Rejected
  because the record shapes are the contract, and a contract you cannot check in
  an editor gets guessed at.

## Consequences

- Positive: the types are checked against the code that implements them, so the
  declaration cannot claim a signature the function does not have.
- Positive: no build step, no `dist/`, the published files are the files in
  `src/`, and a git URL install still works if the registry is ever unavailable.
- Positive: `checkJs` catches a class of bug the runtime validation cannot,
  such as a code string that is not in the union.
- Negative: JSDoc is more verbose than TypeScript syntax and conditional or
  mapped types get awkward. The internal declarations file absorbs that, at the
  cost of a second place to look.
- Negative: a dev dependency on TypeScript, and a generated file in the tree
  that CI has to keep honest.

## Trade-offs

I am trading TypeScript's authoring ergonomics for keeping the package a set of
files that run as they are. The drift risk, which is the part that actually
threatens this library, is closed either way.
