import { eslintCompatPlugin } from '@oxlint/plugins';
import { noChainedTypeAssertions } from './no-chained-type-assertions.ts';
import { noObjectParameters } from './no-object-parameters.ts';
import { noRuntimeTypeofNarrowing } from './no-runtime-typeof-narrowing.ts';
import { noUnknownParameters } from './no-unknown-parameters.ts';
import { requireSafetyCommentForTypeAssertion } from './require-safety-comment-for-type-assertion.ts';

/**
 * The opinionated half of `better-antislop`.
 *
 * Every rule here answers one question about a pattern the compiler cannot
 * check for the author: does this code state a type the data has not promised?
 * The rules are syntactic on purpose. oxlint plugins get no type checker, so
 * each rejection rests only on what the AST shows, and each rule names the
 * boundary where it stops.
 */
export const betterAntislop = eslintCompatPlugin({
  meta: { name: 'better-antislop' },
  rules: {
    'no-chained-type-assertions': noChainedTypeAssertions,
    'no-object-parameters': noObjectParameters,
    'no-runtime-typeof-narrowing': noRuntimeTypeofNarrowing,
    'no-unknown-parameters': noUnknownParameters,
    'require-safety-comment-for-type-assertion': requireSafetyCommentForTypeAssertion,
  },
});

export default betterAntislop;
