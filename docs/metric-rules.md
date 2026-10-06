# Metric rules

## Rules

Every rule uses the `better-antislop/` prefix. This repository's configuration
enables three metric rules and five vendored rules. The other eighteen vendored
rules are opt-in. See [Vendored rules](vendored-rules.md).

| Group                         | Count | On in this repository |
| ----------------------------- | ----: | --------------------- |
| Metric rules                  |     3 | yes                   |
| Vendored rules enabled here   |     5 | yes                   |
| Vendored rules, opt-in        |    13 | no                    |
| Vendored Effect rules, opt-in |     5 | no                    |

### Metric rules — written here

| Rule                        | Reports                                           | Option      | Default | On here |
| --------------------------- | ------------------------------------------------- | ----------- | ------- | ------- |
| `cognitive-complexity`      | A function whose cognitive complexity is too high | `{ limit }` | `15`    | `15`    |
| `max-nesting-depth`         | A function whose deepest nesting is too deep      | `{ limit }` | `4`     | `4`     |
| `min-maintainability-index` | A function whose maintainability index is too low | `{ limit }` | `65`    | `50`    |

Every rule takes one object option, `limit`. All three are optional; omitting the
option object uses the default.

These are the rule defaults in package metadata, and the plugin uses them
unchanged. Linting its own source, `oxlint.config.ts` lowers only
`min-maintainability-index`, to `50`: the default `65` is calibrated for whole
modules and collapses into a length test on a single function. See
[AGENTS.md](../AGENTS.md).

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
function has none. `{value}` is the measured metric. Integers print as strings
without decimal places. Floating-point values use JavaScript's shortest
round-tripping `String(value)` form.

#### `cognitive-complexity`

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

#### `max-nesting-depth`

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

#### `min-maintainability-index`

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

#### What the metric engine measures

The three rules read from one shared metric engine, so they cannot disagree with
each other. The engine computes, per function, from that function's own syntax:
cyclomatic complexity, cognitive complexity, maximum nesting, Halstead measures
(volume, vocabulary, difficulty, effort), the maintainability index, logical
line count, parameter count, physical line count and direct self-recursion.
