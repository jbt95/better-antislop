import { describeRule } from '../support/rule-tester.ts';
import { INDEX_ABOVE_THE_LIMIT, INDEX_BELOW_THE_LIMIT } from '../support/fixtures.ts';

/**
 * `min-maintainability-index`, which ships with a limit of 65.
 *
 * The index is the one float metric, so this is also where the printed value
 * has to stay truthful: the rule compares with `<`, and a printed value that
 * rounds up onto the limit would leave the message claiming a function is
 * below a limit it equals.
 */
describeRule({
  plugin: 'better-antislop',
  rule: 'min-maintainability-index',
  cases: {
    valid: [
      {
        name: 'a three line function scores far above the limit',
        code: 'export function double(n: number): number {\n  return n * 2;\n}',
      },
      {
        name: 'a bodyless declaration is never an index violation',
        code: 'export declare function parse(input: string): number;',
      },
      {
        name: 'a function scoring exactly the limit is allowed',
        code: INDEX_ABOVE_THE_LIMIT,
        options: [{ limit: 65.40859757045058 }],
      },
      {
        name: 'a lowered limit clears a function the default would report',
        code: INDEX_BELOW_THE_LIMIT,
        options: [{ limit: 64 }],
      },
    ],
    invalid: [
      {
        name: 'a function scoring 62.5 is below the limit of 65',
        code: 'export function tier(value: number): number {\n  if (value > 0) {\n    if (value > 1) {\n      if (value > 2) {\n        if (value > 3) {\n          return 4;\n        }\n      }\n    }\n  }\n  return -1;\n}',
        errors: [
          {
            message:
              'Function "tier" has maintainability index 62.477309925365475, below the limit of 65. Shorten it and lower its operator and operand count.',
          },
        ],
      },
      {
        // The index is 64.99188980245168, so rounding it to one decimal prints
        // "65.0" and the message would read "below the limit of 65" about a
        // function scoring exactly 65. The value is printed instead.
        name: 'an index that rounds onto the limit is still printed below it',
        code: INDEX_BELOW_THE_LIMIT,
        errors: [
          {
            message:
              'Function "ledgerTotal" has maintainability index 64.99188980245168, below the limit of 65. Shorten it and lower its operator and operand count.',
          },
        ],
      },
      {
        name: 'a raised limit reports a function the default allows',
        code: INDEX_ABOVE_THE_LIMIT,
        options: [{ limit: 66 }],
        errors: [
          {
            message:
              'Function "ledgerTotal" has maintainability index 65.40859757045058, below the limit of 66. Shorten it and lower its operator and operand count.',
          },
        ],
      },
    ],
  },
});
