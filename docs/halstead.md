# Halstead and maintainability metrics

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
even though it never reaches [§3](complexity.md#3-cyclomatic-complexity) or [§4](complexity.md#4-cognitive-complexity).

### 7.2 Operands

| Written as                             | Operand                                            |
| -------------------------------------- | -------------------------------------------------- |
| any name                               | the name (`Identifier`, and a JSX name as written) |
| `#field`                               | `#field`                                           |
| `1`, `'text'`, `true`, `false`, `null` | the literal as written, quotes included            |
| `this`                                 | `this`                                             |
| `super`                                | `super`                                            |
| each chunk of a template literal       | the chunk's text                                   |

For a template quasi, the operand is its cooked text when that value is present.
If the parser reports no cooked value, use the raw source text instead. This
rule applies to tagged and untagged templates; a tagged template's tag
expression is also walked as an ordinary expression.

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
form. The method still scores as its own function ([§2.2](metrics.md#22-what-counts-as-a-function)); the colon is written
by the `Property` around it, which the enclosing walk reaches ([§2.5](metrics.md#25-the-walk)). A getter
or setter property writes none, because its kind is `get` or `set`.

A shorthand property's key and value may be two identifier nodes in the parsed
tree, but `{ a }` writes one name token, so it contributes one operand
occurrence. A shorthand default such as `{ a = fallback }` also writes `a` once;
its `=` operator and `fallback` expression are counted normally.

Nested functions write nothing to the enclosing function ([§11](function-metrics.md#11-nested-functions)).

The node that holds a nested function is not part of that rule: a `Property`
or a class member around a nested function is walked and writes its own tokens
all the same ([§2.5](metrics.md#25-the-walk)).

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
**80.9785** ([§8](halstead.md#8-maintainability-index)). The `: number` annotations contribute nothing: the walk has no
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
