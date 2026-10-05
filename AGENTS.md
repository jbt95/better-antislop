# AGENTS.md

Working notes for coding agents in this repository. Read this before you edit
anything.

## What this repository is

The npm package is `oxlint-plugin-better-antislop`. It publishes **one** oxlint JS
plugin, named `better-antislop`, from a single entry point. Its `exports` map
points straight at the TypeScript source: `.` resolves to `./src/index.ts`.

Every rule key is `better-antislop/<rule>`. There is no second plugin and no
second prefix; `better-antislop-metrics/…` no longer exists and must not come
back.

The plugin carries two kinds of rule:

| Kind           | Count | Source                                             | Maintained by    |
| -------------- | ----: | -------------------------------------------------- | ---------------- |
| Metric rules   |     3 | `src/rules/`, on the engine in `src/engine/`       | this repository  |
| Vendored rules |    23 | `vendor/anti-slop/`, re-exported in `src/index.ts` | upstream, pinned |

`src/index.ts` assembles both kinds into the one plugin: the three metric rules
are imported from `./rules/index.ts`, and the 18 general plus 5 Effect vendored
rules are imported from `../vendor/anti-slop/src/index.ts` and
`../vendor/anti-slop/src/effect/index.ts`. Only the upstream `rules` maps are
read; the upstream plugin names `anti-slop` and `anti-slop-effect` are not
reused.

`src/engine/` is the shared metric engine. Its public interface is
`src/engine/types.ts` and `src/engine/contract.ts`. Treat those two files as
fixed: everything else adapts to them.

## `vendor/` is third-party source

`vendor/anti-slop/` is a copy of [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)
at a pinned revision. It is not a fork this repository maintains.

**Do not edit anything under `vendor/`.** It is ignored by oxlint and by oxfmt,
because this repository's own house rules reject patterns upstream's source
uses — chained assertions in two shared modules, runtime `typeof` narrowing —
and because reformatting the copy would turn every sync into a diff.

It **is** typechecked, and that is deliberate. `vendor/` is not in
`tsconfig.json`'s `include`, but `src/index.ts` imports it, and TypeScript
compiles an imported file whatever `include` says. So the vendored tree is held
to this repository's compiler options without being linted or formatted — the
reason the two recorded patches exist, and the reason a third one must be
recorded rather than written quietly.

There are exactly two ways to change vendored code:

1. **Fix it upstream**, then re-sync (§ Upgrading the vendored copy).
2. **Apply a patch recorded in `vendor/anti-slop/UPSTREAM.md`**, with the reason
   and the exact file and line. Two already exist and both are type-level only,
   forced by this repository's stricter `tsconfig.json`:
   `src/rules/no-runtime-typeof.ts` (index-signature property access) and
   `src/shared/dictionary-types.ts` (`noUncheckedIndexedAccess` on an indexed
   access after an `every()` guard). Any further patch needs the same entry, or
   the next sync silently deletes it.

`bun run vendor:sync --check` fails when the vendored tree no longer matches the
pinned upstream revision plus the recorded patches. That is the check that keeps
an accidental edit in `vendor/` from surviving.

## The metric specification

`docs/metrics.md` is the normative specification of the metric engine. It owns
every number the engine emits for one function, and it is the contract for the
three metric rules and nothing else.

**The vendored rules have no specification here.** Their behaviour is upstream's,
their messages are upstream's, and their options are upstream's. Do not document
one in `docs/metrics.md`, and do not describe a vendored rule's semantics from
memory — read `vendor/anti-slop/README.md` or the rule's own source.

## Threshold policy

`oxlint.config.ts` turns on the three metric rules and five of the vendored
rules. The other eighteen vendored rules are enabled nowhere. Where a repo-local
limit differs from the shipped default, the site carries the reason. This table
is the index.

| Rule key                                    | Shipped default            | Here                      | Why                                                                                                                                                                            |
| ------------------------------------------- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `better-antislop/cognitive-complexity`      | `15`                       | `15`                      | Default kept. It sits in a gap, not a crowd: four findings here, with 14, 12 and 12 just below.                                                                                |
| `better-antislop/max-nesting-depth`         | `4`                        | `4`                       | Default kept. Nothing here reaches it.                                                                                                                                         |
| `better-antislop/min-maintainability-index` | `65`                       | `50`                      | Default miscalibrated for one function. Argued below.                                                                                                                          |
| `better-antislop/no-runtime-typeof`         | `allowInTypeGuards: false` | `allowInTypeGuards: true` | A type predicate is the remedy the rule's own message asks for, and this repository decodes untrusted config JSON at a boundary where the signature has to name the guarantee. |

Of the other four enabled vendored rules, `no-chained-type-assertions`,
`no-unknown-parameters` and `no-object-parameters` take no options at all, so
there is nothing repo-local to record. The fourth,
`require-safety-comment-for-type-assertion`, takes `{ markers }` and defaults to
`["SAFETY"]`; this repository enables it as plain `error`, so the shipped
default applies and the `SAFETY` prefix is the house convention enforced in
§ Hard rules.

**Why the maintainability index is 50 and not 65.** The published 65 comes from
module-level analysis, where it means "this module is hard to maintain". Against
one function it collapses into a length test. Every term in the formula is a
logarithm and the line term dominates, so 65 leaves room only for a very small
Halstead volume: a fifteen-line function barely clears it and a twenty-line one
cannot. Measured here, 65 named about two functions in five, including nine-line
arrow functions whose message, "shorten it and lower its operator and operand
count", asks for something no edit can deliver. Fifty leaves room for a function
with real branching and still names about one in ten, with the shortest named
function close to thirty lines, so it keeps saying what it is for.

Two rules follow from that split. A finding under a repo-local limit is a real
defect and is fixed in code, not by raising the number. A limit is only changed
when the metric stops discriminating, never because a finding is inconvenient,
and a change is measured against the whole distribution rather than against the
one function that tripped it.

**Why the eighteen shipped-off rules stay off.** They are third-party rules
under a third-party release schedule. A rule nothing here names cannot produce a
finding, so an upstream change to it cannot break this repository's lint run.
Turning one on is a decision to take upstream's future changes to it too.

## Upgrading the vendored copy

```sh
bun run vendor:sync            # re-fetch the pinned revision into vendor/anti-slop/
bun run vendor:sync --check    # drift check, non-zero exit on drift
bun run vendor:test            # upstream's own rule tests, under node --test
```

`scripts/vendor-sync.ts` does the work. It fetches the pinned revision as a
GitHub source tarball and unpacks it with `tar`, not through `git`, so `--check`
runs in a checkout with no remote and no credentials. It copies only the paths
in `VENDORED_PATHS` out of that revision — `.oxlintrc.json`, `LICENSE`,
`README.md`, `package.json` and `src` — so a sync can never hand this
repository a second lint config or a second lockfile. `UPSTREAM.md` is a local
record rather than revision content: it survives a re-vendor and `--check` does
not compare it.

To move the pin, change `REVISION` in the script and the revision recorded in
`vendor/anti-slop/UPSTREAM.md` together, run the sync, then read the resulting
diff against that record before committing it.

`vendor:test` must run under `node --test`, and it is not a stylistic
preference. Upstream's tests import `RuleTester` from `oxlint/plugins-dev`, and
under Bun that constructor throws `RuleTester is not supported on 32-bit or
big-endian systems, versions of NodeJS prior to v22.0.0, versions of Deno prior
to v2.0.0, or other runtimes` before a single assertion runs. All 24 files error
out, so a Bun run there is not a weaker check, it is no check. Under
`node --test` all 24 pass.

This repository's own harness in `test/support/rule-tester.ts` works around the
same restriction a different way, by handing each rule's cases to a
short-lived Node process.

A sync that changes a rule's name, option or message breaks anyone who enabled
it. Say so.

## Commands

Run from the repository root. These are the scripts in `package.json`:

```sh
bun run typecheck       # tsc --noEmit
bun run lint            # oxlint, reads oxlint.config.ts
bun run test            # bun test ./test/ — this repository's own rule and conformance tests
bun run conformance     # bun tools/conformance/index.ts
bun run vendor:test     # the vendored rules' own tests, under node --test
bun run format          # oxfmt, writes formatting, reads .oxfmtrc.json
bun run format:check    # oxfmt --check
bun run check           # the pre-commit gate
bun run vendor:sync     # re-vendor the pinned revision
```

The trailing slash in `bun test ./test/` is load-bearing. `bun test test` does
not scope, because `test` is a substring of the vendored test paths and the run
would pick those up too. `bun run check` chains typecheck, lint, test,
conformance, `vendor:test` and `format:check`; `vendor:test` is in the gate
because it is the only check that covers the 23 rules this repository does not
own.

`bun run check` is the single pre-commit gate. `bun run conformance` is the extra
step required after any change to metric scoring.

`oxlint.config.ts` is a TypeScript config file. oxlint loads it with Node's
type stripping, so it needs Node 22.18 or newer, or Bun. The package declares
`"type": "module"`, which keeps Node from reparsing the config as CommonJS.

## Hard rules

### 1. The metric engine is a pure function

`src/engine/` must stay pure. No Effect. No filesystem. No subprocess. No
clock, no randomness, no network. It takes an ESTree `Program` and returns
plain data.

This is not a style preference. The conformance suite and the rule tests call
the engine directly, and a hidden IO call makes those two unusable.

Effect belongs only at a real IO seam, and in this repository that means the
conformance suite's own boundaries: spawning the Node process that parses a
fixture, reading the corpus off disk, and reading and writing the expectation
file. Use `Data.TaggedError` for typed failures, `Effect.gen` for sequencing,
`Effect.tryPromise` and `Effect.runPromise` at the boundary.

### 2. Never edit `vendor/`

Covered above. It is third-party source. It is ignored by oxlint and oxfmt, it
is typechecked only because `src/index.ts` imports it, and it changes only
through `vendor:sync` or through a patch recorded in
`vendor/anti-slop/UPSTREAM.md`.

### 3. `context.options` is `null` when `createOnce` runs

oxlint binds rule options per file, after `createOnce` has returned. Read
`context.options` inside a visitor, never at `createOnce` time. Reading it
outside a visitor silently yields defaults, so the rule appears to ignore its
configuration.

### 4. Keep `oxlint` and `@oxlint/plugins` on the same exact version

The two packages are pinned to the same exact version, with no caret and no
tilde. The JS plugin API in `@oxlint/plugins` is versioned in lockstep with the
oxlint binary that loads it. A mismatch makes the host and the plugin disagree
about the AST shape or the rule contract.

### 5. Run the conformance suite after any change to scoring

Any edit to the metric engine, to a metric rule, or to the nesting, logical
sequence or Halstead model is a scoring change. Run:

```sh
bun run conformance
```

It analyses every fixture in `test/fixtures/metrics/` — every `.ts` and `.tsx`
file in that directory, which is the whole corpus — and compares every metric
against `expected.json`. It exits `0` when they all agree and non-zero on any
difference. Do not commit a scoring change that has not passed it.

The suite covers every metric `docs/metrics.md` defines, including nesting and
the maintainability index, so a passing run is evidence for all three metric
rules. It says nothing about the 23 vendored rules.

`--update` rewrites the expectations from the current output. It is how you
propose a metric change, not how you approve one: read the rewritten diff
against the section of `docs/metrics.md` that owns each number, and treat a
change as unverified until you have. Never run `--update` and commit in the same
step.

See `tools/conformance/README.md` for the expectation format and the corpus.

### 6. No type assertions

No `as`, no `as any`, no `as unknown as T`, anywhere outside `as const`. The
repository enforces this with vendored rules
(`no-chained-type-assertions`, `require-safety-comment-for-type-assertion`), so
a violation fails the repository's own lint run.

Narrow with a type guard, or parse untrusted input at its boundary. If a
library boundary truly forces an assertion, those rules require a
`SAFETY: <reason>` comment on the line above the statement.

The vendored source breaks this rule in three places: chained `as unknown as` in
`shared/lexical-type-parameters.ts` and `shared/type-alias-resolution.ts`, and
runtime `typeof` narrowing in `rules/no-runtime-typeof.ts`. That is expected, it
is why `vendor/**` is in `oxlint.config.ts`'s `ignorePatterns`, and it is not a
shape to copy into `src/`, which has no type assertion at all.

### 7. One traversal, one engine

Metric rules must never touch the AST. They call `analyzeProgram` from
`src/engine/contract.ts` and read the returned metrics. The nesting model, the
logical-sequence rules and the Halstead accounting exist in exactly one place
so they cannot drift between rules.

Scoring a function must never descend into a nested function. Inner arrow
decisions belong to the inner function.

### 8. Traverse with visitor keys

Inside a rule, walk the AST with `context.sourceCode.visitorKeys[node.type]`. A
visitor key value may be a single node or an array of nodes; handle both. Do
not walk `node.parent` chains.

### 9. The metric rules win a name collision

In `src/index.ts` the metric rules are spread last, so they win any name a
vendored rule also claims. Keep it that way. They are the only rules this
repository wrote, the only ones `docs/metrics.md` specifies, and the only ones
the conformance suite checks against a recorded corpus. A vendored rule is
third-party code that arrives with a sync; if one took a metric rule's name it
would replace a specified and verified rule with an unverified one, silently, in
an upgrade nobody was reviewing for that. Reordering the spreads is a policy
change, not a cleanup.

## Style

`.oxfmtrc.json` is authoritative: single quotes, semicolons, two-space indent,
`printWidth` 100, `trailingComma: "all"`, `arrowParens: "always"`, LF endings,
final newline. Match it exactly. Import specifiers carry the `.ts` extension.

`vendor/` is in that file's `ignorePatterns`. Do not remove it, and do not add a
`//` comment to the file to explain why: oxfmt reads `.oxfmtrc.json` as strict
JSON and only `.oxfmtrc.jsonc` accepts comments. The reason is recorded in
`vendor/anti-slop/UPSTREAM.md`, which is where this repository keeps its
provenance notes anyway.

`tsconfig.json` is strict, plus `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
`erasableSyntaxOnly` and `verbatimModuleSyntax`. There is no `any` and no type
assertion, so write a type guard when the compiler loses track. That strictness
is why the vendored tree carries two recorded patches; it is not a reason to
loosen the compiler options.

## Before you finish

Run `bun run check`. If you touched scoring, run `bun run conformance` as well.
If you touched `vendor/`, run `bun run vendor:sync --check` and
`bun run vendor:test`.
