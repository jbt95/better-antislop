# Metrics

Normative specification entry point for every value the metric engine emits for one function.

The engine turns one ESTree `Program` into `ProgramMetrics`: a list of
`FunctionMetrics`, one per function found in that program. Every field is defined
by this page or its linked metric pages. An implementation that follows the
complete normative specification and is fed the same tree produces the same numbers.

`docs/metrics.md` is the stable specification path used by
`test/fixtures/metrics/expected.json`. Sections 1–2 define shared sources and
the analysis model. The linked pages complete its normative specification.

| Sections | Topic                                                                                     | Page                                                  |
| -------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 3–6      | Cyclomatic complexity, cognitive complexity, logical sequences, and maximum nesting depth | [docs/complexity.md](complexity.md)                   |
| 7–8      | Halstead measures and maintainability index                                               | [docs/halstead.md](halstead.md)                       |
| 9–13     | Size, recursion, nested functions, bodyless declarations, and output                      | [docs/function-metrics.md](function-metrics.md)       |
| 14–15    | Wrong-implementation cases and references                                                 | [docs/metric-verification.md](metric-verification.md) |

## 1. Sources

| Metric                           | Origin                                  |
| -------------------------------- | --------------------------------------- |
| Cyclomatic complexity            | McCabe 1976                             |
| Cognitive complexity             | Campbell 2017 (SonarSource white paper) |
| Halstead measures                | Halstead 1977                           |
| Maintainability index            | Coleman, Ash, Lowther and Oman 1994     |
| Lines, logical lines, parameters | this specification                      |

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
  in the maintainability index ([§8](halstead.md#8-maintainability-index)).
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
enclosing walk visits it, takes the `:` it writes ([§7.3](halstead.md#73-constructs-that-write-nothing)) and reads its key, then
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

1. one logical line, if its type is listed in [§9.2](function-metrics.md#92-logicallines);
2. its decision score ([§3](complexity.md#3-cyclomatic-complexity), [§4](complexity.md#4-cognitive-complexity));
3. its logical-sequence score, when it opens a sequence ([§5](complexity.md#5-logical-sequences));
4. a recursion note, when it is a self-call ([§10](function-metrics.md#10-recursion));
5. its Halstead tokens ([§7](halstead.md#7-halstead-measures)).

The walk carries three pieces of state with every node:

| State        | Meaning                                                               |
| ------------ | --------------------------------------------------------------------- |
| `depth`      | the nesting level the node was reached at; the anchor starts at 0     |
| `inSequence` | the node is inside a `&&` / `\|\|` chain that has already been scored |
| `elseIfArm`  | the node is the alternate `if` of another `if`                        |

**Function boundary.** Visiting a node and entering it are different acts. A
node that holds a function is still visited: it counts a logical line if its
type qualifies ([§9.2](function-metrics.md#92-logicallines)) and writes its own tokens
([§7](halstead.md#7-halstead-measures)) — the `:` of a property
that holds a method is written from that property. It is not _entered_: unless
it is the anchor or the anchor's own function node, the walk does not descend
past it, so the enclosing function never sees the nested function's statements,
decisions, tokens or depth ([§11](function-metrics.md#11-nested-functions)).

The walk has no edges into type-annotation nodes: a parameter's type, a return
type and a `TSTypeAnnotation` contribute no tokens and no decisions. Type
assertions that are written as expressions (`x!`, `x as T`, `<T>x`) are ordinary
expression nodes and are walked; `x!` additionally writes the `!` token ([§7](halstead.md#7-halstead-measures)).

**Local enums.** A local enum lies inside its function's source tree, so its
identifier and body are walked. Each member contributes its identifier and
explicit initializer, if any. No synthetic value is added for a member without
an initializer. The analyzer follows parsed syntax and does not type-check or
perform TypeScript emit analysis.

Namespace declarations are containers during function discovery. The metrics
walk starts at each function's anchor, so a namespace name or its surrounding
body does not contribute to a function declared inside that namespace.
