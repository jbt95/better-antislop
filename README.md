# better-antislop

One oxlint JS plugin. **26 rules**, in two groups:

| Group          | Count | Origin                                                                                                                                  |
| -------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------- |
| Metric rules   |     3 | Written and specified by this repository. Every value is fixed by [`docs/metrics.md`](docs/metrics.md).                                 |
| Vendored rules |    23 | Vendored as source from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) (MIT) at a pinned revision. 18 general, 5 Effect. |

The metric rules are the reason this package exists. The vendored rules are not
this repository's work: they are third-party code kept current by a pinned sync.
Read [Provenance and licensing](#provenance-and-licensing) before you rely on
them, and [What "off by default" buys you](#what-off-by-default-buys-you) before
you turn one on.

The metrics are not copied from another tool and they are not invented between
one edit and the next. [`docs/metrics.md`](docs/metrics.md) is the normative
specification of every value the engine emits for one function: where each
formula comes from, what counts as a decision, which tokens are operators, and
the exact worked examples that settle a disagreement. This README is the user
guide; that document is the contract for the three metric rules, and for nothing
else.

## Why the metric rules exist

oxlint already ships `eslint/complexity`, `eslint/max_depth`, `eslint/max_lines`,
`eslint/max_lines_per_function`, `eslint/max_params` and `eslint/max_statements`.
It has no cognitive-complexity rule. That gap is the whole point.

Cyclomatic complexity counts decision points. Cognitive complexity charges
`1 + current nesting` for each `if`, loop, `catch`, `switch` and ternary, so it
grows with indentation instead of with branches. Two functions with the same
cyclomatic complexity can need very different amounts of work to read. Cyclomatic
complexity cannot tell them apart. Cognitive complexity can.

The second reason is fidelity. Slop is not a taste, it is a measurable shape, and
a threshold is only as useful as the number behind it. So the numbers are
written down first and the code is held to them: the specification owns the
rules, a conformance suite holds the implementation to the specification, and a
finding can always be traced to the section that defines it. See
[`docs/metrics.md`](docs/metrics.md) and [Conformance](#conformance).

## Evidence

Three things back the metric rules: a specification that owns every number, a
check that fails when the code stops agreeing with it, and rule tests.

**The specification.** [`docs/metrics.md`](docs/metrics.md) defines every metric
the engine emits, per function, and says where each one comes from. Where the
cited literature leaves a choice open, the document states the choice and
defends it. Every metric rule reported here traces to a section there.

**The conformance suite.** `tools/conformance/index.ts` runs the engine over the
checked-in fixture corpus in `test/fixtures/metrics/` and compares every value
against expectations derived from the specification. The corpus is 72 small
TypeScript programs, each written so that one rule is easy to check and one
wrong answer is easy to find; `test/fixtures/metrics/README.md` lists what each
one isolates. See [Conformance](#conformance).

That corpus covers every metric the specification defines, including maximum
nesting depth and the maintainability index, so both are checked against
written expectations rather than assumed.

**The rule tests.** Each rule is driven through oxlint's own `RuleTester`. For
the three metric rules and the five vendored rules this repository enables, that
runs from `bun run test`, which is `bun test ./test/`; oxlint's `RuleTester`
refuses to run under Bun, so this repository's harness hands the cases to a
short-lived Node process. The trailing slash in that path is load-bearing:
`bun test test` does not scope, because `test` is a substring of the vendored
test paths.

The vendored rules carry upstream's own test files, run separately with
`node --test` — see [Upgrading the vendored copy](#upgrading-the-vendored-copy).

The three metric rules were measured on a 561-file TypeScript corpus (7081
functions, median of 11 runs) with the metric rules loaded alone:

| Run                      | Time   |
| ------------------------ | ------ |
| oxlint baseline          | 32 ms  |
| oxlint with metric rules | 195 ms |

The metric rules add about 162 ms to a full lint of 7081 functions. No build
step, no daemon, no second process to keep in sync.

## Install

```sh
bun add -d oxlint-plugin-better-antislop
```

The package ships TypeScript source and points its `exports` map straight at it:
`.` resolves to `./src/index.ts`, and there is one entry point. oxlint loads JS
plugins with a dynamic import and transpiles TypeScript itself, so there is no
build artifact to publish or keep in sync. This is deliberate, and it follows the
convention upstream `anti-slop` uses, whose own `package.json` also exports
`"./src/index.ts"` directly.

Tested against oxlint `1.87.0` and `@oxlint/plugins` `1.87.0`. Keep the two on
the same exact version: the JS plugin API is versioned in lockstep with the
binary that loads it.

## Configure

One plugin. Every rule key is `better-antislop/<rule>`. A JS plugin rule is not
active until your config names it, so nothing in this package is on by default
in the sense of being implicit — see
[What "off by default" buys you](#what-off-by-default-buys-you).

### `.oxlintrc.json`

```json
{
  "jsPlugins": ["oxlint-plugin-better-antislop"],
  "rules": {
    "better-antislop/cognitive-complexity": ["error", { "limit": 15 }],
    "better-antislop/max-nesting-depth": ["error", { "limit": 4 }],
    "better-antislop/min-maintainability-index": ["error", { "limit": 65 }],
    "better-antislop/no-chained-type-assertions": "error"
  }
}
```

### `oxlint.config.ts`

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: ['oxlint-plugin-better-antislop'],
  rules: {
    'better-antislop/cognitive-complexity': ['error', { limit: 15 }],
    'better-antislop/max-nesting-depth': ['error', { limit: 4 }],
    'better-antislop/min-maintainability-index': ['error', { limit: 65 }],
    'better-antislop/no-chained-type-assertions': 'error',
  },
});
```

### Aliasing the plugin

Use the object form when a plugin name would collide with something else. The
alias replaces the prefix in every rule name.

```json
{
  "jsPlugins": [{ "name": "house", "specifier": "oxlint-plugin-better-antislop" }],
  "rules": {
    "house/cognitive-complexity": ["error", { "limit": 15 }]
  }
}
```

## Rules

Every rule lives under the single `better-antislop/` prefix. **This repository's
own `oxlint.config.ts` turns on eight of the twenty-six.** The other eighteen are
exported and documented here, and are enabled nowhere.

| Group                         | Count | On in this repository |
| ----------------------------- | ----: | --------------------- |
| Metric rules                  |     3 | yes                   |
| Vendored rules enabled here   |     5 | yes                   |
| Vendored rules, opt-in        |    13 | no                    |
| Vendored Effect rules, opt-in |     5 | no                    |

### Metric rules — written here

| Rule                        | Reports                                           | Option      | Default | On here |
| --------------------------- | ------------------------------------------------- | ----------- | ------- | ------- |
| `cognitive-complexity`      | A function whose cognitive complexity is too high | `{ limit }` | `15`    | `15`    |
| `max-nesting-depth`         | A function whose deepest nesting is too deep      | `{ limit }` | `4`     | `4`     |
| `min-maintainability-index` | A function whose maintainability index is too low | `{ limit }` | `65`    | `50`    |

Every rule takes one object option, `limit`. All three are optional; omitting the
option object uses the default.

Those are the shipped defaults, and the plugin ships them unchanged. Linting its
own source, `oxlint.config.ts` lowers only `min-maintainability-index`, to `50`:
the published `65` is calibrated for whole modules and collapses into a length
test on a single function. See [AGENTS.md](AGENTS.md).

Every diagnostic underlines the **whole function**, from its first line to its
last. None of the three offers a fix or a suggestion. Complexity is never
auto-fixable, and a fixer that pretended otherwise would be a lie.

The message templates are:

```text
cognitive-complexity        Function "{name}" has cognitive complexity {value}, above the limit of {limit}. Move the nested decisions into named helper functions.
max-nesting-depth           Function "{name}" nests {value} levels deep, above the limit of {limit}. Flatten the inner blocks with early returns.
min-maintainability-index   Function "{name}" has maintainability index {value}, below the limit of {limit}. Shorten it and lower its operator and operand count.
```

`{name}` is the declared function name, or the literal `<anonymous>` when the
function has none. `{value}` is the measured metric: integers print exactly, the
maintainability index prints with one decimal.

#### `cognitive-complexity`

Cognitive complexity charges `1 + current nesting` for each `if`, each loop,
each `catch`, each `switch` and each ternary. An `else` and an `else if` add a
flat `1` and do not raise nesting, so a flat chain of `else if` is cheap and a
ladder of nested blocks is not.

This function costs `1 + 2 + 3 + 1 = 7`:

```ts
function label(order: Order): string {
  if (order.paid) {
    // +1, nesting 0
    if (order.total > 100) {
      // +2, nesting 1
      if (order.coupon) {
        // +3, nesting 2
        return 'paid-large-coupon';
      }
      return 'paid-large';
    }
    return 'paid-small';
  }
  if (order.cancelled) {
    // +1, nesting 0
    return 'cancelled';
  }
  return 'open';
}
```

With `{ "limit": 5 }`:

```text
Function "label" has cognitive complexity 7, above the limit of 5. Move the nested decisions into named helper functions.
```

The fix the message asks for is real: extract the inner block into a named
function. The extracted function is scored on its own, and the caller drops back
to a single decision.

#### `max-nesting-depth`

Nesting propagates through `if`, every loop, `catch`, `switch` and ternaries.
`try` is not structural: it does not raise the level of its body, but `catch`
does. This is what makes the number match what the eye sees in the left margin.

```ts
function find(users: User[], id: string): User | undefined {
  return users.find((user) => {
    if (user.active) {
      for (const role of user.roles) {
        if (role === id) {
          return true;
        }
      }
    }
    return false;
  });
}
```

With `{ "limit": 2 }` the `if` inside the `for` puts the function past the
limit, and the whole function is underlined. An early return removes the level:

```ts
function find(users: User[], id: string): User | undefined {
  return users.find((user) => user.active && user.roles.includes(id));
}
```

#### `min-maintainability-index`

The maintainability index is the classic formula:

```text
MI = max(0, (171 - 5.2·ln(volume) - 0.23·cyclomatic - 16.2·ln(lines)) · 100 / 171)
```

where `volume` is the Halstead volume of the function, `cyclomatic` is its
cyclomatic complexity and `lines` is its inclusive physical line count. The
result is capped at 100 and floored at 0.

It is a single number for three different kinds of bloat at once: too many
distinct operators and operands, too many branches, and too many lines. A long
`switch`-heavy formatter is the usual trigger.

```ts
function format(node: Node): string {
  switch (node.kind) {
    case 'text':
      return node.value;
    case 'link':
      return `[${node.label ?? node.href}](${node.href})`;
    case 'image':
      return `![${node.alt}](${node.src})`;
    case 'code':
      return node.language ? `\`\`\`${node.language}\n${node.value}\n\`\`\`` : node.value;
    case 'list':
      return node.items.map((item) => `- ${item}`).join('\n');
    case 'quote':
      return node.lines.map((line) => `> ${line}`).join('\n');
    default:
      return '';
  }
}
```

With `{ "limit": 80 }` the diagnostic reads:

```text
Function "format" has maintainability index <measured>, below the limit of 80. Shorten it and lower its operator and operand count.
```

#### What the metric engine measures

The three rules read from one shared metric engine, so they cannot disagree with
each other. The engine computes, per function, from that function's own syntax:
cyclomatic complexity, cognitive complexity, maximum nesting, Halstead measures
(volume, vocabulary, difficulty, effort), the maintainability index, logical
line count, parameter count, physical line count and direct self-recursion.

### Vendored rules enabled in this repository — written upstream

These five replace rules this package used to implement itself. They now come
from `vendor/anti-slop/`, so their behaviour, their messages and their options
are upstream's, not ours.

| Rule                                        | Reports                                                                 | Option                  | Default      | On here                   |
| ------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- | ------------ | ------------------------- |
| `no-chained-type-assertions`                | A chained assertion, which discards the type evidence in the first link | none                    | —            | `error`                   |
| `require-safety-comment-for-type-assertion` | An `as T` or `<T>value` with no written justification                   | `{ markers }`           | `['SAFETY']` | `error`                   |
| `no-runtime-typeof`                         | `typeof` used as ad hoc narrowing instead of boundary decoding          | `{ allowInTypeGuards }` | `false`      | `allowInTypeGuards: true` |
| `no-unknown-parameters`                     | A parameter typed `unknown`, directly or through a local alias          | none                    | —            | `error`                   |
| `no-object-parameters`                      | A parameter typed `object`, directly or through a local alias           | none                    | —            | `error`                   |

#### `no-chained-type-assertions`

A chain launders a type. The compiler cannot see what happened between the first
assertion and the second, and neither can the next reader. Angle-bracket
assertions and parenthesized chains are covered too.

```ts
// reported
const config = JSON.parse(raw) as unknown as Config;
```

```ts
// accepted: narrow once with a type guard
function isConfig(value: unknown): value is Config {
  return typeof value === 'object' && value !== null && 'port' in value;
}

const parsed: unknown = JSON.parse(raw);
if (!isConfig(parsed)) {
  throw new Error('invalid config');
}
const config: Config = parsed;
```

Chains made only of `as const` are allowed, because they narrow inference without
discarding type evidence.

#### `require-safety-comment-for-type-assertion`

Every `as T` and every `<T>value` needs a justification, written as a comment
immediately before the assertion or before its containing statement.

```ts
// reported: no justification
const config = JSON.parse(raw) as Config;
```

```ts
// accepted
// SAFETY: the caller validates the payload against the config schema.
const config = JSON.parse(raw) as Config;
```

`as const` never needs a justification. The marker is an array, so several
prefixes can be accepted at once: `{ "markers": ["SAFETY", "HACK"] }`.

#### `no-runtime-typeof`

`typeof` narrows a representation without establishing a contract. Decode the
value once, at the boundary where it enters, then branch on the domain.

```ts
// reported
if (typeof value === 'string') {
  return value.toUpperCase();
}
```

```ts
// accepted: decode once, at the boundary, then trust the type
function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const text = readText(value);
if (text !== undefined) {
  return text.toUpperCase();
}
```

A comparison against the string `"undefined"` is allowed as an existence probe:

```ts
if (typeof document === 'undefined') {
  return null;
}
```

Set `{ "allowInTypeGuards": true }` to permit `typeof` inside a function whose
declared return type is a TypeScript type predicate, because that signature is
where the check belongs. This repository sets it.

#### `no-unknown-parameters`

`unknown` in a parameter position spreads the problem to every caller. Parse it
once, at the boundary, then pass the parsed type.

```ts
// reported
function render(input: unknown): string {
  return String(input);
}
```

```ts
// accepted: parse at the boundary, then pass the parsed type
function render(input: string): string {
  return input.toUpperCase();
}
```

Two positions are exempt and the exemptions are not configurable: the parameter
named `cause`, because that is what an error cause is, and the exact subject of
a type predicate, because narrowing is the point there. The rule takes no options.

#### `no-object-parameters`

`object` is `any` with better manners. It accepts everything and tells the reader
nothing.

```ts
// reported
function save(value: object) {}
```

Use an interface, a `Record` with a known value type, or a discriminated union:

```ts
interface SaveOptions {
  readonly dryRun?: boolean;
}

function save(options: SaveOptions) {}
```

### Vendored rules, opt-in — written upstream

Exported and documented. Enabled nowhere in this repository, in this plugin's
config, or in any fixture. Turn one on by naming it.

| Rule                                 | Reports                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `no-array-filter-map`                | Adjacent eager `filter`/`map` passes, which build an intermediate array                             |
| `no-reduce-accumulator-copy`         | Copying a growing reducer accumulator on every iteration, which can cost quadratic work             |
| `no-conditional-empty-object-spread` | An object spread that omits a field by conditionally spreading `{}`                                 |
| `no-known-value-widening`            | A known expression flowing into `unknown`, `object` or an open dictionary, discarding the evidence  |
| `no-module-mocking`                  | Vitest and Jest `mock`/`doMock`/`unstable_mockModule`; tests should use real seams                  |
| `no-reflect-apply`                   | `Reflect.apply`, in favour of a typed call or an interface                                          |
| `no-reflect-get`                     | `Reflect.get`, in favour of typed property access or boundary parsing                               |
| `no-shape-in-symbol-names`           | The case-insensitive substring `shape` in a locally owned symbol name                               |
| `no-unknown-returns`                 | A declared return contract that resolves to `unknown`, `Promise<unknown>` or `PromiseLike<unknown>` |
| `no-unknown-type-aliases`            | A type alias that resolves to `unknown`                                                             |
| `no-unsafe-dictionary-type`          | A dictionary value type of `unknown`, `any`, `object` or `{}`                                       |
| `no-widen-then-assert`               | Widening a known local to a broad type and asserting it back to a narrower one                      |
| `require-readable-spacing`           | Missing blank lines between top-level declarations and logical statement groups                     |

None of these takes options. `require-readable-spacing` is the only rule in the
whole plugin that offers a fix, and the fix is whitespace-only.

### Vendored Effect rules, opt-in — written upstream

These five are wholly syntactic. They need no `effect` dependency to load and
resolve no Effect types; they match on the shape Effect code already has.

| Rule                             | Reports                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `no-manual-effect-error-tag`     | A manual `_tag` discrimination inside a broad `Effect.catch`/`catchAll`/`catchIf`  |
| `no-manual-tag-comparison`       | A direct `_tag` comparison or switch, in favour of `Match` or `Predicate.isTagged` |
| `no-manual-tagged-construction`  | A hand-written `_tag` property, in favour of `Data.taggedEnum` or a tagged class   |
| `no-service-constructor-imports` | A relative `make<CapabilityName>` import outside a `*.test.*` or `*.spec.*` file   |
| `prefer-effect-match`            | Chained literal ternaries over one value, in favour of `Match`                     |

None of these takes options.

## Provenance and licensing

This matters more than anything else on this page, so it is stated precisely.

**What is this repository's work.** Everything under `src/`: the metric engine
(`src/engine/`), the three metric rules (`src/rules/`), and the plugin entry
point (`src/index.ts`) that assembles all 26 rules into one plugin.

**What is third-party.** Everything under `vendor/anti-slop/`, including its
tests, its own `package.json` and its own `README.md`. That directory is a copy
of upstream source, not a fork maintained here.

|                       |                                                                |
| --------------------- | -------------------------------------------------------------- |
| Upstream project      | [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop)  |
| Upstream package      | `oxlint-plugin-anti-slop` `0.1.2`                              |
| Upstream licence      | MIT                                                            |
| Pinned revision       | `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`                     |
| Vendored at           | [`vendor/anti-slop/`](vendor/anti-slop/)                       |
| Upstream licence file | [`vendor/anti-slop/LICENSE`](vendor/anti-slop/LICENSE)         |
| Provenance record     | [`vendor/anti-slop/UPSTREAM.md`](vendor/anti-slop/UPSTREAM.md) |

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
[`docs/metrics.md`](docs/metrics.md), their numbers are checked by a conformance
suite, and they change only when this repository decides they should.

## Conformance

`tools/conformance/index.ts` runs the metric engine over the checked-in fixture
corpus in `test/fixtures/metrics/` and compares every value it emits against
expectations derived from [`docs/metrics.md`](docs/metrics.md).

```sh
bun tools/conformance/index.ts
```

From a checkout, `bun run conformance` is a thin alias for exactly that
invocation.

- With no arguments it **checks**: every fixture is analysed and every metric is
  compared. It exits non-zero on any difference.
- `--update` **rewrites the expectation file** from the current output.

`--update` is not a fix and not a shortcut around review. It is how you _propose_
a change to a metric: the rewritten expectations then have to be read, one by
one, against the section of `docs/metrics.md` that owns the number, and accepted
only when the code agrees with the specification and the specification is right.
A diff that nobody checked against the specification is not a metric change, it
is a regression with a passing test.

Run it after every change to metric scoring. A scoring change that has not
passed the conformance suite is not finished. It covers the three metric rules
only; it says nothing about the 23 vendored rules, which are covered by their own
upstream test files.

`tools/conformance/README.md` has the detail: how expectations are stored and
formatted, which node shapes the corpus covers, and how to read a failure.

The engine itself is a pure function over an ESTree `Program`, so the suite can
call it directly and the rule tests can do the same. That is why scoring is
testable without a linter in the loop.

## Analysis boundaries

Read these before you trust a number. They hold for the three metric rules. The
23 vendored rules have their own boundaries, documented upstream in
[`vendor/anti-slop/README.md`](vendor/anti-slop/README.md); the shared ones are
noted below.

- **Syntactic only.** Every metric value comes from the syntax tree of one file.
  No type information is consulted, and no type-aware flag changes the result. A
  branch the compiler proves impossible still counts.
- **One file at a time.** No cross-file resolution, no module graph, no project
  analysis. A call into another file is a call, not a resolved callee.
- **Per function, from its own syntax.** A nested function is scored
  independently and never adds to the function that contains it. An arrow
  function written inside a loop body is its own unit of measurement.
- **Recursion is direct only.** `recursive` is true for a function calling itself
  by bare name or through `this`. Indirect and mutual recursion are not
  detected.
- **Halstead is lexical.** Operands are identifiers, literals, `this`, `super`,
  `true`, `false` and `null`, counted distinct by source text. Renaming a
  variable can change the index.
- **No type-aware vendored rules either.** The vendored rules use oxlint's ESTree
  and lexical-scope APIs, not a type checker. They resolve same-file aliases,
  including block-scoped and forward references, but not imported type
  definitions or cross-file signatures.
- **Fixes.** Only `require-readable-spacing` fixes anything, and only whitespace.
  The other twenty-five rules are report-only. A complexity number is not
  something a tool can rewrite for you, and no vendored rule ships a fixer that
  would have to invent a justification.
- **Metric diagnostics cover the whole function.** A metric rule marks the
  offending function, from its first line to its last, not the single statement
  inside it that pushed it over the limit.

## How it works

One traversal per file produces every metric. The nesting model, the logical
sequence rules and the Halstead accounting live in a single pure module
(`src/engine`), and the rules only read the plain data that module returns. That
is why `cognitive-complexity`, `max-nesting-depth` and
`min-maintainability-index` can never drift apart, and why the same numbers can
be produced by a test harness without a linter.

Five details these metrics are easy to get wrong, in a way that still produces
plausible numbers. Each is stated in [`docs/metrics.md`](docs/metrics.md) and
each has a fixture in the corpus that settles it:

- `??` is an ESTree `LogicalExpression` too, but it is not a branch, so it
  scores `0`. It is still an operator for Halstead purposes, because it combines
  two values like any other.
- Logical operators are read in **source order**, not preorder. In
  `a || b && c || d && e` the operators are `||`, `&&`, `||`, `&&` and the
  function scores `4`. A preorder walk would see `||`, `||`, `&&`, `&&` and
  score `2`.
- `try` is not structural: it does not raise the nesting level of its body. Its
  `catch` does.
- `else` adds a flat `1` and raises nothing. An `else if` continues the chain,
  also adds `1`, and raises nothing.
- A `switch` header scores `0`; its `case` arms are the branch points. A
  `default:` arm has no test, so it is not a branch point either.

## License

MIT, [`LICENSE`](./LICENSE).

The vendored portion under `vendor/anti-slop/` is MIT as well, from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop). Its licence text is
kept verbatim at [`vendor/anti-slop/LICENSE`](vendor/anti-slop/LICENSE), and
[`vendor/anti-slop/UPSTREAM.md`](vendor/anti-slop/UPSTREAM.md) records the pinned
revision it came from.
