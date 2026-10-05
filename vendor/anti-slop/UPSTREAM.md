# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), revision `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`.

Vendored on 2026-10-05 from the GitHub source tarball for that revision
(`https://codeload.github.com/dmmulroy/anti-slop/tar.gz/c44ef22…`). The
revision is pinned by object id in `REVISION` in `../../scripts/vendor-sync.ts`,
which is the only place the id is written.

Licence: MIT. `LICENSE` is upstream's own licence file, copied verbatim, and it
must stay: this repository redistributes upstream source, and the notice has to
travel with every copy, including the published package, which ships
`vendor/anti-slop/LICENSE` because `package.json` lists `vendor` in `files`.

## Why vendoring is necessary

Upstream's `package.json` sets `"private": true`, so `oxlint-plugin-anti-slop`
was never published to npm and cannot be installed as a dependency at any
version. Vendoring the source is the only way to use these rules. Upstream pins
`@oxlint/plugins` 1.78.0; this repository is on 1.87.0, and all 23 upstream rules
load and pass their own tests against it.

## What is vendored

`VENDORED_PATHS` in `../../scripts/vendor-sync.ts`, five entries, copied whole:

- `src/` — both plugins and every shared helper, including upstream's own
  `src/vendor/eslint-stylistic/` sub-vendor, whose `UPSTREAM.md` and `LICENSE`
  are upstream's records for that second-level vendoring and are kept as they
  are.
- `LICENSE`
- `package.json` — kept so the upstream dependency and script set stay legible
  next to the code. It is not this package's manifest; nothing reads it.
- `README.md` — upstream's own rule documentation, kept for reference.
- `.oxlintrc.json` — upstream's lint configuration. It is inert here, because
  `../../oxlint.config.ts` is what `oxlint` reads and it excludes `vendor/**`.

## What is deliberately not vendored

Everything else the revision carries is left behind, so a sync cannot give this
repository a second copy of its own concerns:

- `.github/` — upstream's CI workflows, which run against upstream's own pnpm
  setup and `scripts/check:*`.
- `skills/` — the Claude skill distribution, including
  `skills/install-anti-slop/assets/anti-slop/`, a second full copy of all 18
  core rules and 5 effect rules. Two copies of the same rule in one repository
  is two places to patch and two places for them to disagree.
- `scripts/` — `sync-skill-assets.mjs` only exists to keep that second copy in
  step with `src/`. With `skills/` absent there is nothing for it to do.
- `pnpm-lock.yaml` — this repository resolves with `bun.lock`. Two lockfiles in
  one tree is one more thing to keep honest, and the vendored `package.json`
  pins versions that this repository does not use.
- `AGENTS.md` — instructions for agents working on upstream itself. They do not
  describe this repository and would misdirect anyone who read them.
- `tsconfig.json` — upstream's own compiler options, which are looser than
  `../../tsconfig.json` on exactly the two flags below. The root `tsconfig.json`
  does not list `vendor` in `include`, but TypeScript follows the import from
  `src/index.ts` into it, so vendored files are compiled with the root options.
- `.gitignore` — describes upstream's working tree, which is not reproduced here.

`vendor` is in `.oxfmtrc.json` `ignorePatterns` and `vendor/**` is in
`oxlint.config.ts` `ignorePatterns`, because both tools would otherwise rewrite
third-party source. Reformatting it would make every upstream sync produce a
spurious diff and would break `vendor-sync --check`, which compares bytes.

## Local patches

Two files differ from the revision. Both edits are type-level only: each one
leaves the emitted runtime identical to upstream's, and each one exists because
this repository compiles with a flag upstream does not set. They are applied by
`PATCHES` in `../../scripts/vendor-sync.ts`, re-applied after every copy, and a
revision bump that invalidates either one fails the sync instead of silently
drifting.

1. `src/rules/no-runtime-typeof.ts`, line 66 —
   `option.allowInTypeGuards` becomes `option["allowInTypeGuards"]`, because
   `noPropertyAccessFromIndexSignature` rejects a dotted read of a property that
   comes from an index signature. The rule's option type is a schema record, so
   the property is reached through the index signature.

2. `src/shared/dictionary-types.ts`, lines 200-202 — the guard that proves an
   intersection has no nullable member is made explicit, and the first member is
   bound before it is returned, because `noUncheckedIndexedAccess` will not let
   `Array.prototype.every` narrow the array for a later indexed read. The
   preceding guard still proves the element is neither `null` nor `undefined`,
   so `first ?? null` returns what upstream returns; a non-null assertion would
   assert less than the guard already establishes.

Nothing else in `src/` is edited. Upstream's own code violates three rules this
repository enforces on itself (chained `as unknown as` in
`src/shared/lexical-type-parameters.ts` and `src/shared/type-alias-resolution.ts`,
runtime `typeof` narrowing in `src/rules/no-runtime-typeof.ts`), which is why the
lint exclusion above is scoped to the directory rather than fixed in place.

## Updating and verification

`bun run vendor:sync` re-fetches the pinned revision, replaces `vendor/anti-slop`
with the allowlist above, and re-applies the two patches. `bun run vendor:sync
--check` does the same fetch and writes nothing at all: it compares every
allowlisted file byte for byte and reports any top-level entry that is neither
allowlisted nor this `UPSTREAM.md`, so an upstream file arriving by accident is
a drift too. Both fetch through the GitHub tarball rather than `git`, so the
check runs in a checkout with no remote and no credentials.

`bun run vendor:test` runs upstream's own 24 test files with `node --test`, and
`check` runs it, because an `@oxlint/plugins` upgrade is exactly when those rules
can stop behaving and the vendored copy is the only thing that can notice.

The runner is Node and not Bun on purpose. Upstream's tests import `RuleTester`
from `oxlint/plugins-dev`, and that class refuses to run under Bun outright: it
throws `RuleTester is not supported on 32-bit or big-endian systems, versions of
NodeJS prior to v22.0.0, versions of Deno prior to v2.0.0, or other runtimes`
before a single assertion is evaluated, so under Bun all 24 files error out
rather than report a result. Under `node --test` on Node v26.9.0 all 24 pass
against `@oxlint/plugins` 1.87.0.

This repository's own suite runs separately, under Bun: `bun test ./test/`. The
directory path is load-bearing. `bun test test` does not scope the run, because
`test` is a substring of the vendored paths, so the filter still matches
upstream's files and the two runners absorb each other's cases.
