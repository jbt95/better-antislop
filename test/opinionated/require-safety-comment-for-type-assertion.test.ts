import { describeRule } from '../support/rule-tester.ts';
import { match } from '../support/rule-spec.ts';

/**
 * `require-safety-comment-for-type-assertion`.
 *
 * Two failures are reported and they are not the same one: an assertion with
 * no marked comment at all, and an assertion whose marked comment names no
 * invariant. The marker is configurable and the configured word replaces the
 * default rather than adding to it.
 */
const MISSING = {
  message: match(
    /^Nothing records why this assertion holds.*Add a comment reading SAFETY: followed by/s,
  ),
};
const EMPTY = {
  message: match(/^The SAFETY comment above this assertion names no invariant/),
};

describeRule({
  plugin: 'better-antislop',
  rule: 'require-safety-comment-for-type-assertion',
  cases: {
    valid: [
      {
        name: 'a marked comment on the line above states the invariant',
        code: '// SAFETY: the loader validates this\nconst shown = value as string;',
      },
      {
        name: '`as const` removes a type instead of claiming one, so it needs no comment',
        code: 'const shown = value as const;',
      },
      {
        name: 'the configured marker replaces the default',
        code: '// REVIEW: checked by hand against the fixture\nconst shown = value as string;',
        options: [{ marker: 'REVIEW' }],
      },
    ],
    invalid: [
      {
        name: 'an assertion with nothing above it',
        code: 'const shown = value as string;',
        errors: [MISSING],
      },
      {
        name: 'a marked comment naming no invariant',
        code: '// SAFETY:\nconst shown = value as string;',
        errors: [EMPTY],
      },
      {
        name: 'an unmarked comment is not a justification',
        code: '// the loader validates this\nconst shown = value as string;',
        errors: [MISSING],
      },
      {
        name: 'a comment that does not end on the line above does not count',
        code: '// SAFETY: the loader validates this\n\nconst shown = value as string;',
        errors: [MISSING],
      },
      {
        name: 'an angle bracket assertion is an assertion too',
        code: 'const shown = <string>value;',
        errors: [MISSING],
      },
      {
        name: 'the configured marker replaces the default, so SAFETY no longer counts',
        code: '// SAFETY: the loader validates this\nconst shown = value as string;',
        options: [{ marker: 'REVIEW' }],
        errors: [
          {
            message: match(
              /^Nothing records why this assertion holds.*Add a comment reading REVIEW:/s,
            ),
          },
        ],
      },
    ],
  },
});
