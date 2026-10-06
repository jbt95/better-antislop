# Conformance

`tools/conformance/index.ts` runs the metric engine over the checked-in fixture
corpus in `test/fixtures/metrics/` and compares every value it emits against
expectations derived from [`metrics.md`](metrics.md).

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
one, against the section of [`metrics.md`](metrics.md) that owns the number, and accepted
only when the code agrees with the specification and the specification is right.
A diff that nobody checked against the specification is not a metric change, it
is a regression with a passing test.

Run it after every change to metric scoring. A scoring change that has not
passed the conformance suite is not finished. It covers the three metric rules
only; it says nothing about the 23 vendored rules, which are covered by their own
upstream test files.

[`tools/conformance/README.md`](../tools/conformance/README.md) has the detail: how expectations are stored and
formatted, which node shapes the corpus covers, and how to read a failure.

The engine itself is a pure function over an ESTree `Program`, so the suite can
call it directly and the rule tests can do the same. That is why scoring is
testable without a linter in the loop.

## Analysis boundaries

Read these before you trust a number. They hold for the three metric rules. The
23 vendored rules have their own boundaries, documented upstream in
[`vendor/anti-slop/README.md`](../vendor/anti-slop/README.md); the shared ones are
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
plausible numbers. Each is stated in [`metrics.md`](metrics.md) and
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
