import { describeRule } from '../support/rule-tester.ts';
import { nestedIfs } from '../support/fixtures.ts';

/**
 * `max-nesting-depth`, which ships with a limit of 4.
 *
 * The fixtures are a family, so the depth of each one can be read off its
 * shape: see `nestedIfs`.
 */
describeRule({
  plugin: 'better-antislop',
  rule: 'max-nesting-depth',
  cases: {
    valid: [
      { name: 'a function nesting 2 levels is inside the limit', code: nestedIfs(2) },
      { name: 'a function nesting exactly the limit of 4 is allowed', code: nestedIfs(4) },
      {
        name: 'a raised limit clears a function the default would report',
        code: nestedIfs(5),
        options: [{ limit: 5 }],
      },
      {
        name: 'a bodyless declaration is never a nesting violation',
        code: 'export declare function parse(input: string): number;',
      },
    ],
    invalid: [
      {
        name: 'a function nesting 5 levels is above the limit of 4',
        code: nestedIfs(5),
        errors: [
          {
            message:
              'Function "tier" nests 5 levels deep, above the limit of 4. Flatten the inner blocks with early returns.',
          },
        ],
      },
      {
        name: 'a lowered limit reports a function the default allows',
        code: nestedIfs(2),
        options: [{ limit: 1 }],
        errors: [
          {
            message:
              'Function "tier" nests 2 levels deep, above the limit of 1. Flatten the inner blocks with early returns.',
          },
        ],
      },
      {
        name: 'every function past the limit is reported, not only the first',
        code: [
          nestedIfs(5).replace('tier', 'outer'),
          '',
          nestedIfs(5).replace('tier', 'inner'),
        ].join('\n'),
        errors: [
          {
            message:
              'Function "outer" nests 5 levels deep, above the limit of 4. Flatten the inner blocks with early returns.',
          },
          {
            message:
              'Function "inner" nests 5 levels deep, above the limit of 4. Flatten the inner blocks with early returns.',
          },
        ],
      },
    ],
  },
});
