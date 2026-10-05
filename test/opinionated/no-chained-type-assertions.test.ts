import { describeRule } from '../support/rule-tester.ts';
import { match } from '../support/rule-spec.ts';

/**
 * `no-chained-type-assertions`.
 *
 * The count in the message is the observable part, so the expectations match
 * on the opening of the message rather than repeating the whole explanation.
 */
describeRule({
  plugin: 'better-antislop',
  rule: 'no-chained-type-assertions',
  cases: {
    valid: [
      { name: 'one assertion claims a type once', code: 'const shown = value as string;' },
      {
        name: 'one angle bracket assertion is a single link',
        code: 'const shown = <string>value;',
      },
      {
        name: 'a chain of nothing but `as const` states no type and stays allowed',
        code: 'const shown = value as const as const;',
      },
      { name: 'a lone `as const` is not a claim at all', code: 'const shown = value as const;' },
    ],
    invalid: [
      {
        name: 'two `as` links are a chain',
        code: 'const shown = value as string as number;',
        errors: [{ message: match(/^This is a chain of 2 type assertions\./) }],
      },
      {
        name: 'the whole chain is counted, not the links after the first',
        code: 'const shown = value as string as number as boolean;',
        errors: [{ message: match(/^This is a chain of 3 type assertions\./) }],
      },
      {
        name: 'angle bracket assertions chain the same way',
        code: 'const shown = <string><number>value;',
        errors: [{ message: match(/^This is a chain of 2 type assertions\./) }],
      },
      {
        name: 'parentheses do not break the chain',
        code: 'const shown = (value as string) as number;',
        errors: [{ message: match(/^This is a chain of 2 type assertions\./) }],
      },
      {
        name: 'a non-null assertion does not break the chain either',
        code: 'const shown = value! as string as number;',
        errors: [{ message: match(/^This is a chain of 2 type assertions\./) }],
      },
      {
        name: 'a chain that starts with `as const` is still a chain',
        code: 'const shown = (value as const) as number;',
        errors: [{ message: match(/^This is a chain of 2 type assertions\./) }],
      },
      {
        name: 'only the head of the chain reports, so one chain is one finding',
        code: 'const shown = value as string as number as boolean as object;',
        errors: [{ message: match(/^This is a chain of 4 type assertions\./) }],
      },
    ],
  },
});
