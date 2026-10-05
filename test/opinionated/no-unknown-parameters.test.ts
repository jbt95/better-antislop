import { describeRule } from '../support/rule-tester.ts';
import { match } from '../support/rule-spec.ts';

/**
 * `no-unknown-parameters`.
 *
 * Two exceptions survive by design and are pinned here: the conventional
 * error-cause parameter, and the parameter a type predicate narrows.
 */
const REPORTED = {
  message: match(
    /^A parameter typed `unknown` carries no evidence: every read of it inside this function guesses, and nothing ever confirms the guess\./,
  ),
};

describeRule({
  plugin: 'better-antislop',
  rule: 'no-unknown-parameters',
  cases: {
    valid: [
      {
        name: 'a named parameter type says what the body needs',
        code: 'function total(order: Order): number {\n  return order.price;\n}',
      },
      {
        name: 'no annotation at all is left to the caller',
        code: 'function total(order) {\n  return order;\n}',
      },
      {
        name: 'the conventional cause parameter is exempt',
        code: 'function fail(message: string, cause: unknown): never {\n  throw new Error(message, { cause });\n}',
      },
      {
        name: 'a configured name replaces the exemption list',
        code: 'function decode(body: Text, context: unknown): Text {\n  return body;\n}',
        options: [{ allowedNames: ['context'] }],
      },
      {
        name: 'the parameter a predicate narrows is exempt',
        code: "function isText(value: unknown): value is string {\n  return typeof value === 'string';\n}",
      },
      {
        name: 'an assertion predicate exempts its subject too',
        code: "function assertText(value: unknown): asserts value is string {\n  if (typeof value !== 'string') throw new Error('no');\n}",
      },
    ],
    invalid: [
      {
        name: 'a plain `unknown` parameter',
        code: 'function read(value: unknown): unknown {\n  return value;\n}',
        errors: [REPORTED],
      },
      {
        name: 'a container of `unknown`',
        code: 'function read(values: unknown[]): unknown {\n  return values;\n}',
        errors: [REPORTED],
      },
      {
        name: 'an alias declared in this file',
        code: 'type Raw = unknown;\n\nfunction read(value: Raw): unknown {\n  return value;\n}',
        errors: [REPORTED],
      },
      {
        name: 'an arrow function parameter',
        code: 'const read = (value: unknown): unknown => value;',
        errors: [REPORTED],
      },
      {
        name: 'a bodyless declaration is still a parameter position',
        code: 'declare function read(value: unknown): unknown;',
        errors: [REPORTED],
      },
      {
        name: 'a configured name no longer exempts the default one',
        code: 'function read(context: unknown): unknown {\n  return context;\n}',
        options: [{ allowedNames: ['body'] }],
        errors: [REPORTED],
      },
      {
        name: 'a predicate exempts only its own subject',
        code: "function isText(value: unknown, other: unknown): value is string {\n  return typeof other === 'string';\n}",
        errors: [REPORTED],
      },
    ],
  },
});
