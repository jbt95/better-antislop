import { describeRule } from '../support/rule-tester.ts';
import { match } from '../support/rule-spec.ts';

/**
 * `no-runtime-typeof-narrowing`.
 *
 * An existence probe is a statement about the platform rather than about a
 * value, so `typeof document === 'undefined'` is the narrow exception the rule
 * allows. The operand has to be a binding the program did not define: the same
 * comparison against a local, a parameter or an import is a representation
 * check on a value the program owns, and it is reported. The other exception,
 * a function whose own signature is a type predicate, is off by default and
 * configured per project.
 */
const REPORTED = {
  message: match(
    /^This comparison branches on how a value happens to be represented at run time, so every branch below reads a type the data never promised\./,
  ),
};

describeRule({
  plugin: 'better-antislop',
  rule: 'no-runtime-typeof-narrowing',
  cases: {
    valid: [
      {
        name: 'an existence probe asks whether a platform global is there',
        code: "if (typeof document === 'undefined') {\n  return;\n}",
      },
      {
        name: 'the same probe written as a strict inequality',
        code: "if (typeof window !== 'undefined') {\n  return;\n}",
      },
      {
        name: 'a name no environment lists still asks about something outside the program',
        code: "if (typeof structuredClone !== 'undefined') {\n  return;\n}",
      },
      {
        name: 'a comparison with no `typeof` in it is not this rule',
        code: "if (version === '2') {\n  return;\n}",
      },
      {
        name: 'the configured exception allows a check inside a predicate',
        code: "function isText(value: unknown): value is string {\n  return typeof value === 'string';\n}",
        options: [{ allowInTypePredicateFunctions: true }],
      },
    ],
    invalid: [
      {
        name: 'comparing a value against its representation tag',
        code: "if (typeof value === 'string') {\n  use(value);\n}",
        errors: [REPORTED],
      },
      {
        name: 'the same check written as a strict inequality',
        code: "if (typeof value !== 'number') {\n  use(value);\n}",
        errors: [REPORTED],
      },
      {
        name: 'the predicate exception is off unless it is configured',
        code: "function isText(value: unknown): value is string {\n  return typeof value === 'string';\n}",
        errors: [REPORTED],
      },
      {
        name: 'each representation check is reported',
        code: "if (typeof left === 'string') {\n  use(left);\n}\nif (typeof right === 'number') {\n  use(right);\n}",
        errors: [REPORTED, REPORTED],
      },
      {
        name: 'the absent tag on a parameter is a representation check, not a probe',
        code: "function report(value: unknown) {\n  if (typeof value === 'undefined') {\n    use(value);\n  }\n}",
        errors: [REPORTED],
      },
      {
        name: 'the absent tag on a local the program defined is still a value check',
        code: "const missing = lookup();\nif (typeof missing === 'undefined') {\n  return;\n}",
        errors: [REPORTED],
      },
      {
        name: 'the absent tag on an imported binding is still a value check',
        code: "import { helper } from './helper.ts';\nif (typeof helper === 'undefined') {\n  return;\n}",
        errors: [REPORTED],
      },
      {
        name: 'a probe through a binding the program holds is a value check',
        code: "const holder: { missing?: unknown } = {};\nif (typeof holder.missing === 'undefined') {\n  return;\n}",
        errors: [REPORTED],
      },
    ],
  },
});
