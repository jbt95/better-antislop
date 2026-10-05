import { describeRule } from '../support/rule-tester.ts';
import { match } from '../support/rule-spec.ts';

/**
 * `no-object-parameters`.
 *
 * `object` is reported wherever it can be reached from the written type:
 * directly, inside a union, inside a container, or through an alias declared
 * in the same file.
 */
const REPORTED = {
  message: match(
    /^A parameter typed `object` accepts every non-primitive value, so this function can read any property it names and the compiler will not stop it\./,
  ),
};

describeRule({
  plugin: 'better-antislop',
  rule: 'no-object-parameters',
  cases: {
    valid: [
      {
        name: 'a named parameter type says what the body needs',
        code: 'function total(order: Order): number {\n  return order.price;\n}',
      },
      {
        name: 'a type literal names its fields',
        code: 'function total(order: { price: number }): number {\n  return order.price;\n}',
      },
      {
        name: 'no annotation at all is left to the caller',
        code: 'function total(order) {\n  return order;\n}',
      },
      {
        name: 'a union of named types is not `object`',
        code: 'function total(order: Paid | Draft): number {\n  return order.price;\n}',
      },
    ],
    invalid: [
      {
        name: 'a plain `object` parameter',
        code: 'function read(value: object): unknown {\n  return value;\n}',
        errors: [REPORTED],
      },
      {
        name: 'a union that contains `object`',
        code: 'function read(value: object | null): unknown {\n  return value;\n}',
        errors: [REPORTED],
      },
      {
        name: 'a container of `object`',
        code: 'function read(values: object[]): unknown {\n  return values;\n}',
        errors: [REPORTED],
      },
      {
        name: 'an alias declared in this file',
        code: 'type Opaque = object;\n\nfunction read(value: Opaque): unknown {\n  return value;\n}',
        errors: [REPORTED],
      },
      {
        name: 'an arrow function parameter',
        code: 'const read = (value: object): unknown => value;',
        errors: [REPORTED],
      },
      {
        name: 'a bodyless declaration is still a parameter position',
        code: 'declare function read(value: object): unknown;',
        errors: [REPORTED],
      },
      {
        name: 'each offending parameter is reported once',
        code: 'function read(first: object, second: object): unknown {\n  return first ?? second;\n}',
        errors: [REPORTED, REPORTED],
      },
    ],
  },
});
