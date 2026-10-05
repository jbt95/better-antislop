# AGENTS.md

Working notes for coding agents in this repository. Read this before you edit
anything.

## What this repository is

The npm package is `oxlint-plugin-better-antislop`. It publishes two oxlint JS
plugins. Its `exports` map points straight at the TypeScript source: `.` resolves
to `./src/index.ts` and `./opinionated` resolves to
`./src/opinionated/index.ts`.

| Plugin name               | Entry file                 | Purpose                                            |
| ------------------------- | -------------------------- | -------------------------------------------------- |
| `better-antislop-metrics` | `src/index.ts`             | Code-metric rules, specified in `docs/metrics.md`. |
| `better-antislop`         | `src/opinionated/index.ts` | Opinionated anti-slop rules.                       |

The repository lints itself with both plugins. `oxlint.config.ts` holds the
thresholds and turns every rule on, so a change to a rule can fail this
repository's own lint run.

`src/engine/` is the shared metric engine. Its public interface is
`src/engine/types.ts` and `src/engine/contract.ts`. Treat those two files as
fixed: everything else adapts to them.

## Threshold policy

`oxlint.config.ts` turns every rule on. No rule is switched off, and no rule is
narrowed to a file just to quiet it. Where a repo-local limit differs from the
shipped default, the site carries the reason. This table is the index.

| Rule key                                            | Shipped default                        | Here   | Why                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `better-antislop-metrics/cognitive-complexity`      | `15`                                   | `15`   | Default kept. It sits in a gap, not a crowd: four findings here, with 14, 12 and 12 just below.                                                                 |
| `better-antislop-metrics/max-nesting-depth`         | `4`                                    | `4`    | Default kept. Nothing here reaches it.                                                                                                                          |
| `better-antislop-metrics/min-maintainability-index` | `65`                                   | `50`   | Default miscalibrated for one function. Argued below.                                                                                                           |
| `better-antislop/no-runtime-typeof-narrowing`       | `allowInTypePredicateFunctions: false` | `true` | A type predicate is the remedy the rule's own message asks for, and this repository decodes untrusted config JSON through `isOptionRecord` and `isNumberValue`. |

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

## Commands

Run from the repository root. These are the scripts in `package.json`:

```sh
bun run typecheck       # tsc --noEmit
bun run lint            # oxlint, reads oxlint.config.ts
bun run format          # oxfmt, writes formatting, reads .oxfmtrc.json
bun run format:check    # oxfmt --check
bun run check           # typecheck + lint + format:check
bun run conformance     # bun tools/conformance/index.ts
bun test                # bun test
```

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

### 2. `context.options` is `null` when `createOnce` runs

oxlint binds rule options per file, after `createOnce` has returned. Read
`context.options` inside a visitor, never at `createOnce` time. Reading it
outside a visitor silently yields defaults, so the rule appears to ignore its
configuration.

### 3. Keep `oxlint` and `@oxlint/plugins` on the same exact version

The two packages are pinned to the same exact version, with no caret and no
tilde. The JS plugin API in `@oxlint/plugins` is versioned in lockstep with the
oxlint binary that loads it. A mismatch makes the host and the plugin disagree
about the AST shape or the rule contract.

### 4. Run the conformance suite after any change to scoring

Any edit to the metric engine, to a metric rule, or to the nesting, logical
sequence or Halstead model is a scoring change. Run:

```sh
bun run conformance
```

It analyses every fixture in `test/fixtures/metrics/` and compares every metric
against the expectation file. It exits `0` when they all agree and non-zero on
any difference. Do not commit a scoring change that has not passed it.

The suite covers every metric `docs/metrics.md` defines, including nesting and
the maintainability index, so a passing run is evidence for all three rules.

`--update` rewrites the expectations from the current output. It is how you
propose a metric change, not how you approve one: read the rewritten diff
against the section of `docs/metrics.md` that owns each number, and treat a
change as unverified until you have. Never run `--update` and commit in the same
step.

See `tools/conformance/README.md` for the expectation format and the corpus.

### 5. No type assertions

No `as`, no `as any`, no `as unknown as T`, anywhere outside `as const`. The
repository enforces this with its own opinionated rules
(`no-chained-type-assertions`, `require-safety-comment-for-type-assertion`), so
a violation fails the repository's own lint run.

Narrow with a type guard, or parse untrusted input at its boundary. If a
library boundary truly forces an assertion, the opinionated rules require a
`SAFETY: <reason>` comment on the line above the statement.

### 6. One traversal, one engine

Rules must never touch the AST. They call `analyzeProgram` from
`src/engine/contract.ts` and read the returned metrics. The nesting model, the
logical-sequence rules and the Halstead accounting exist in exactly one place
so they cannot drift between rules.

Scoring a function must never descend into a nested function. Inner arrow
decisions belong to the inner function.

### 7. Traverse with visitor keys

Inside a rule, walk the AST with `context.sourceCode.visitorKeys[node.type]`. A
visitor key value may be a single node or an array of nodes; handle both. Do
not walk `node.parent` chains.

## Style

`.oxfmtrc.json` is authoritative: single quotes, semicolons, two-space indent,
`printWidth` 100, `trailingComma: "all"`, `arrowParens: "always"`, LF endings,
final newline. Match it exactly. Import specifiers carry the `.ts` extension.

`tsconfig.json` is strict, plus `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
`erasableSyntaxOnly` and `verbatimModuleSyntax`. There is no `any` and no type
assertion, so write a type guard when the compiler loses track.

## Before you finish

Run `bun run check` (typecheck, lint and format check) and `bun test`. If you
touched scoring, also run `bun run conformance`.
