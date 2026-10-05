# The metrics corpus

Checked-in inputs for the metric engine. Each file is a small, self-contained
program written to make one rule easy to check and one wrong answer easy to
find. The expectations are not stored here: they belong to the specification
and to the test that reads this directory, so a fixture never states its own
score.

## Conventions

**Extension.** A fixture is named `<what-it-tests>.ts`, or `.tsx` for a file
that must be parsed as TSX. The extension is the dialect: `.tsx` is parsed as
TSX and everything else as TypeScript.

These files are _parser input_, not source. Several fixtures exist precisely to
exceed the nesting, complexity and line limits this repository enforces on its
own hand-written code, so linting them would fail the build on the very cases
the corpus needs. They are therefore excluded in two places, and both exclusions
are deliberate: `oxlint.config.ts` lists `test/fixtures/**` under
`ignorePatterns`, and `tsconfig.json` lists `test/fixtures` under `exclude`.
They are still real TypeScript and the conformance suite still parses them; they
are simply not code anyone maintains.

**No comments.** Fixtures carry no comments. The maintainability index is
computed from the physical line span of a function, so a leading comment would
move every number in the file. Explanations live in this document instead.

**Small files.** One fixture tests one thing wherever that is possible. Where a
rule has several shapes — every loop kind, both positions of a chained ternary,
the several ways a parameter can be written — the shapes sit side by side in
one file so they can be compared directly.

## Baseline

| Fixture                | What it isolates                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `zero-no-decisions.ts` | A function with no decision construct of any kind. The floor every other fixture is read against.                                        |
| `zero-empty-body.ts`   | The absolute floor: an empty body, so no operands and no operators. Pins the log floors in the index formula and the empty Halstead set. |

## Logical sequences

| Fixture                             | What it isolates                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logical-and-single.ts`             | One `&&`.                                                                                                                                                                                                                                                                                                                       |
| `logical-or-single.ts`              | One `                                                                                                                                                                                                                                                                                                                           |     | `.  |
| `logical-and-repeated.ts`           | Three `&&` in a row: every operator is a branch point, but repeating the same operator adds nothing beyond the first.                                                                                                                                                                                                           |
| `logical-or-repeated.ts`            | The same, for `\|\|`.                                                                                                                                                                                                                                                                                                           |
| `logical-mixed-tree-order.ts`       | **The ordering discriminator.** `a \|\| b && c \|\| d && e` puts the outermost `\|\|` at the root of the tree, so a preorder walk reads the operators as `\|\|, \|\|, &&, &&` and settles on a lower total. Reading in the order the operators are written gives `\|\|, &&, \|\|, &&` and an operator change at every position. |
| `logical-mixed-parenthesised.ts`    | `(a \|\| b) && (c \|\| d)`. Parentheses must not start a new sequence, and the change from `\|\|` to `&&` and back must each be charged. A naive walk reads `&&` first and gets this wrong.                                                                                                                                     |
| `logical-nullish-alone.ts`          | `??` in isolation. It is a logical expression in the tree but never a branch point.                                                                                                                                                                                                                                             |
| `logical-nullish-beside-and.ts`     | `??` next to `&&`, on both sides. Bare mixing is a syntax error, so the file uses parentheses; `??` contributes nothing while the `&&` on either side is charged once.                                                                                                                                                          |
| `logical-chain-in-nested-if.ts`     | A chain under two nested `if`s. Nesting applies to the `if`; the chain is scored as one sequence of its own.                                                                                                                                                                                                                    |
| `logical-chain-in-call-argument.ts` | A chain in an argument position. The walk has to leave the call to find it.                                                                                                                                                                                                                                                     |
| `logical-two-separate-chains.ts`    | Two statements with a chain each. Each is scored once, and neither is folded into the other.                                                                                                                                                                                                                                    |

## Nesting

Each ladder is a family: the members differ only in depth, so the score of each
can be read off its shape.

| Fixture                           | What it isolates                                                                                                                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nesting-if-ladder.ts`            | One to four nested `if`s. The same shape the rule tests already build.                                                                                                                                                                                                                             |
| `nesting-loop-ladder.ts`          | Four separate ladders, one per loop kind: `for…of`, `while`, `do…while`, `for…in`. Every loop kind opens a level.                                                                                                                                                                                  |
| `nesting-catch-ladder.ts`         | Three nested `catch` clauses. `try` between them does not break the ladder.                                                                                                                                                                                                                        |
| `nesting-switch-ladder.ts`        | A `switch` inside a `switch` arm.                                                                                                                                                                                                                                                                  |
| `nesting-ternary-ladder.ts`       | Ternaries nested in the consequent and in the alternate.                                                                                                                                                                                                                                           |
| `try-does-not-nest-catch-does.ts` | **The `try`/`catch` discriminator.** `try` groups statements without opening a level, so the `if` in a `try` block is charged at the depth it was written, while the `if` in a `catch` body is one level deeper. The second function does the same with `finally`, which is not structural either. |

## `if` arms

| Fixture                                  | What it isolates                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `else-arm-single.ts`                     | One `if` with an `else`. The trailing arm adds a point and opens no level.                                                           |
| `else-if-chain.ts`                       | A three-link `else if` chain ending in `else`. A chain continues flat: each link costs the same regardless of how deep the chain is. |
| `else-if-chain-without-trailing-else.ts` | The same chain with no trailing `else`, so the last link costs one point fewer.                                                      |

## `switch`

| Fixture                     | What it isolates                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `switch-with-default.ts`    | A switch with tested arms and a `default:`.                                                                                                       |
| `switch-without-default.ts` | The same switch with the `default:` removed. The two files must agree on every metric: a `default:` arm has no test, so it is not a branch point. |

## Jumps and labels

| Fixture                             | What it isolates                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `jump-labelled-break.ts`            | A `break` that names a label. It sends the reader somewhere new, so it costs a point without adding a branch. |
| `jump-unlabelled-break-continue.ts` | Bare `break` and `continue`. Neither costs anything.                                                          |
| `label-plain-statement.ts`          | A label with no jump attached. The label writes a colon; the loop it marks is scored normally.                |

## Ternaries

| Fixture                         | What it isolates                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `ternary-chained-alternate.ts`  | A ternary chained through the alternate arm.                                          |
| `ternary-chained-consequent.ts` | The same chain through the consequent arm. Both arms open a level for what they hold. |

## Recursion

Only the bare name and `this.<name>` are a cycle, and the function pays for the
first one only.

| Fixture                                | What it isolates                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `recursion-bare-name.ts`               | A function calling itself by its declared name.                                                                           |
| `recursion-this-member.ts`             | A method calling itself through `this`.                                                                                   |
| `recursion-super-not-self.ts`          | **The negative case.** `super.<name>` dispatches to the parent class, so the call is not a cycle and must not be charged. |
| `recursion-other-receiver-not-self.ts` | The same negative case for any other receiver.                                                                            |
| `recursion-charged-once.ts`            | Three self calls in one function. One point, not three.                                                                   |
| `recursion-indirect-not-detected.ts`   | Mutual recursion. The cycle is real but not direct, so neither function is charged.                                       |

## Function boundaries

A function nested inside another is scored on its own. Its decisions, nesting
and operators never reach the function around it.

| Fixture                                   | What it isolates                                                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nested-arrow-decisions-isolated.ts`      | **The leak discriminator.** The outer function holds a `for` and a call; the arrow it defines holds two `if`s and a chain. The outer score must not move. Both functions are reported separately. |
| `nested-function-declaration-isolated.ts` | The same boundary, for a nested `function` declaration rather than an arrow.                                                                                                                      |

## Signatures

A declaration that states a shape and no behaviour carries a location and
nothing else.

| Fixture                                | What it isolates                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `signature-declare-function.ts`        | A bodyless `declare function`, exported and not. Every metric is zero, and the parameter count is zero because the signature states no body. |
| `signature-overload-implementation.ts` | Two overload signatures and one implementation sharing a name. All three are discovered; only the implementation is measured.                |
| `signature-ambient-overload.ts`        | Overload signatures with no implementation at all.                                                                                           |
| `signature-abstract-method.ts`         | A bodyless abstract method beside a concrete one in the same class.                                                                          |
| `signature-ambient-class.ts`           | A bodyless method in a `declare class`.                                                                                                      |

## JSX and TSX

Parsed with the TSX dialect. `JSXIdentifier` is an operand like any other
identifier, and a type annotation is not an operator.

| Fixture                           | What it isolates                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `jsx-conditional-render.tsx`      | An early return of an element, then a fragment-free tree with an interpolated child.                                      |
| `jsx-attributes-and-children.tsx` | A nested element with a string attribute and an arrow inside an expression container. The arrow is a function of its own. |
| `tsx-generic-arrow.tsx`           | A generic arrow assigned to a name. The trailing comma in `<T,>` is what keeps it out of JSX parsing.                     |
| `tsx-type-annotations.tsx`        | Type annotations and an `as` assertion. Neither writes an operator.                                                       |

## Template literals

The text of a template is an operand. Only what is interpolated is source.

| Fixture                               | What it isolates                                                                                                                                                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template-operators-as-text.ts`       | **The text discriminator.** A quasi whose text reads `a && b \|\| c ? d : e \|\|` must contribute one operand and no operators, while the `&&` inside the interpolation is a real one. The second function has two quasis, so it contributes two operands. |
| `template-interpolated-expression.ts` | A ternary inside an interpolation. It is scored like any other expression.                                                                                                                                                                                 |
| `template-tagged.ts`                  | A tagged template. The tag and the call around the literal change nothing inside it.                                                                                                                                                                       |

## Generators

| Fixture                       | What it isolates                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `generator-function-star.ts`  | A generator declaration and a plain `yield`. The `*` is an operator the declaration writes; `yield` is one the expression writes. |
| `generator-yield-delegate.ts` | `yield*` against `yield`. Delegation writes a second token.                                                                       |
| `generator-object-method.ts`  | The same `*` on an object-literal method rather than a declaration.                                                               |

## Parameters

| Fixture                                | What it isolates                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `parameters-destructured-object.ts`    | A destructured object parameter, then the same with a default. A pattern is still one parameter; a default writes `=`.   |
| `parameters-default-rest-and-array.ts` | A default value, a rest element and a destructured array, each as its own function.                                      |
| `parameters-arrow-destructured.ts`     | A destructured parameter on an arrow, which takes its name from the binding it was assigned to.                          |
| `class-parameter-properties.ts`        | Parameter properties in a constructor. Each is one parameter, and the declaration it wraps is still reached by the walk. |

## Class and object members

| Fixture                                      | What it isolates                                                                                                                                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class-method-instance-and-static.ts`        | An instance method and a static one. Both are methods; `static` is not a node of its own.                                                                                                                                             |
| `class-accessor-getter-setter.ts`            | A getter and a setter over a private field, so the getter and setter kinds and a `#name` operand all appear together.                                                                                                                 |
| `class-static-block.ts`                      | A `static` initialisation block. It holds a branch and is walked, but it is not a function and is never reported as one.                                                                                                              |
| `class-field-arrow-function.ts`              | Arrow functions held in class fields, instance and static. The field supplies the name and the method kind.                                                                                                                           |
| `class-private-name.ts`                      | A private field read and written through `this`. The `#name` is an operand written once.                                                                                                                                              |
| `object-literal-members.ts`                  | Every object-literal shape at once: a keyed property, a shorthand, a method, a getter, a setter and an arrow-valued property. A shorthand writes no colon; a keyed property does.                                                     |
| `property-colon-initialiser-vs-shorthand.ts` | **The colon discriminator.** An initialiser property against a shorthand one of the same shape, plus one literal holding two colons. `{ a: 1 }` writes `:` and `{ a }` does not; two colons count once distinctly and twice in total. |
| `property-colon-method-shorthand.ts`         | A method shorthand with and without an enclosing function. The method is scored on its own either way; the colon reaches only the function that surrounds it. A module-level fixture alone cannot show this half.                     |

## Operators and tokens

Halstead counts the tokens a node writes. These files pin which constructs
write one and which write none.

| Fixture                                | What it isolates                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `operator-assignment-update-binary.ts` | Simple, compound and nullish assignment, prefix and postfix update, a comparison and a ternary.       |
| `operator-await-and-for-await.ts`      | `await` on its own, then `for await…of`, which writes three tokens where a plain `for…of` writes two. |
| `operator-new-and-meta-properties.ts`  | `new` as an operator, `new.target` as one, and `import.meta` as none.                                 |
| `operator-non-null-assertion.ts`       | The `!` of a non-null assertion, which is an operator the expression writes.                          |
| `throw-statement.ts`                   | `throw`. It adds a branch and no cognitive cost, and opens no level.                                  |
