# Setup

One oxlint JS plugin. **26 rules**, in two groups:

| Group          | Count | Origin                                                                                                                                  |
| -------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------- |
| Metric rules   |     3 | Written and specified by this repository. Every value is fixed by [`metrics.md`](metrics.md).                                           |
| Vendored rules |    23 | Vendored as source from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) (MIT) at a pinned revision. 18 general, 5 Effect. |

The metric rules are the reason this package exists. The vendored rules are not
this repository's work: they are third-party code kept current by a pinned sync.
Read [Provenance and licensing](provenance.md#provenance-and-licensing) before you rely on
them, and [What "off by default" buys you](provenance.md#what-off-by-default-buys-you) before
you turn one on.

The metrics are not copied from another tool and they are not invented between
one edit and the next. [`metrics.md`](metrics.md) is the normative
specification of every value the engine emits for one function: where each
formula comes from, what counts as a decision, which tokens are operators, and
the exact worked examples that settle a disagreement. These focused pages are
the detailed user guide; that document is the contract for the three metric
rules, and for nothing else.

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
[`metrics.md`](metrics.md) and [Conformance](conformance.md#conformance).

## Evidence

Three things back the metric rules: a specification that owns every number, a
check that fails when the code stops agreeing with it, and rule tests.

**The specification.** [`metrics.md`](metrics.md) defines every metric
the engine emits, per function, and says where each one comes from. Where the
cited literature leaves a choice open, the document states the choice and
defends it. Every metric rule reported here traces to a section there.

**The conformance suite.** `tools/conformance/index.ts` runs the engine over the
checked-in fixture corpus in `test/fixtures/metrics/` and compares every value
against expectations derived from the specification. The corpus is 77 small
TypeScript programs, each written so that one rule is easy to check and one
wrong answer is easy to find; [`test/fixtures/metrics/README.md`](../test/fixtures/metrics/README.md) lists what each
one isolates. See [Conformance](conformance.md#conformance).

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
`node --test` — see [Upgrading the vendored copy](provenance.md#upgrading-the-vendored-copy).

The three metric rules were measured on a 561-file TypeScript corpus (7081
functions, median of 11 runs) with the metric rules loaded alone:

| Run                      | Time   |
| ------------------------ | ------ |
| oxlint baseline          | 32 ms  |
| oxlint with metric rules | 195 ms |

The metric rules add about 162 ms to a full lint of 7081 functions. No build
step, no daemon, no second process to keep in sync.

The corpus and benchmark runner are not checked in, so these figures cannot be
reproduced from a checkout. Treat them as recorded measurements, not a benchmark
guarantee.

## Source distribution

This project is not published to npm and is not intended to be installed as a
Git or npm dependency. It follows the delivery model of
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop): install a copy of
the TypeScript source into the consuming repository and load that local source
file. Node does not strip TypeScript from entrypoints inside `node_modules`, so
this avoids both that failure and a generated-JavaScript build step.

### Install with the agent skill

```sh
npx skills add jbt95/better-antislop --skill install-better-antislop
```

Then ask your coding agent to install and configure better-antislop. The skill
copies the runtime source, licenses, and provenance to
`tools/oxlint/better-antislop/`. The installer refuses to overwrite an existing
copy and does not modify the target manifest or lint configuration.

For a different destination, the script takes it as its first argument. The
script is available at
`skills/install-better-antislop/scripts/install.mjs` in this repository.

### Runtime dependency

Install `@oxlint/plugins` at exactly the same version as the consuming
repository's `oxlint`; their JavaScript plugin API is versioned in lockstep.
The plugin is tested with both at `1.87.0`. Use Node `22.18.0` or newer, or
Bun, for Oxlint's local TypeScript plugin loading.

## Configure

One plugin. Every rule key is `better-antislop/<rule>`. A JS plugin rule is not
active until your config names it, so nothing in this source is on by default
in the sense of being implicit — see
[What "off by default" buys you](provenance.md#what-off-by-default-buys-you).

The examples assume the default install path. If you used another destination,
update the `specifier` and both ignore paths. Merge these entries with existing
configuration rather than replacing it. Ignore the vendored plugin in both
Oxlint and the formatter so its upstream source is not linted or rewritten.

### `.oxlintrc.json`

```json
{
  "ignorePatterns": ["tools/oxlint/better-antislop/**"],
  "jsPlugins": [
    {
      "name": "better-antislop",
      "specifier": "./tools/oxlint/better-antislop/src/index.ts"
    }
  ],
  "rules": {
    "better-antislop/cognitive-complexity": ["error", { "limit": 15 }],
    "better-antislop/max-nesting-depth": ["error", { "limit": 4 }],
    "better-antislop/min-maintainability-index": ["error", { "limit": 65 }],
    "better-antislop/no-chained-type-assertions": "error"
  }
}
```

Add `tools/oxlint/better-antislop/**` to the formatter's ignore patterns as
well.

### `oxlint.config.ts`

```ts
import { defineConfig } from 'oxlint';

export default defineConfig({
  ignorePatterns: ['tools/oxlint/better-antislop/**'],
  jsPlugins: [
    {
      name: 'better-antislop',
      specifier: './tools/oxlint/better-antislop/src/index.ts',
    },
  ],
  rules: {
    'better-antislop/cognitive-complexity': ['error', { limit: 15 }],
    'better-antislop/max-nesting-depth': ['error', { limit: 4 }],
    'better-antislop/min-maintainability-index': ['error', { limit: 65 }],
    'better-antislop/no-chained-type-assertions': 'error',
  },
});
```

### Run the linter

After merging the configuration, run:

```sh
bunx oxlint .
```

### Aliasing the plugin

Use another `name` when the default prefix would collide. The alias replaces
the prefix in every rule name; the local `specifier` remains the same.

```json
{
  "jsPlugins": [
    {
      "name": "house",
      "specifier": "./tools/oxlint/better-antislop/src/index.ts"
    }
  ],
  "rules": {
    "house/cognitive-complexity": ["error", { "limit": 15 }]
  }
}
```
