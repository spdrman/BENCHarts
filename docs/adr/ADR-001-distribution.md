# ADR-001: Publish @causl/bencharts publicly, keep Gitea canonical

## Status

**Superseded by [ADR-007](ADR-007-public-home.md)** on where the source lives.

Its actual decision, publish publicly rather than vendor or stay private, stands
and is what made ADR-007 straightforward. What ADR-007 replaces is the delivery
mechanism underneath it: the Gitea canonical remote, the `causljs` mirror and the
`@causl` scope are gone, and the repo is public under `spdrman` from the start.
The reasoning below is kept because the alternatives it rejects, vendoring and
dropping the consumer, are still rejected for the same reasons.

## Context

BENCHarts lives on a private Gitea. Its only live consumer, `libviprs-bench`,
is public on GitHub and its CI runner cannot reach that Gitea. The workflow
says so itself, at `contract.yml:13`: *"the causl repositories are private Gitea
and this runner cannot reach them"*. causl-bench deleted its chart code at
`d20ecca` and causl-org renders HTML tables, so there is no second consumer
waiting. A private package currently serves nobody who can install it.

Three facts I measured changed how this reads:

- The consumer is public, so **any** route that gets code to it makes the source
  public. Vendoring a frozen copy into a public repo publishes the source just
  as thoroughly as npm does. Privacy is not one of the options, whatever we pick.
- The `@causl` scope on public npm is ours, maintained by `spdrman`, with nine
  packages already on it. `@causl/bencharts` is free.
- `@causl/core` already ships this exact way: private development, a public
  mirror at `causljs/causl-ts`, a public npm artifact, with seven sibling repos
  in the same org staying private.

So the question is not whether to go public. It is which public mechanism, and
whether to invent one when the org already operates the answer.

## Decision

Publish `@causl/bencharts` to the public npm registry. Keep
the private Gitea repo as the canonical development remote. Mirror the
source to a public `causljs/bencharts` on GitHub, which carries issues and the
release workflow. Tags drive the mirror and the publish.

`libviprs-bench` gains a `package.json` and a lockfile and installs the package
normally.

## Alternatives considered

- **Frozen vendoring with a blob-sha manifest**, the `tools/contract` pattern
  already running next door. It works offline, needs no registry and no auth,
  and it is proven in this exact repo pair: `sync-contract.sh` refuses rather
  than passing quietly when it cannot check. Rejected as the primary channel
  because it publishes the source anyway, it costs one manifest bump per
  consumer per release, and it gives the library no version identity, no
  changelog and no way for a second consumer to pin a range. It stays the
  fallback if the registry is ever unreachable, and the machinery to revive it
  is already written.
- **Keep Gitea private and drop libviprs-bench as a consumer.** That leaves the
  library with zero consumers, which makes it the fifth divergent descendant
  rather than the cure for the other four. Rejected.
- **GitHub Packages instead of npmjs.** Needs a token even for public packages
  on install, which puts auth back into a pipeline that has none. Rejected.
- **Install straight from the git mirror.** Viable precisely because the library
  has no build step, so a git URL installs and runs. Rejected as the default for
  the same reason as vendoring: no version identity and no integrity guarantee,
  for no saving over a registry that is already ours.

## Consequences

- Positive: versioned, integrity-checked, installable by anyone who needs it,
  with the release path already operating for a sibling package. A second
  consumer costs a dependency line instead of a vendoring gate.
- Positive: the source lands somewhere a public issue can point at, which the
  current arrangement cannot do. causl-org's public README linking a private
  Gitea repo is the same problem one layer up.
- Negative: `libviprs-bench` grows its first `package.json`, lockfile and
  install step. That is new CI surface on a repo that deliberately had none.
  It also means an npm outage can red a benchmark publish, where today nothing
  can.
- Negative: publishing is close to irreversible. The unpublish window is 72
  hours, so a leaked string in a shipped tarball is public permanently. The
  packaging tests and `scanForDisclosure` carry more weight than they would on
  a private registry.
- Open, and worth deciding with eyes open: the scope is a causl word, and D4's
  whole argument is that a library which knows one project's vocabulary has
  failed at being extracted. By D4's own logic `@causl` cuts the same way, and
  libviprs pulling a `@causl` scoped dependency is visible coupling between two
  projects that otherwise share nothing. I would keep the name, reading the
  scope as the publisher rather than the domain, but renaming costs nothing
  today and a great deal after the first consumer pins it.

## Trade-offs

I am trading the offline guarantee and the zero-install-surface of vendoring
for version identity, integrity and a second consumer that costs a line. The
privacy argument does not enter, because it was never available: the consumer
is public, so the source is public either way. Choosing vendoring to feel
private would buy the appearance of it and none of the substance.
