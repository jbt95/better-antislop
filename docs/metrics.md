# Metrics

Normative specification of every value the metric engine emits for one function.

The engine turns one ESTree `Program` into `ProgramMetrics`: a list of
`FunctionMetrics`, one per function found in that program. Every field is
defined here. An implementation that follows this document and is fed the same
tree produces the same numbers.

## 1. Sources

| Metric                           | Origin                                  |
| -------------------------------- | --------------------------------------- |
| Cyclomatic complexity            | McCabe 1976                             |
| Cognitive complexity             | Campbell 2017 (SonarSource white paper) |
| Halstead measures                | Halstead 1977                           |
| Maintainability index            | Coleman, Ash, Lowther and Oman 1994     |
| Lines, logical lines, parameters | this document                           |

Where an implementation makes a choice the cited work does not mandate, the
choice is stated and defended in the section that owns it.

## 2. Analysis model

### 2.1 Input and boundaries

- The input is one parsed file: a single ESTree `Program` node. Nothing outside
  that tree is read.
- Analysis is syntactic. There is no type information, no type checker, no
  inferred type, no constant folding, and no evaluation of any kind.
- There is no cross-file or cross-module resolution. An imported name is an
  operand and nothing more.
- There is no inference of any kind: no data flow, no alias tracking, no
  reachability, no call-graph resolution.
- Comments are not an input. Comment text carries no weight anywhere, including
  in the maintainability index (§8).
- The analysis is pure: no file system access, no network access, no
  environment. A filename, when one is supplied, appears only in the message of
  a thrown error and never changes a metric.
- The same program node always yields the same result, and the result list is
  sorted (§2.4), so two runs cannot disagree.

### 2.2 What counts as a function

A function is found at any of these nodes:

| Node                                                                                                   | Notes                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `FunctionDeclaration`                                                                                  | function statement, nested or top level                                                                                                 |
| `FunctionExpression`                                                                                   | function expression                                                                                                                     |
| `ArrowFunctionExpression`                                                                              | arrow function                                                                                                                          |
| `TSDeclareFunction`                                                                                    | `declare function`                                                                                                                      |
| `TSEmptyBodyFunctionExpression`                                                                        | overload or abstract signature with no body                                                                                             |
| `MethodDefinition`, `TSAbstractMethodDefinition`                                                       | class method, constructor, getter, setter                                                                                               |
| `PropertyDefinition`, `TSAbstractPropertyDefinition`, `AccessorProperty`, `TSAbstractAccessorProperty` | class field whose value is a function                                                                                                   |
| `Property`                                                                                             | object-literal property whose value is a function, except a method shorthand (`{ a() {} }`), whose function node is anchored on its own |

Which node a function is anchored at, and which nodes the enclosing function's
walk reaches, are two different questions. A `Property` that holds a function
is a boundary: the enclosing function visits it and does not enter it — and
that same node is the anchor of the function's own entry. The method shorthand
`{ a() {} }` is the exception: its `Property` is an ordinary node, so the
enclosing walk visits it, takes the `:` it writes (§7.3) and reads its key, then
stops at the `FunctionExpression` inside it.

### 2.3 Anchor, name, kind, span

Each function is anchored at the node a report points at:

- a class member or object property: the member node;
- everything else: the function node itself.

`span` is the anchor's own position: `start.line` is 1-based, `start.column` is
0-based, and the end position is likewise the anchor's last position. A
method's span therefore covers its decorators, its key and its whole body.

`name` is:

- the member key, when the function's container is a member or property, and
  only when that key is an `Identifier` or a `PrivateIdentifier`. A computed key
  (`[key]`) and a string-literal key (`'key'`) have no name that the tree alone
  can carry, so they produce `null`. A method shorthand `{ a() {} }` has no
  container (§2.2), so it reports `name` `null` and `kind` `anonymous`.
- for an arrow function, the variable it was assigned to
  (`const f = () => {}` gives `f`);
- for a classic function, its declared identifier, and `null` when it has none;
- `null` in every remaining case.

`kind` is:

| Value               | Condition                                                |
| ------------------- | -------------------------------------------------------- |
| `arrow`             | the function is an `ArrowFunctionExpression`             |
| `constructor`       | member kind `constructor`                                |
| `getter` / `setter` | member or property kind `get` / `set`                    |
| `method`            | any other class method or class field holding a function |
| `function`          | a classic function that declares a name                  |
| `anonymous`         | a classic function with no declared name                 |

A member whose container gives no specific kind (`{ f: function () {} }`)
falls back to `function` or `anonymous` by the same rule.

### 2.4 Order of results

Results are sorted by start line, then by start column. The order is total and
deterministic; nested functions appear at the position of their own anchor.

### 2.5 The walk

Every metric of one function is read from a single depth-first walk that starts
at the anchor. Children are visited in source order, and each visited node
contributes in this order:

1. one logical line, if its type is listed in §9.2;
2. its decision score (§3, §4);
3. its logical-sequence score, when it opens a sequence (§5);
4. a recursion note, when it is a self-call (§10);
5. its Halstead tokens (§7).

The walk carries three pieces of state with every node:

| State        | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| `depth`      | the nesting level the node was reached at; the anchor starts at 0     |
| `inSequence` | the node is inside a `&&` / `\|\|` chain that has already been scored |
| `elseIfArm`  | the node is the alternate `if` of another `if`                        |

**Function boundary.** Visiting a node and entering it are different acts. A
node that holds a function is still visited: it counts a logical line if its
type qualifies (§9.2) and writes its own tokens (§7) — the `:` of a property
that holds a method is written from that property. It is not _entered_: unless
it is the anchor or the anchor's own function node, the walk does not descend
past it, so the enclosing function never sees the nested function's statements,
decisions, tokens or depth (§11).

The walk has no edges into type-annotation nodes: a parameter's type, a return
type and a `TSTypeAnnotation` contribute no tokens and no decisions. Type
assertions that are written as expressions (`x!`, `x as T`, `<T>x`) are ordinary
expression nodes and are walked; `x!` additionally writes the `!` token (§7).

## 3. Cyclomatic complexity

The count of independent paths through one function, in the sense of McCabe
(1976). It starts at **1** — the single path a function with no decisions
always has — and every construct in the table below adds **1**.

### 3.1 Constructs that add one

| Construct                                      | Counted as                                               |
| ---------------------------------------------- | -------------------------------------------------------- |
| `if`                                           | one per `if`, including each `else if` in a chain        |
| `for`, `for-in`, `for-of`, `while`, `do-while` | one per loop statement                                   |
| `case`                                         | one per `switch` arm that has a test                     |
| ternary `a ? b : c`                            | one per conditional expression                           |
| `&&`, `\|\|`                                   | one per operator in a logical sequence (§5)              |
| `catch`                                        | one per catch clause, including a binding-less `catch {` |
| `throw`                                        | one per throw statement                                  |

### 3.2 Constructs that add nothing

| Construct                                               | Why                                                                                                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| the `switch (x) {` header                               | it is a dispatch, not a test; the arms carry the branches                                                   |
| `default:`                                              | it is the fall-through, not a decision                                                                      |
| `??`                                                    | a default, not a branch (§5)                                                                                |
| `?.`                                                    | a guard against absence, which has one outcome, not two                                                     |
| `??=`                                                   | in ESTree an assignment, not a logical expression; nothing is chosen at runtime that was not already chosen |
| `break`, `continue`, labelled or not                    | control flow inside one path; only cognitive complexity charges for a labelled jump (§4.6)                  |
| `return`, `yield`, `await`                              | ends or suspends a path, it does not choose one                                                             |
| a function header: `function`, `=>`, the parameter list | a declaration, not a decision                                                                               |
| blocks `{ }`, `try`, `finally`, labels, `;`, `,`        | punctuation and grouping                                                                                    |
| `class`, `extends`, `static`, `import`, `export`        | shape, not control flow                                                                                     |
| a nested function's constructs                          | the nested function is scored on its own (§11)                                                              |

### 3.3 Worked example: `switch`

```ts
function classify(n: number): string {
  switch (n) {
    case 1:
      return 'one';
    case 2:
      return 'two';
    default:
      return 'many';
  }
}
```

| Node           | Cyclomatic |
| -------------- | ---------- |
| base           | 1          |
| `switch (n) {` | +0         |
| `case 1:`      | +1         |
| `case 2:`      | +1         |
| `default:`     | +0         |
| `return` ×3    | +0         |

Result: **cyclomatic 3**.

### 3.4 Worked example: loop, guard, throw

```ts
export function check(values: number[]): boolean {
  for (const value of values) {
    if (value > 0 && value < 10) {
      throw new Error('out of range');
    }
  }
  return values.length > 0;
}
```

| Node                | Cyclomatic |
| ------------------- | ---------- |
| base                | 1          |
| `for-of`            | +1         |
| `if`                | +1         |
| `&&`                | +1         |
| `throw`             | +1         |
| `values.length > 0` | +0         |

Result: **cyclomatic 5**, **cognitive 4** (`for` +1, `if` +1 nesting +1 = +2,
the `&&` sequence +1, `throw` +0), **maxNesting 2**, **logicalLines 5**.

## 4. Cognitive complexity

A measure of how much mental work the nesting of decisions asks for, in the
sense of Campbell (2017). It starts at **0**.

### 4.1 The rule

Each construct in the table adds:

> `1 + depth`, where `depth` is the level the construct was reached at.

A construct reached directly in the function body has depth 0 and adds 1.

### 4.2 What raises the depth of descendants

| Raises depth                                               | Does not raise depth                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `if` (a chain head or a standalone `if`)                   | `else`, `else if`, and everything inside them                   |
| every loop: `for`, `for-in`, `for-of`, `while`, `do-while` | `try` and `finally`                                             |
| ternary `a ? b : c`                                        | plain blocks `{ }`                                              |
| `catch`                                                    | labelled statements, function bodies, logical sequences         |
| `switch`                                                   | `case` arms themselves (their contents are inside the `switch`) |

Depth is inherited: a construct found inside two raising constructs is at depth
2 and adds 3.

### 4.3 `else` and `else if`

An `if` that has a non-`if` alternate — a trailing `else` — adds **one more**
point, flat. An `else if` **continues the chain**: it adds 1, adds no nesting,
and every construct inside it keeps the depth the chain was reached at.

```ts
function grade(score: number): string {
  if (score >= 90) {
    return 'a';
  } else if (score >= 80) {
    return 'b';
  } else if (score >= 70) {
    return 'c';
  } else {
    return 'f';
  }
}
```

| Node                                                               | Cognitive |
| ------------------------------------------------------------------ | --------- |
| first `if` (depth 0, has an `else if` alternate, so no flat extra) | +1        |
| second `if` (chain continuation)                                   | +1        |
| third `if` (chain continuation, has a trailing `else`)             | +1 +1     |
| `return` ×4                                                        | +0        |

Result: **cognitive 4**, **cyclomatic 4**, **maxNesting 1**.

The chain continuation is what keeps a guard ladder flat: three levels of
`else if` cost 4, while three nested `if`s at increasing depth cost 6 (§4.8).

### 4.4 `try` is not structural, `catch` is

`try` and `finally` group statements; they add no depth and no point. The body
of a `try` is read at the depth of the `try` itself. A `catch` is a decision —
which error path runs — so it adds `1 + depth` and raises the depth of its own
body.

This is a deliberate choice. A `try` block contains the statements that would
have run anyway, so nesting them deeper would charge the reader for grouping.
A `catch` body is a second path that only exists when something failed, and it
is the path where recovery logic hides.

Two functions with the same `if`, placed in the two different places:

```ts
function guard(n: number): number {
  // the `if` is inside a `try`
  try {
    if (n > 0) {
      return n;
    }
  } catch {
    return 0;
  }
  return -1;
}
```

| Node               | Cyclomatic | Cognitive |
| ------------------ | ---------- | --------- |
| base               | 1          |           |
| `if` at depth 0    | +1         | +1        |
| `catch` at depth 0 | +1         | +1        |
| **total**          | **3**      | **2**     |

```ts
function report(error: unknown): string {
  // the `if` is inside a `catch`
  try {
    throw error;
  } catch (caught) {
    if (caught instanceof Error) {
      return caught.message;
    }
    return 'unknown';
  }
}
```

| Node               | Cyclomatic | Cognitive |
| ------------------ | ---------- | --------- |
| base               | 1          |           |
| `throw`            | +1         | +0        |
| `catch` at depth 0 | +1         | +1        |
| `if` at depth 1    | +1         | +2        |
| **total**          | **4**      | **3**     |

`maxNesting` is 1 in the first function and 2 in the second. The ternary and
the loop sit on the same footing as `catch`: each is a decision with its own
body.

### 4.5 `switch`

The `switch` statement adds `1 + depth` and raises depth. Each `case` arm adds
**no** cognitive point — the arms are the arms of one decision, not one decision
each — while each non-default arm still adds 1 to cyclomatic complexity (§3.1).
A construct inside an arm is at the `switch`'s depth plus 1.

### 4.6 `throw`, jumps and recursion

| Construct                            | Cognitive | Note                                         |
| ------------------------------------ | --------- | -------------------------------------------- |
| `throw`                              | +0        | charged to cyclomatic complexity only (§3.1) |
| `break` / `continue` with a label    | +1        | flat, and no depth change                    |
| `break` / `continue` without a label | +0        |                                              |
| direct recursion                     | +1, once  | see §10                                      |

### 4.7 Logical sequences

A logical sequence contributes 1 for the first operator and 1 more on each
change of operator (§5). The contribution is flat: it never carries depth,
wherever the chain is written.

### 4.8 The nested-`if` ladder

The canonical shape, and the numbers the rule tests pin:

```ts
export function tier(value: number): number {
  if (value > 0) {
    if (value > 1) {
      if (value > 2) {
        return 3;
      }
    }
  }
  return -1;
}
```

| Levels | Cyclomatic | Cognitive | maxNesting | logicalLines |
| ------ | ---------- | --------- | ---------- | ------------ |
| 1      | 2          | 1         | 1          | 3            |
| 2      | 3          | 3         | 2          | 4            |
| 3      | 4          | 6         | 3          | 5            |
| 4      | 5          | 10        | 4          | 6            |
| 5      | 6          | 15        | 5          | 7            |
| 6      | 7          | 21        | 6          | 8            |

Cognitive complexity is the sum `1 + 2 + … + n`, cyclomatic complexity is
`n + 1`, and depth is the deepest `if`.

## 5. Logical sequences

### 5.1 The rule

A logical sequence is every `&&` and `||` written inside one expression. The
operators are read **left to right as written**, and:

- cyclomatic complexity gains **1 per operator**;
- cognitive complexity gains **1 for the first operator and 1 more on every
  change of operator** — repeating the same operator adjacently costs nothing;
- the contribution is flat: no depth is applied, wherever the chain sits;
- a chain is scored once, at the outermost `&&` / `||` that opened it. A
  nested `&&` / `||` inside an already-scored chain adds nothing further;
- parentheses do not start a new chain.

### 5.2 Source order, not tree order

An expression is a tree, and the tree order is not the source order. `&&` and
`||` bind left, so the outermost operator of `a || b && c || d && e` is the
first `||`, and a preorder walk of the tree reads the operators as
`||, ||, &&, &&` — two runs, one change, and a cognitive cost of 2. The source
reads `||, &&, ||, &&`: an operator change at every position, and a cost of 4.

```ts
function pick(a: number, b: number, c: number, d: number, e: number): number {
  return a || (b && c) || (d && e);
}
```

| Reading                    | Operator sequence          | Cognitive |
| -------------------------- | -------------------------- | --------- |
| source order (correct)     | `\|\|`, `&&`, `\|\|`, `&&` | 4         |
| preorder tree walk (wrong) | `\|\|`, `\|\|`, `&&`, `&&` | 2         |

Result: **cyclomatic 5** (1 base + 4 operators), **cognitive 4**, **maxNesting 0**.

Repeating the same operator is free:

```ts
function allow(a: boolean, b: boolean, c: boolean): boolean {
  return a && b && c;
}
```

Source order is `&&, &&`: one change, **cognitive 1**; cyclomatic is
1 + 2 = **3**. `(a && b) && c` is the same chain and scores the same.
`(a || b) && c` is one change after the first operator and scores
**cognitive 2**.

### 5.3 `??` is never part of a sequence

`??` is a logical expression in the tree but never a branch: it names the value
to use when the left side is absent, which is not a second path through the code.
It is therefore skipped when a chain is flattened, and it can neither raise
cyclomatic complexity nor cognitive complexity — not alone, not inside a chain,
not as `a ?? b ?? c`.

```ts
function pickName(user: { name?: string } | null): string {
  return user?.name ?? 'anonymous';
}
```

| Node | Cyclomatic | Cognitive | Halstead      |
| ---- | ---------- | --------- | ------------- |
| `?.` | +0         | +0        | operator `?.` |
| `??` | +0         | +0        | operator `??` |
| base | 1          |           |               |

Result: **cyclomatic 1**, **cognitive 0**, **maxNesting 0**.

The same function with `||` in place of `??` scores **cyclomatic 2**,
**cognitive 1** — the branch the nullish operator is there to avoid.

Nested the same way, `return a && (b ?? c);` reads as the single-operator
sequence `&&`, giving **cyclomatic 2** and **cognitive 1**.

The distinction is Halstead-only: `??` is a real token that combines two values,
so it is an operator in §7 while being invisible to §3 and §4.

### 5.4 Sequences stop at a nested function

A nested function's own operators are its own business. A chain that reaches
into a nested function stops there; the enclosing function's chain never absorbs
the nested function's `&&` and `||` (§11).

## 6. Maximum nesting depth

`maxNesting` is the deepest level reached by any construct that raises depth,
and **0** when the function has none:

> `maxNesting = max(depth + 1)` over every raising construct (§4.2).

| Raises                                         | Does not raise                          |
| ---------------------------------------------- | --------------------------------------- |
| `if` that starts a chain or stands alone       | `else`, `else if`                       |
| `for`, `for-in`, `for-of`, `while`, `do-while` | `case` arms                             |
| ternary                                        | `try`, `finally`                        |
| `catch`                                        | plain blocks, labels, logical sequences |
| `switch`                                       | `throw`, `break`, `continue`, `return`  |

A chain head raises the depth; its `else if` continuations do not, so
`if / else if / else if / else` reaches depth 1 and not depth 3.

## 7. Halstead measures

Halstead's operator and operand counts (Halstead 1977), read token by token
from the function's own syntax.

### 7.1 Operators

A node writes operator tokens. The full list:

| Written as                           | Tokens                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `a + b`, `a === b`, `a instanceof b` | that operator                                         |
| `a && b`, `a \|\| b`, `a ?? b`       | that operator                                         |
| `a = b`, `a += b`, `a ??= b`         | that operator                                         |
| `!a`, `-a`, `typeof a`               | that operator                                         |
| `a++`, `--a`                         | that operator                                         |
| `(a) => b`                           | `=>`                                                  |
| `a ? b : c`                          | `?` and `:`                                           |
| `a?.b`, `a?.()`                      | `?.`                                                  |
| `await a`                            | `await`                                               |
| `new A()`                            | `new`                                                 |
| `new.target`                         | `new` (`import.meta` writes nothing)                  |
| `function* g() {}`                   | `*` (an ordinary function writes none)                |
| `yield x`, `yield* g()`              | `yield`, plus `*` for a delegating yield              |
| `x!`                                 | `!`                                                   |
| `defaultValue = 1` in a parameter    | `=`                                                   |
| `if`                                 | `if`, plus `else` when the statement has an alternate |
| `switch (x)`                         | `switch`                                              |
| `case x:`                            | `case` and `:`                                        |
| `default:`                           | `:`                                                   |
| `break`, `continue`                  | `break`, `continue`                                   |
| `return`, `throw`                    | `return`, `throw`                                     |
| `catch`                              | `catch`                                               |
| `do { } while (x)`                   | `do` and `while`                                      |
| `while (x)`                          | `while`                                               |
| `for (;;)`                           | `for`                                                 |
| `for (x in y)`                       | `for` and `in`                                        |
| `for (x of y)`, `for await (x of y)` | `for` and `of`, plus `await`                          |
| `{ a: 1 }`                           | `:`                                                   |
| `label: for (…)`                     | `:` (the label name is an operand as well)            |

`??` is here. It combines two values like any other operator, so it is counted
even though it never reaches §3 or §4.

### 7.2 Operands

| Written as                             | Operand                                            |
| -------------------------------------- | -------------------------------------------------- |
| any name                               | the name (`Identifier`, and a JSX name as written) |
| `#field`                               | `#field`                                           |
| `1`, `'text'`, `true`, `false`, `null` | the literal as written, quotes included            |
| `this`                                 | `this`                                             |
| `super`                                | `super`                                            |
| each chunk of a template literal       | the chunk's text                                   |

### 7.3 Constructs that write nothing

Declaration keywords are not operators: they declare a name or a shape rather
than combine or transform a value. `class`, `function`, `var`, `let`, `const`,
`extends`, `static`, `import`, `export`, `as`, `satisfies`, `try` and `finally`
write no token. Neither does a block, a variable declarator, a semicolon, or a
type annotation.

The `:` of a property is written when the property is an initialiser property
that is not shorthand. Three forms, and only the middle one is silent:

| Written as   | `:`         |
| ------------ | ----------- |
| `{ a: 1 }`   | written     |
| `{ a }`      | not written |
| `{ a() {} }` | written     |

So `function p() { return { a: 1 }; }` has one operator more than
`function p() { return { a }; }`, and the method shorthand matches the first
form. The method still scores as its own function (§2.2); the colon is written
by the `Property` around it, which the enclosing walk reaches (§2.5). A getter
or setter property writes none, because its kind is `get` or `set`.

Nested functions write nothing to the enclosing function (§11).

The node that holds a nested function is not part of that rule: a `Property`
or a class member around a nested function is walked and writes its own tokens
all the same (§2.5).

### 7.4 The nine values

With `n1` distinct operators, `n2` distinct operands, `N1` total operator
occurrences and `N2` total operand occurrences:

| Value                      | Formula                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `distinctOperators` (`n1`) | count of distinct operator tokens                          |
| `distinctOperands` (`n2`)  | count of distinct operand tokens                           |
| `totalOperators` (`N1`)    | count of operator token occurrences                        |
| `totalOperands` (`N2`)     | count of operand token occurrences                         |
| `vocabulary`               | `n1 + n2`                                                  |
| `length`                   | `N1 + N2`                                                  |
| `volume`                   | `length × log2(vocabulary)`, or `0` when `vocabulary` is 0 |
| `difficulty`               | `(n1 / 2) × (N2 / n2)`, or `0` when `n2` is 0              |
| `effort`                   | `difficulty × volume`                                      |

A zero denominator yields **0, never `NaN`**: a function with no operands
reports a difficulty of 0, and a signature with no body reports all zeros.

### 7.5 Worked example

```ts
function average(total: number, count: number): number {
  return total / count;
}
```

|           | Tokens                                                         |
| --------- | -------------------------------------------------------------- |
| operators | `return`, `/` → `n1` 2, `N1` 2                                 |
| operands  | `average`, `total`, `count`, `total`, `count` → `n2` 3, `N2` 5 |

`vocabulary` 5, `length` 7, **volume 16.2535**, **difficulty 1.6667**,
**effort 27.0892**. With cyclomatic 1 and 3 lines, the maintainability index is
**80.9785** (§8). The `: number` annotations contribute nothing: the walk has no
edge into type nodes.

A class member counts its key, because the key is inside the anchor:

```ts
class Ledger {
  add(amount: number): void {
    this.total += amount;
  }
}
```

Operators: `+=` → `n1` 1, `N1` 1. Operands: `add` (the key), `amount` (the
parameter), `this`, `total`, `amount` → `n2` 4, `N2` 5. `vocabulary` 5,
`length` 6, **volume 13.9316**, **difficulty 0.625**, **effort 8.7072**,
maintainability index **81.4473** over 3 lines.

## 8. Maintainability index

The index of Coleman, Ash, Lowther and Oman (1994), over this function's own
Halstead volume, its cyclomatic complexity and its physical line count:

```
MI = ((171 − 5.2 · ln(max(volume, 1)) − 0.23 · cyclomatic − 16.2 · ln(max(lines, 1))) × 100) / 171
```

- `volume` and `lines` are floored at 1 before the logarithm, so a function with
  no volume, and a function on one line, both stay finite.
- The result is clamped into `0 … 100`.
- The comparison against a threshold uses the raw value. Nothing is rounded;
  figures in this document are rounded for display only.

**No comment weighting.** The published variant multiplies the volume by a
comment share, so that heavily commented code scores as more maintainable. This
specification does not. Comments are not an input to the engine, and a
percentage that a codebase can raise by writing comments is not a measure of
maintainability. A function's index is decided by what its code says.

### Worked example

```ts
export function tally(items: number[]): number {
  let total = 0;
  for (const item of items) {
    if (item > 0) {
      total += item;
    } else {
      total -= 1;
    }
  }
  return total;
}
```

| Field                  | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| `lines`                | 11                                                                    |
| `logicalLines`         | 7                                                                     |
| `parameters`           | 1                                                                     |
| `cyclomatic`           | 3                                                                     |
| `cognitive`            | 4                                                                     |
| `maxNesting`           | 2                                                                     |
| `recursive`            | false                                                                 |
| Halstead operators     | `for`, `of`, `if`, `else`, `>`, `+=`, `-=`, `return` → `n1` 8, `N1` 8 |
| Halstead operands      | `tally`, `items`, `total`, `item`, `0`, `1` → `n2` 6, `N2` 13         |
| `volume`               | 79.9545                                                               |
| `difficulty`           | 8.6667                                                                |
| `effort`               | 692.9386                                                              |
| `maintainabilityIndex` | 63.5559                                                               |

The cognitive score reads `for` +1 and `if` +2, because the `if` is at depth 1.
The `else` costs the `if` a flat point rather than a level.

## 9. Size

### 9.1 `lines`

The number of physical lines the function's span covers:

```
lines = span.end.line − span.start.line + 1
```

Every line inside the span counts: blank lines, comment lines, the signature,
and the closing brace. For a class member the span is the member's, so a method
counts from its first decorator or key to its closing brace.

### 9.2 `logicalLines`

The number of statements that do something, counted as one per node visited
whose type is in this list:

```
VariableDeclaration   ExpressionStatement   IfStatement
ForStatement          ForInStatement        ForOfStatement
WhileStatement        DoWhileStatement      SwitchStatement
SwitchCase            CatchClause           BreakStatement
ContinueStatement     ReturnStatement       ThrowStatement
```

Each occurrence counts once. In particular:

- `const` written in a `for` header is a `VariableDeclaration` and counts;
- an `if` and its `else`, and a `switch` and its arms, each count once;
- a `try`, a `finally` and a bare block count nothing;
- a nested function's statements count for the nested function, never for the
  enclosing one.

For the `tally` function in §8: `let total = 0;`, the `for`, the `const item`,
the `if`, `total += item;`, `total -= 1;`, `return total;` — **7**.

### 9.3 `parameters`

The number of entries in the function's own parameter list. A parameter with a
default value, a rest parameter and a destructuring pattern each count once:

```ts
function configure({ host, port }, [origin] = [], ...rest) {}
```

**parameters 3**.

Any bodyless declaration (§12) reports **0**.

## 10. Recursion

`recursive` is true when the function calls itself by name, and false
otherwise.

The call must be the bare declared name, or `this.<name>`:

```ts
function fact(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * fact(n - 1);
}
```

`recursive` is **true**, **cognitive 2** (the `if` at depth 0, plus one for the
cycle), **cyclomatic 2**.

- Only the first self-call is noted. One function that calls itself ten times
  pays one point, because reading the same cycle twice costs the reader no more
  than reading it once.
- `super.<name>()` is not self-recursion: it dispatches to the parent class.
- A call on any other receiver — `other.fact()`, `helpers.fact()` — is a call
  on a different object.
- A function with no name — an IIFE, a bare callback — has no name to call
  itself by and is never reported recursive. An arrow bound to a variable
  carries that name, and can be.

**Indirect and mutual recursion are not detected**, and this is a limitation of
the model rather than an oversight. Deciding that `a()` called by `f()` is a
cycle requires resolving what `a` binds to: a symbol table, an import graph, a
type checker, and files this analysis never sees. One file's syntax cannot
answer it, so the engine reports what it can prove and claims nothing beyond it.

## 11. Nested functions

Every function is scored on its own. A nested function's syntax — its
statements, decisions, tokens, logical lines and depth — is invisible to the
function around it, and it appears in the result as its own entry.

The node holding the nested function is not excluded: a `Property` or a class
member around it is still walked and still writes its own tokens (§2.5).

```ts
function total(items: number[]): number {
  const sum = items.reduce((acc, value) => {
    if (value > 0) {
      return acc + value;
    }
    return acc;
  }, 0);
  return sum;
}
```

| Function  | Cyclomatic | Cognitive | maxNesting | logicalLines | Halstead                                     |
| --------- | ---------- | --------- | ---------- | ------------ | -------------------------------------------- |
| `total`   | 1          | 0         | 0          | 2            | `vocabulary` 6, `length` 8, `volume` 20.6797 |
| the arrow | 2          | 1         | 1          | 3            | `vocabulary` 8, `length` 13, `volume` 39     |

`total`'s Halstead count contains none of the arrow's identifiers and none of
its `if`; the arrow's count contains none of `total`'s. The arrow's `if` cannot
raise `total`'s depth, and the arrow's `return`s are not `total`'s logical lines.

`total` spans 9 lines and takes 1 parameter. The arrow is its own entry: its
span runs from line 2 to line 7, so 6 lines, and it takes 2 parameters.

The same boundary applies to a function expression in a default value, an
object-literal method, a class field holding an arrow, a callback passed to a
call, and a comparator passed to `sort`.

## 12. Bodyless declarations

A declaration that states a shape and not a behaviour has no body to measure:
`declare function`, an overload signature, an abstract method, an abstract
class field, and any `TSDeclareFunction` or `TSEmptyBodyFunctionExpression`.

Such a declaration is reported with its `name`, `kind` and `span` — so a
diagnostic can point at it — and with **every metric at its empty value**:

| Field                  | Value                            |
| ---------------------- | -------------------------------- |
| `lines`                | 0                                |
| `logicalLines`         | 0                                |
| `parameters`           | 0                                |
| `cyclomatic`           | 0                                |
| `cognitive`            | 0                                |
| `maxNesting`           | 0                                |
| `halstead`             | every value 0 (`EMPTY_HALSTEAD`) |
| `maintainabilityIndex` | 0                                |
| `recursive`            | false                            |

A signature declares a contract; it does not implement one. Counting its
parameters and header lines would report work that was never written, and a
cyclomatic complexity of 1 would read as a measured function. `parameters` is 0
even where the signature lists parameters: the count belongs to a function that
can be called.

## 13. Output

| Field                  | Type                                                 | Defined in |
| ---------------------- | ---------------------------------------------------- | ---------- |
| `name`                 | `string \| null`                                     | §2.3       |
| `kind`                 | `FunctionKind`                                       | §2.3       |
| `span`                 | `{ start: { line, column }, end: { line, column } }` | §2.3       |
| `lines`                | `number`                                             | §9.1       |
| `logicalLines`         | `number`                                             | §9.2       |
| `parameters`           | `number`                                             | §9.3       |
| `cyclomatic`           | `number`                                             | §3         |
| `cognitive`            | `number`                                             | §4         |
| `maxNesting`           | `number`                                             | §6         |
| `halstead`             | `HalsteadMetrics`                                    | §7         |
| `maintainabilityIndex` | `number`                                             | §8         |
| `recursive`            | `boolean`                                            | §10        |

Integer metrics are exact. `volume`, `difficulty`, `effort` and
`maintainabilityIndex` are IEEE-754 doubles, computed as written and not
rounded. A consumer compares them against a threshold with `<` or `>` on the
raw value.

## 14. Detecting a wrong implementation

Six rules are easy to get wrong in a way that produces plausible numbers. Each
has one input that settles it.

| Rule                                | Input                                            | Correct                                                  | Wrong implementations give                          |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `??` is not a branch                | `return user?.name ?? 'anonymous';`              | cyclomatic 1, cognitive 0                                | 2 and 1, when `??` is treated as `\|\|`             |
| Sequences are read in source order  | `return a \|\| b && c \|\| d && e;`              | cognitive 4                                              | 2, from a preorder tree walk                        |
| `try` is not structural, `catch` is | `if` inside `try` vs `if` inside `catch`         | cognitive 2 / maxNesting 1 vs cognitive 3 / maxNesting 2 | 3 and 2 both times, or 1 and 2                      |
| A `switch` header costs nothing     | `switch` with two cases and a `default`          | cyclomatic 3                                             | 4 or 5, when the header or the `default` is charged |
| A nested function stands alone      | `outer` wrapping an arrow with an `if`           | outer: cyclomatic 1, cognitive 0, logicalLines 2         | 2, 1 and 5, when the arrow is walked into           |
| A property colon is written         | `{ a: 1 }` against `{ a }`, against `{ a() {} }` | `:` on the first and the third, none on the second       | none on the first, or one on the shorthand          |

Two further readings worth stating outright, because they are easy to assume
wrong:

- `break` and `continue` add nothing to cyclomatic complexity; only a **labelled**
  jump adds a cognitive point.
- `throw` adds 1 to cyclomatic complexity and **0** to cognitive complexity.

## 15. References

- T. J. McCabe, "A Complexity Measure", _IEEE Transactions on Software
  Engineering_, SE-2(4), 1976, pp. 308–320.
- G. A. Campbell, "Cognitive Complexity: A New Way of Measuring
  Understandability", SonarSource SA white paper, 2017.
- M. H. Halstead, _Elements of Software Engineering_, Elsevier, 1977.
- D. Coleman, D. Ash, B. Lowther, P. Oman, "Using Metrics to Evaluate Software
  System Maintainability", _IEEE Computer_, 27(8), 1994, pp. 44–49.
