# Vendored rules

## Vendored rules enabled in this repository — written upstream

These five replace rules this package used to implement itself. They now come
from `vendor/anti-slop/`, so their behaviour, their messages and their options
are upstream's, not ours.

| Rule                                        | Reports                                                                 | Option                  | Default      | On here                   |
| ------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- | ------------ | ------------------------- |
| `no-chained-type-assertions`                | A chained assertion, which discards the type evidence in the first link | none                    | —            | `error`                   |
| `require-safety-comment-for-type-assertion` | An `as T` or `<T>value` with no written justification                   | `{ markers }`           | `['SAFETY']` | `error`                   |
| `no-runtime-typeof`                         | `typeof` used as ad hoc narrowing instead of boundary decoding          | `{ allowInTypeGuards }` | `false`      | `allowInTypeGuards: true` |
| `no-unknown-parameters`                     | A parameter typed `unknown`, directly or through a local alias          | none                    | —            | `error`                   |
| `no-object-parameters`                      | A parameter typed `object`, directly or through a local alias           | none                    | —            | `error`                   |

### `no-chained-type-assertions`

A chain launders a type. The compiler cannot see what happened between the first
assertion and the second, and neither can the next reader. Angle-bracket
assertions and parenthesized chains are covered too.

```ts
// reported
const config = JSON.parse(raw) as unknown as Config;
```

```ts
// accepted: narrow once with a type guard
function isConfig(value: unknown): value is Config {
  return typeof value === 'object' && value !== null && 'port' in value;
}

const parsed: unknown = JSON.parse(raw);
if (!isConfig(parsed)) {
  throw new Error('invalid config');
}
const config: Config = parsed;
```

Chains made only of `as const` are allowed, because they narrow inference without
discarding type evidence.

### `require-safety-comment-for-type-assertion`

Every `as T` and every `<T>value` needs a justification, written as a comment
immediately before the assertion or before its containing statement.

```ts
// reported: no justification
const config = JSON.parse(raw) as Config;
```

```ts
// accepted
// SAFETY: the caller validates the payload against the config schema.
const config = JSON.parse(raw) as Config;
```

`as const` never needs a justification. The marker is an array, so several
prefixes can be accepted at once: `{ "markers": ["SAFETY", "HACK"] }`.

### `no-runtime-typeof`

`typeof` narrows a representation without establishing a contract. Decode the
value once, at the boundary where it enters, then branch on the domain.

```ts
// reported
if (typeof value === 'string') {
  return value.toUpperCase();
}
```

```ts
// accepted: decode once, at the boundary, then trust the type
function readText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const text = readText(value);
if (text !== undefined) {
  return text.toUpperCase();
}
```

A comparison against the string `"undefined"` is allowed as an existence probe:

```ts
if (typeof document === 'undefined') {
  return null;
}
```

Set `{ "allowInTypeGuards": true }` to permit `typeof` inside a function whose
declared return type is a TypeScript type predicate, because that signature is
where the check belongs. This repository sets it.

### `no-unknown-parameters`

`unknown` in a parameter position spreads the problem to every caller. Parse it
once, at the boundary, then pass the parsed type.

```ts
// reported
function render(input: unknown): string {
  return String(input);
}
```

```ts
// accepted: parse at the boundary, then pass the parsed type
function render(input: string): string {
  return input.toUpperCase();
}
```

Two positions are exempt and the exemptions are not configurable: the parameter
named `cause`, because that is what an error cause is, and the exact subject of
a type predicate, because narrowing is the point there. The rule takes no options.

### `no-object-parameters`

`object` is `any` with better manners. It accepts everything and tells the reader
nothing.

```ts
// reported
function save(value: object) {}
```

Use an interface, a `Record` with a known value type, or a discriminated union:

```ts
interface SaveOptions {
  readonly dryRun?: boolean;
}

function save(options: SaveOptions) {}
```

## Vendored rules, opt-in — written upstream

Exported and documented. Enabled nowhere in this repository, in this plugin's
config, or in any fixture. Turn one on by naming it.

| Rule                                 | Reports                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `no-array-filter-map`                | Adjacent eager `filter`/`map` passes, which build an intermediate array                             |
| `no-reduce-accumulator-copy`         | Copying a growing reducer accumulator on every iteration, which can cost quadratic work             |
| `no-conditional-empty-object-spread` | An object spread that omits a field by conditionally spreading `{}`                                 |
| `no-known-value-widening`            | A known expression flowing into `unknown`, `object` or an open dictionary, discarding the evidence  |
| `no-module-mocking`                  | Vitest and Jest `mock`/`doMock`/`unstable_mockModule`; tests should use real seams                  |
| `no-reflect-apply`                   | `Reflect.apply`, in favour of a typed call or an interface                                          |
| `no-reflect-get`                     | `Reflect.get`, in favour of typed property access or boundary parsing                               |
| `no-shape-in-symbol-names`           | The case-insensitive substring `shape` in a locally owned symbol name                               |
| `no-unknown-returns`                 | A declared return contract that resolves to `unknown`, `Promise<unknown>` or `PromiseLike<unknown>` |
| `no-unknown-type-aliases`            | A type alias that resolves to `unknown`                                                             |
| `no-unsafe-dictionary-type`          | A dictionary value type of `unknown`, `any`, `object` or `{}`                                       |
| `no-widen-then-assert`               | Widening a known local to a broad type and asserting it back to a narrower one                      |
| `require-readable-spacing`           | Missing blank lines between top-level declarations and logical statement groups                     |

None of these takes options. `require-readable-spacing` is the only rule in the
whole plugin that offers a fix, and the fix is whitespace-only.

## Vendored Effect rules, opt-in — written upstream

These five rules inspect syntax only. They do not require Effect types or an
Effect import in your source; they match on syntax already used in Effect code.

| Rule                             | Reports                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `no-manual-effect-error-tag`     | A manual `_tag` discrimination inside a broad `Effect.catch`/`catchAll`/`catchIf`  |
| `no-manual-tag-comparison`       | A direct `_tag` comparison or switch, in favour of `Match` or `Predicate.isTagged` |
| `no-manual-tagged-construction`  | A hand-written `_tag` property, in favour of `Data.taggedEnum` or a tagged class   |
| `no-service-constructor-imports` | A relative `make<CapabilityName>` import outside a `*.test.*` or `*.spec.*` file   |
| `prefer-effect-match`            | Chained literal ternaries over one value, in favour of `Match`                     |

None of these takes options.
