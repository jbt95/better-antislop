# Function metrics

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

For the `tally` function in [§8](halstead.md#8-maintainability-index): `let total = 0;`, the `for`, the `const item`,
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
member around it is still walked and still writes its own tokens ([§2.5](metrics.md#25-the-walk)).

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

| Field                  | Type                                                 | Defined in                                  |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `name`                 | `string \| null`                                     | [§2.3](metrics.md#23-anchor-name-kind-span) |
| `kind`                 | `FunctionKind`                                       | [§2.3](metrics.md#23-anchor-name-kind-span) |
| `span`                 | `{ start: { line, column }, end: { line, column } }` | [§2.3](metrics.md#23-anchor-name-kind-span) |
| `lines`                | `number`                                             | §9.1                                        |
| `logicalLines`         | `number`                                             | §9.2                                        |
| `parameters`           | `number`                                             | §9.3                                        |
| `cyclomatic`           | `number`                                             | [§3](complexity.md#3-cyclomatic-complexity) |
| `cognitive`            | `number`                                             | [§4](complexity.md#4-cognitive-complexity)  |
| `maxNesting`           | `number`                                             | [§6](complexity.md#6-maximum-nesting-depth) |
| `halstead`             | `HalsteadMetrics`                                    | [§7](halstead.md#7-halstead-measures)       |
| `maintainabilityIndex` | `number`                                             | [§8](halstead.md#8-maintainability-index)   |
| `recursive`            | `boolean`                                            | §10                                         |

Integer metrics are exact. `volume`, `difficulty`, `effort` and
`maintainabilityIndex` are IEEE-754 doubles, computed as written and not
rounded. A consumer compares them against a threshold with `<` or `>` on the
raw value.
