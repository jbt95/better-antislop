import { describeRule } from '../support/rule-tester.ts';
import { nestedIfs } from '../support/fixtures.ts';

/**
 * `cognitive-complexity`, which ships with a limit of 15.
 *
 * The fixtures are a family, so the score of each one can be read off its
 * shape: see `nestedIfs`.
 */
describeRule({
  plugin: 'better-antislop-metrics',
  rule: 'cognitive-complexity',
  cases: {
    valid: [
      { name: 'a flat function scores 1', code: nestedIfs(1) },
      { name: 'a function scoring exactly the limit of 15 is allowed', code: nestedIfs(5) },
      {
        name: 'a raised limit clears a function the default would report',
        code: nestedIfs(6),
        options: [{ limit: 21 }],
      },
      {
        name: 'a bodyless declaration is never a complexity violation',
        code: 'export declare function parse(input: string): number;',
      },
    ],
    invalid: [
      {
        name: 'a function scoring 21 is above the limit of 15',
        code: nestedIfs(6),
        errors: [
          {
            message:
              'Function "tier" has cognitive complexity 21, above the limit of 15. Move the nested decisions into named helper functions.',
          },
        ],
      },
      {
        name: 'a lowered limit reports a function the default allows',
        code: nestedIfs(1),
        options: [{ limit: 0 }],
        errors: [
          {
            message:
              'Function "tier" has cognitive complexity 1, above the limit of 0. Move the nested decisions into named helper functions.',
          },
        ],
      },
    ],
  },
});
