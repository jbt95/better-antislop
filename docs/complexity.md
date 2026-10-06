# Complexity and control-flow metrics

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
| a nested function's constructs                          | the nested function is scored on its own ([§11](function-metrics.md#11-nested-functions))                   |

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
| direct recursion                     | +1, once  | see [§10](function-metrics.md#10-recursion)  |

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
so it is an operator in [§7](halstead.md#7-halstead-measures) while being invisible to §3 and §4.

### 5.4 Sequences stop at a nested function

A nested function's own operators are its own business. A chain that reaches
into a nested function stops there; the enclosing function's chain never absorbs
the nested function's `&&` and `||` ([§11](function-metrics.md#11-nested-functions)).

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
