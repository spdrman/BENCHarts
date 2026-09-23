# ADR-007: BENCHarts lives under spdrman on GitHub, public, published as `bencharts`

## Status

Accepted. Supersedes [ADR-001](ADR-001-distribution.md) on where the source
lives, and settles the naming question ADR-001 raised and could not close.

## Context

ADR-001 decided to publish publicly rather than vendor or stay private, and kept
the private Gitea as the canonical remote with a public mirror, because that is
the path `@causl/core` already runs. It flagged one thing it could not settle:
the scope is a causl word, and D4's whole argument is that a library carrying
one project's vocabulary has failed at being extracted. libviprs pulling a
`@causl` dependency is visible coupling between two projects that share nothing
else.

Taking the repo out of causl entirely removes the mirror, the second remote and
the credential problem in one move, and turns that caveat into an answer.

Four facts I measured before doing it:

- `bencharts` is free on public npm, and so were the two scoped alternatives.
- `spdrman/BENCHarts` did not exist.
- The internal git host's name appears **zero times** in the public `libviprs-bench` repo, so
  that hostname has been kept out of public repos deliberately. The two existing
  commits carried it, and were rewritten before the first public push rather
  than fixed forward, because a fix-forward leaves the string reachable in the
  public object store permanently.
- The `causl-ci` credential is read only and `git push` to the Gitea repo
  returns a bare 403. That stops mattering the moment GitHub is the only remote.

## Decision

`github.com/spdrman/BENCHarts`, public, is the canonical repo and the only
remote. No mirror, no dual push.

The package publishes as `bencharts`, unscoped.

R-PROV-4 drops the hardcoded internal hostname in favour of the general
hostname-like token rule, which already subsumes it and is a stronger check
besides: one literal in a public scanner both discloses the host and misses
every other one.

The Gitea repo is archived rather than deleted, as the record of where the spec
was drafted. That needs a credential this machine does not have, so it is an
action rather than a done thing.

## Alternatives considered

- **Keep Gitea canonical with a public mirror**, which is ADR-001 as written.
  Two remotes, a push credential that does not work, and a private source of
  truth that one machine can reach. The mirror existed to satisfy a privacy
  requirement the audit showed was never achievable, because the consumer is
  public. Rejected.
- **Move to the `causljs` org instead of a personal profile.** It keeps company
  with `causl-ts` and `causl-org` and inherits any org level settings. It also
  re-attaches the library to the vocabulary D4 spent its argument removing.
  Rejected, though if BENCHarts ever gains a second maintainer an org is the
  natural home, and a repo transfer preserves issues, stars and redirects.
- **Keep `@causl/bencharts` on a repo under spdrman.** The scope is ours either
  way, so it works. It publishes a package scoped to an org that does not own
  the source, which is the kind of small incoherence that costs somebody an hour
  two years from now. Rejected.
- **`@spdrman/bencharts`.** Matches the owner exactly, and ties the package name
  to a personal handle that a future transfer to an org would strand. Rejected.

## Consequences

- Positive: one remote, one credential, and R1 in `ARCHITECTURE.md` §6
  disappears rather than being mitigated.
- Positive: the install line is `npm i bencharts` and carries no project
  vocabulary at all, which is D4 applied to the package name.
- Positive: issues, releases and the publish all live somewhere a consumer can
  reach and file against, which the previous arrangement could not offer.
- Negative: the source is public from the first commit, so §4's reproductions
  are public while the defects they describe are still live. That is a knowing
  choice, taken on two grounds: the vulnerable code is already public in
  `libviprs-bench`, and the trigger needs control of a hardcoded theme colour or
  the harness JSON rather than anonymous input. The exposure window runs until
  P8 fixes them and P11 adopts, and it should be kept short for that reason.
- Negative: a personal profile has no org level branch protection or required
  checks to inherit, so those get set on the repo itself.
- Negative: the provenance section still names `causl-bench`, which is private.
  It names it without linking it, and the four-divergent-descendants argument
  does not survive removing it.

## Trade-offs

I am trading the appearance of a private canonical source, which the audit
showed was never real, for a single public home with one working credential and
a name that matches where it lives.
