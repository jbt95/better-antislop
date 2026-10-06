# Provenance and licensing

This matters more than anything else on this page, so it is stated precisely.

**What is this repository's work.** Everything under `src/`: the metric engine
(`src/engine/`), the three metric rules (`src/rules/`), and the plugin entry
point (`src/index.ts`) that assembles all 26 rules into one plugin.

**What is third-party.** Everything under `vendor/anti-slop/`, including its
tests, its own `package.json` and its own `README.md`. That directory is a copy
of upstream source, not a fork maintained here.

|                       |                                                                   |
| --------------------- | ----------------------------------------------------------------- |
| Upstream project      | [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)     |
| Upstream package      | `oxlint-plugin-anti-slop` `0.1.2`                                 |
| Upstream licence      | MIT                                                               |
| Pinned revision       | `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`                        |
| Vendored at           | [`vendor/anti-slop/`](../vendor/anti-slop/)                       |
| Upstream licence file | [`vendor/anti-slop/LICENSE`](../vendor/anti-slop/LICENSE)         |
| Provenance record     | [`vendor/anti-slop/UPSTREAM.md`](../vendor/anti-slop/UPSTREAM.md) |

**Why the source is copied rather than installed.** Upstream marks its own
`package.json` `"private": true`. There is no published npm package for it, so
there is nothing to depend on and no version range to track. Vendoring at a
pinned revision is the only way to ship these rules, and it is also what makes
the provenance exact: the rules you get are the rules at one commit.

`vendor/anti-slop/UPSTREAM.md` is the authoritative record. It names the URL, the
revision, the licence, what was and was not vendored, and every local change made
to the copied source.

**The only local changes.** Two type-level patches, both forced by this
repository's stricter `tsconfig.json`, both with no effect on runtime behaviour:

- `src/rules/no-runtime-typeof.ts` — `option.allowInTypeGuards` is written as
  `option["allowInTypeGuards"]`, required by `noPropertyAccessFromIndexSignature`.
- `src/shared/dictionary-types.ts` — the `every()` guard is made explicit for
  the following indexed access, required by `noUncheckedIndexedAccess`.

Both are listed with their exact locations in `vendor/anti-slop/UPSTREAM.md`.
Beyond those two, the vendored tree is upstream's, byte for byte.

**Vendored code is not this repository's code, and is held at arm's length.**
`vendor/` is not a `tsconfig.json` root, and it is ignored by oxlint and oxfmt,
so this repository's house rules never fire on it and its formatter never
rewrites it. Reformatting the copy would turn every sync into a diff, and the
house rules reject patterns upstream's source uses on purpose — chained
assertions in two shared modules, runtime `typeof` narrowing.

It **is** typechecked, and deliberately so: `src/index.ts` imports the vendored
trees, so TypeScript compiles them under this repository's stricter compiler
options even though they are not listed in `include`. That is the whole reason
the two patches above exist, and it is the one place where this repository's
standards reach upstream code. If you find a problem in a vendored rule, it is
fixed upstream first, then picked up by the next sync.

## Upgrading the vendored copy

```sh
bun run vendor:sync            # re-fetch the pinned revision into vendor/anti-slop/
bun run vendor:sync --check    # drift check: non-zero exit if vendor/ has been edited
```

`scripts/vendor-sync.ts` does the work. It fetches the pinned revision as a
GitHub source tarball, unpacks it with `tar`, and copies out only five paths:
`.oxlintrc.json`, `LICENSE`, `README.md`, `package.json` and `src`. Everything
else the revision carries — its own lint config, lockfile, CI workflows and
agent skills — is deliberately left behind, so a sync can never hand this
package a second configuration. `UPSTREAM.md` is a local record rather than
revision content: it survives a re-vendor, and `--check` does not compare it.

To move the pin, change `REVISION` in the script and the revision recorded in
`UPSTREAM.md` together, run `vendor:sync`, and read the resulting diff against
that record before committing it. `--check` is the guard: it fails when the
vendored tree no longer matches the pinned upstream revision plus the two
recorded patches, which is what catches an edit made directly in `vendor/`.

The vendored rules carry upstream's own test files, and they must run under
`node --test`, not Bun. Upstream's tests import `RuleTester` from
`oxlint/plugins-dev`, which under Bun throws `RuleTester is not supported on
32-bit or big-endian systems, versions of NodeJS prior to v22.0.0, versions of
Deno prior to v2.0.0, or other runtimes` before any assertion runs. Every one of
the 24 files errors out instead of reporting a result, so a green Bun run there
would mean nothing. Under `node --test` all 24 pass.

```sh
bun run vendor:test
```

A sync that changes a rule's name, option or message is a breaking change for
anyone who enabled it. Check the diff, then say so in the release.

## What "off by default" buys you

Twenty-three of the twenty-six rules are not this repository's work. They are
maintained upstream, on upstream's schedule, and they arrive here when someone
runs `vendor:sync` — not when you ask.

The eighteen rules enabled nowhere are the ones that cannot surprise you. A
change to a rule your config does not name changes nothing about your lint run:
it does not add a finding, does not change a message, and cannot fail your build
on a decision you never made. The pin and the provenance record tell you exactly
which code you got, and `--check` tells you whether it has drifted.

Turning one on is a decision against a specific pinned revision. When you take
the next sync, you inherit upstream's changes to it, which is the trade you make
for not writing and maintaining the rule yourself. Three rules — the metric ones
— carry no such dependency. Their specification is
[`metrics.md`](metrics.md), their numbers are checked by a conformance
suite, and they change only when this repository decides they should.

## License

MIT, [`LICENSE`](../LICENSE).

The vendored portion under `vendor/anti-slop/` is MIT as well, from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop). Its licence text is
kept verbatim at [`vendor/anti-slop/LICENSE`](../vendor/anti-slop/LICENSE), and
[`vendor/anti-slop/UPSTREAM.md`](../vendor/anti-slop/UPSTREAM.md) records the pinned
revision it came from.
