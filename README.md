# better-antislop

Two oxlint plugins in one package:

- **`better-antislop-metrics`** — code-metric rules, defined and documented by
  this package. Every value is specified in [`docs/metrics.md`](docs/metrics.md).
- **`better-antislop`** — opinionated anti-slop rules, in the spirit of
  [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop).

The metric rules are the reason this package exists. The opinionated rules are
the anti-slop half, and this repository lints itself with both.

The metrics are not copied from another tool and they are not invented between
one edit and the next. [`docs/metrics.md`](docs/metrics.md) is the normative
specification of every value the engine emits for one function: where each
formula comes from, what counts as a decision, which tokens are operators, and
the exact worked examples that settle a disagreement. This README is the user
guide; that document is the contract.

## Why it exists

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
[`docs/metrics.md`](docs/metrics.md) and
[Conformance](#conformance).

## Evidence

Two things back this package: a specification that owns every number, and a
check that fails when the code stops agreeing with it.

**The specification.** [`docs/metrics.md`](docs/metrics.md) defines every metric
the engine emits, per function, and says where each one comes from. Where the
cited literature leaves a choice open, the document states the choice and
defends it. Every rule this package reports traces to a section there.

**The conformance suite.** `tools/conformance/index.ts` runs the engine over the
checked-in fixture corpus in `test/fixtures/metrics/` and compares every value
against expectations derived from the specification. The corpus is 70 small
TypeScript programs, each written so that one rule is easy to check and one
wrong answer is easy to find; `test/fixtures/metrics/README.md` lists what each
one isolates. See [Conformance](#conformance).

That corpus covers every metric the specification defines, including maximum
nesting depth and the maintainability index, so both are checked against
written expectations rather than assumed.

**The test suite.** `bun test` runs 77 tests across 8 files, covering the
metric rules and the opinionated rules through oxlint's own `RuleTester`.

Cost, measured on a 561-file TypeScript corpus (7081 functions, median of 11
runs):

| Run                            | Time   |
| ------------------------------ | ------ |
| oxlint baseline                | 32 ms  |
| oxlint with the metrics plugin | 195 ms |

The plugin adds about 162 ms to a full lint of 7081 functions. No build step, no
daemon, no second process to keep in sync.

## Install

```sh
bun add -d oxlint-plugin-better-antislop
```

The package ships TypeScript source and points its `exports` map straight at it
(`.` resolves to `./src/index.ts`, `./opinionated` resolves to
`./src/opinionated/index.ts`). oxlint loads JS plugins with a dynamic import and
transpiles TypeScript itself, so there is no build artifact to publish or keep
in sync. This is deliberate, and it matches `oxlint-plugin-anti-slop`, whose own
`package.json` uses `"exports": "./src/index.ts"`.

Tested against oxlint `1.87.0` and `@oxlint/plugins` `1.87.0`. Keep the two on
the same exact version: the JS plugin API is versioned in lockstep with the
binary that loads it.

## Configure

### `.oxlintrc.json`

```json
{
  "jsPlugins": ["oxlint-plugin-better-antislop", "oxlint-plugin-better-antislop/opinionated"],
  "rules": {
    "better-antislop-metrics/cognitive-complexity": ["error", { "limit": 15 }],
    "better-antislop-metrics/max-nesting-depth": ["error", { "limit": 4 }],
    "better-antislop-metrics/min-maintainability-index": ["error", { "limit": 65 }],
    "better-antislop/no-chained-type-assertions": "error"
  }
}
```

### `oxlint.config.ts`

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  jsPlugins: ['oxlint-plugin-better-antislop', 'oxlint-plugin-better-antislop/opinionated'],
  rules: {
    'better-antislop-metrics/cognitive-complexity': ['error', { limit: 15 }],
    'better-antislop-metrics/max-nesting-depth': ['error', { limit: 4 }],
    'better-antislop-metrics/min-maintainability-index': ['error', { limit: 65 }],
    'better-antislop/no-chained-type-assertions': 'error',
  },
});
```

### Aliasing the plugins

Use the object form when you vendor the source, or when a plugin name would
collide with something else. The alias replaces the prefix in every rule name.

```json
{
  "jsPlugins": [
    { "name": "metrics", "specifier": "oxlint-plugin-better-antislop" },
    { "name": "better-antislop", "specifier": "oxlint-plugin-better-antislop/opinionated" }
  ],
  "rules": {
    "metrics/cognitive-complexity": ["error", { "limit": 15 }]
  }
}
```

## Rules: `better-antislop-metrics`

| Rule                        | Reports                                           | Option      | Default |
| --------------------------- | ------------------------------------------------- | ----------- | ------- |
| `cognitive-complexity`      | A function whose cognitive complexity is too high | `{ limit }` | `15`    |
| `max-nesting-depth`         | A function whose deepest nesting is too deep      | `{ limit }` | `4`     |
| `min-maintainability-index` | A function whose maintainability index is too low | `{ limit }` | `65`    |

Every rule takes one object option, `limit`. All three are optional; omitting the
option object uses the default.

Those are the defaults, and this package ships them unchanged. Linting its own
source, `oxlint.config.ts` lowers only `min-maintainability-index`, to `50`:
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

### `cognitive-complexity`

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

### `max-nesting-depth`

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

### `min-maintainability-index`

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

### What the engine measures

The three rules read from one shared metric engine, so they cannot disagree with
each other. The engine computes, per function, from that function's own syntax:
cyclomatic complexity, cognitive complexity, maximum nesting, Halstead measures
(volume, vocabulary, difficulty, effort), the maintainability index, logical
line count, parameter count, physical line count and direct self-recursion.

## Rules: `better-antislop`

Five opinionated rules. None of them offers a fix. In particular, a fixer must
never invent the justification that `require-safety-comment-for-type-assertion`
demands.

| Rule                                        | Reports                                                        | Option                              | Default     |
| ------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- | ----------- |
| `no-chained-type-assertions`                | `value as A as B`, which discards the type evidence in `A`     | none                                | —           |
| `require-safety-comment-for-type-assertion` | An `as T` or `<T>value` with no written justification          | `{ marker }`                        | `'SAFETY'`  |
| `no-runtime-typeof-narrowing`               | `typeof value === '...'` used as ad hoc narrowing              | `{ allowInTypePredicateFunctions }` | `false`     |
| `no-unknown-parameters`                     | A parameter typed `unknown`, directly or through a local alias | `{ allowedNames }`                  | `['cause']` |
| `no-object-parameters`                      | A parameter typed `object`, directly or through a local alias  | none                                | —           |

### `no-chained-type-assertions`

A chain launders a type. The compiler cannot see what happened between the first
assertion and the second, and neither can the next reader.

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

### `require-safety-comment-for-type-assertion`

Every `as T` and every `<T>value` needs a justification, written as a comment on
the line directly above the statement, or above its declaration or export when
the assertion is inside one.

```ts
// reported: no justification
const config = JSON.parse(raw) as Config;
```

```ts
// accepted
// SAFETY: the caller validates the payload against the config schema.
const config = JSON.parse(raw) as Config;
```

Change the marker text with `{ "marker": "HACK" }` if your team writes reasons
another way. `as const` never needs a justification.

### `no-runtime-typeof-narrowing`

`typeof` checks are the right tool in a type guard and the wrong tool
everywhere else. Spread through a function body they become an invisible second
type system.

```ts
// reported
if (typeof value === 'string') {
  return value.toUpperCase();
}
```

```ts
// accepted: validate once, at the boundary, then trust the type
function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const text = readText(value);
if (text !== undefined) {
  return text.toUpperCase();
}
```

Existence probes are allowed, because there is nothing else to write. The
operand has to name a binding the program never declared, so the probe is a
statement about the platform:

```ts
if (typeof document === 'undefined') {
  return null;
}
```

The same comparison against a name the program does define is a representation
check on a value the program owns, so it is reported:

```ts
// reported: `missing` is a local
if (typeof missing === 'undefined') {
  return null;
}
```

A probe that reads through a binding the program holds is reported for the
same reason, even when the binding is a platform global, so `typeof
holder.missing` needs a real type rather than an exemption.

Set `{ "allowInTypePredicateFunctions": true }` to permit `typeof` checks inside
functions that return a type predicate, if that is your team's convention.

### `no-unknown-parameters`

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

Type-predicate subjects are allowed, because narrowing is the point there. The
parameter name `cause` is allowed by default, because that is what an error cause
is. Change the list with `{ "allowedNames": ["cause", "raw"] }`.

### `no-object-parameters`

`object` is `any` with better manners. It accepts everything and tells the reader
nothing.

```ts
// reported
function apply(options: object): void {}
function merge(config: Record<string, unknown> | object): void {}
```

Use an interface, a `Record` with a known value type, or a discriminated union:

```ts
interface ApplyOptions {
  readonly dryRun?: boolean;
}

function apply(options: ApplyOptions): void {}
```

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
passed the conformance suite is not finished.

`tools/conformance/README.md` has the detail: how expectations are stored and
formatted, which node shapes the corpus covers, and how to read a failure.

The engine itself is a pure function over an ESTree `Program`, so the suite can
call it directly and the rule tests can do the same. That is why scoring is
testable without a linter in the loop.

## Analysis boundaries

Read these before you trust a number.

- **Syntactic only.** Every value comes from the syntax tree of one file. No type
  information is consulted, and no type-aware flag changes the result. A branch
  the compiler proves impossible still counts.
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
- **No fixes, no suggestions.** All eight rules are report-only. A complexity
  number is not something a tool can rewrite for you.
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

MIT. See [LICENSE](./LICENSE).
