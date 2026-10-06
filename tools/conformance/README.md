# The conformance suite

The metric engine is checked against the specification it implements. Nothing
here compares it with another tool: `test/fixtures/metrics/expected.json`
records what the normative specification linked from `docs/metrics.md` requires
for every function of every fixture, and this suite fails the moment the engine
stops producing it.

## Commands

```
bun tools/conformance/index.ts             compare the corpus with the golden file
bun tools/conformance/index.ts --update    rewrite the golden file from a run
`bun tools/conformance/index.ts --help`    print usage and exit successfully
```

`bun run test` executes the package script `bun test ./test/`, which discovers
the repository tests under `test/`, including this conformance test. Do not use
bare `bun test`: it also discovers the vendored RuleTester tests. Run those with
`bun run vendor:test`, which uses `node --test`. Under Bun, the `RuleTester`
constructor succeeds, but `.run()` fails when parsing starts.

`-h` is the short form of `--help`. Help exits with status 0. Unknown arguments
exit with status 1.

Check mode exits with status 1 when metrics differ or a fixture or function is
missing. It also exits with status 1 for parse or analysis failures, or when no
function was compared.

Update mode exits with status 1 if reading, parsing, analysis, or writing fails.
It also exits with status 1 when no function is measured.

`--update` is not a repair command. It rewrites the file from whatever the
engine currently produces, so what it writes is a claim about the engine, not
about the specification, until a human has read every value in it against the
normative specification linked from `docs/metrics.md`. It prints a warning saying so.

## Provenance of `expected.json`

The file is a golden file, and a golden file generated from the implementation
proves nothing: it would only say that the engine agrees with itself. This one
was not generated from the engine.

1. Each fixture was parsed to an ESTree `Program`.
2. Every metric was then derived from that tree by a second, independent reading
   of the normative specification linked from `docs/metrics.md`, written from the
   linked pages and discarded afterwards.
   The specification's own worked examples — [§3.3](../../docs/complexity.md#33-worked-example-switch),
   [§3.4](../../docs/complexity.md#34-worked-example-loop-guard-throw), [§4.3](../../docs/complexity.md#43-else-and-else-if),
   [§4.4](../../docs/complexity.md#44-try-is-not-structural-catch-is), [§4.8](../../docs/complexity.md#48-the-nested-if-ladder),
   [§5.2](../../docs/complexity.md#52-source-order-not-tree-order), [§7.5](../../docs/halstead.md#75-worked-example),
   [§8](../../docs/halstead.md#8-maintainability-index), and [§11](../../docs/function-metrics.md#11-nested-functions) — were used to check that reading before it was trusted.
3. Only then was the engine run, and the two were compared field by field.

Every completed disagreement was resolved against the specification, never
against the engine. Five readings were wrong on the first pass and have been
corrected to what the document says. They are recorded below: four are places
where the document admits more than one reading, and the fifth is [§7.2](../../docs/halstead.md#72-operands) on the
operand a private field writes. The shorthand operand expectation was also a
first-pass error: [§7.2](../../docs/halstead.md#72-operands) counts the written `size` in `{ size }` once, not twice
for duplicate AST identifiers. We corrected that expectation against the
token-based rule.

The file records **every** metric [§13](../../docs/function-metrics.md#13-output) defines, not only the three a rule gates
on: `cyclomatic`, `cognitive`, `maxNesting`, `maintainabilityIndex`, the nine
Halstead values, `lines`, `logicalLines`, `parameters` and `recursive`. The
integers are exact; the four floats are written at full precision and compared
exactly.

## Identity

Functions are joined on `kind`, `name`, `line`, `column` and a short declaration
head, not on a line number alone. A line number moves when a line is inserted
above; a name changes when a function is renamed. The head is the source from
the start of the span to the first `{` or `=>` at bracket depth zero, with
whitespace collapsed and a limit of 72 characters, so it changes only when the
signature does. It is an identity component and is never compared as a metric.

A function or a fixture missing on either side is a reported difference, not an
absence, and two functions claiming one identity are reported as ambiguous
rather than silently paired.

## Interpretations

The five corrections, each resolved against the document rather than against the
engine. Four are determinate once the document is read closely. The first needed
a reconciliation, and is written out in full because the same shape of question
will come back, and because the wrong answer to it looks right.

Every bullet names the fixture that pins it, so none of these has to be taken on
trust: if a future change breaks one, the conformance run says so.

- **An object shorthand method is anchored at its `FunctionExpression`, and an
  enclosing function still writes its colon.** [§2.2](../../docs/metrics.md#22-what-counts-as-a-function) excludes `{ a() {} }` from
  the `Property` row and says it "is found as the function node itself", and
  [§2.3](../../docs/metrics.md#23-anchor-name-kind-span) anchors everything else at the function node. So `object-literal-members.ts`'s
  `method()` is reported as its own function, `kind: "anonymous"`, `name: null`,
  spanning from its `(`.

  [§7.3](../../docs/halstead.md#73-constructs-that-write-nothing), which says the method shorthand writes a `:`, is **not** in conflict with
  that. [§2.2](../../docs/metrics.md#22-what-counts-as-a-function)'s parenthetical is about _anchoring_, not about traversal: the method
  is scored as its own function. The `Property` is the _parent_ of that function
  node, so an enclosing function's walk still reaches it and writes the `:`, then
  stops at the nested-function boundary before entering the body. Both statements
  hold, because they were about different nodes. An earlier draft of this file
  called it a conflict and said the colon was not written; that was wrong, and the
  probe that settles it is `{ a() { return 1; } }` inside a function, whose
  enclosing function scores `distinctOperators: 2` for `return` and `:`.

  `property-colon-method-shorthand.ts` pins both halves: a method shorthand at
  module level, where no enclosing function exists to write the colon, and the
  same method inside a function, where `methodInFunction` scores
  `distinctOperators: 2` while the method scores 1.

- **A class field holding an arrow is `kind: "arrow"`.** [§2.3](../../docs/metrics.md#23-anchor-name-kind-span) lists `arrow`
  first and conditions it on the function being an `ArrowFunctionExpression`,
  which is true whoever holds it, and the `method` row says "any _other_" class
  method or class field holding a function. Pinned by
  `class-field-arrow-function.ts`, whose two class fields are both `arrow`.
- **A delegating `yield` writes two operator tokens.** [§7.1](../../docs/halstead.md#71-operators) says `yield x`,
  `yield* g()` write `yield`, "plus `*` for a delegating yield", so `yield*` is two
  occurrences and one distinct operator. Pinned by
  `generator-yield-delegate.ts`: `distinctOperators: 2`, `totalOperators: 4`.
- **A `??` does not put a scored chain around what it holds.** [§2.5](../../docs/metrics.md#25-the-walk) defines
  `inSequence` as being inside a chain that "has already been scored", and [§5.1](../../docs/complexity.md#51-the-rule)
  skips `??` when a chain is flattened, so it opens none and puts none around what
  it holds. `left ?? (middle && right)` is therefore a chain of one `&&`. Pinned by
  `logical-nullish-beside-and.ts`: `nullishRightOfAnd` scores cyclomatic 2,
  cognitive 1.
- **A `PrivateIdentifier` is the operand `#field`, hash included.** [§7.2](../../docs/halstead.md#72-operands) writes
  the operand as `#field`. The member `name` a `PrivateIdentifier` key supplies is
  the bare identifier, which is a different thing and is easy to conflate with it.
  Pinned twice by `class-accessor-getter-setter.ts`: `get value()` reads
  `this.#value`, so `value` and `#value` are two distinct operands and the getter
  scores `distinctOperands: 3`.

## Shape

| File                                | What it does                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `errors.ts`                         | Every failure as a `Data.TaggedError`. No plain `Error` reaches the error channel and no failure is swallowed.  |
| `expectations.ts`                   | Reads and writes the golden file, and builds one from a run. A missing file is an error, never an empty pass.   |
| `analyze.ts`                        | The IO seam: lists the corpus and runs the Node driver.                                                         |
| `compare.ts`                        | Pure. Takes rows and expectations, returns a sorted report. No IO, no Effect, and the test imports it directly. |
| `index.ts`                          | The command line.                                                                                               |
| `../test/support/analyze-driver.ts` | The Node half, on the other side of the process boundary.                                                       |

Effect sits on the seams — listing a directory, spawning Node, reading and
writing the golden file, writing the report. Reading the corpus, comparing and
rendering are plain functions.

## Why the driver is a separate process

`oxlint/plugins-dev` exports `RuleTester`. Its constructor succeeds under Bun,
but `.run()` fails when parsing starts, so this driver uses Node.

The driver calls `analyzeProgram` **inside** the `Program` visitor and never
after it. A `Program` node is a live view into the lint session's source buffer
and `node.loc` is a lazy getter over it; a call made after `RuleTester.run` has
returned reads a buffer that has already been released and throws
`TypeError: Cannot destructure property 'int32' of 'buffer' as it is null`. The
plain data it returns survives the teardown fine.

One `RuleTester` run per file, so a fixture that does not parse is reported on
its own instead of ending the process and taking the rest of the corpus with it.

The corpus has its own index at `test/fixtures/metrics/README.md`, which explains
what each fixture isolates. A fixture without a row there is checked but not
explained, so it needs one.

## Adding a fixture

1. Write a comment-free fixture. A comment inside a function's span changes its
   `lines` value and may change its maintainability index. A comment before a
   function shifts its source location, which the conformance identity uses.
   Comment text itself is not scored.
2. Run `bun tools/conformance/index.ts --update`.
3. Read every value it wrote for that fixture against the normative specification
   linked from `docs/metrics.md`. A value you cannot derive from the linked pages
   is a defect in the engine or in the document, not a value to accept.

`property-colon-initialiser-vs-shorthand.ts` and
`property-colon-method-shorthand.ts` were added the other way round, and the
result is the same file: their expectations were derived from the normative
specification linked from `docs/metrics.md` first, written into `expected.json` by
hand, and only then compared with the engine. Both agreed on the first comparison.
Nothing in the file came from a run.
