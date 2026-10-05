import type { ESTree, Node, Rule } from '@oxlint/plugins';
import {
  isConstAssertion,
  isSyntaxNode,
  isTransparentWrapper,
  isTypeAssertion,
  stripTransparentWrappers,
  type TypeAssertion,
} from './shared/assertions.ts';

/**
 * Reject `x as T as U`.
 *
 * Every `as` overwrites the type the compiler holds, so the middle of a chain
 * is thrown away unread and the last link is a claim about a type no check
 * established. A chain made only of `as const` states nothing at all and stays
 * allowed.
 *
 * Stops here: the rule reads the assertions written in this file. It cannot
 * tell whether an intermediate type was true, and it does not follow a cast
 * whose operand comes from another file.
 */
export const noChainedTypeAssertions: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reject chained type assertions, where each `as` discards the last.',
    },
    messages: {
      chained:
        'This is a chain of {{count}} type assertions. Each `as` replaces what the compiler knew about the value, so every type in the middle is discarded unread and the last one is a claim no check supports. Assert once and give the value a type you can name, or parse the value at the boundary that produced it.',
    },
    schema: [],
    defaultOptions: [],
  },
  createOnce(context) {
    const inspect = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      // Only the head of a chain reports, so `a as B as C as D` is one finding.
      if (isTypeAssertion(stripTransparentWrappers(node.expression))) {
        return;
      }

      const chain = collectChain(node, context.sourceCode.getAncestors(node));
      const outermost = chain[chain.length - 1];

      if (chain.length < 2 || outermost === undefined) {
        return;
      }
      // A chain made only of `as const` states nothing at all, so it stays allowed.
      if (chain.every((link) => isConstAssertion(link))) {
        return;
      }

      context.report({
        node: outermost,
        messageId: 'chained',
        data: { count: chain.length },
      });
    };

    return {
      TSAsExpression: inspect,
      TSTypeAssertion: inspect,
    };
  },
};

/**
 * Every assertion that wraps `node`, innermost first. The walk reads the
 * ancestors from `node` outward and steps over the wrappers that hold an
 * expression without claiming anything for it, so `(a as B) as C` and `a as B as
 * C` are read as the same chain.
 */
function collectChain(node: TypeAssertion, ancestors: readonly Node[]): TypeAssertion[] {
  const outward = [...ancestors].reverse();
  const chain: TypeAssertion[] = [node];
  let appliedTo: ESTree.Node = node;
  let consumed = 0;

  for (;;) {
    const next = outward[consumed];
    if (next === undefined || !isSyntaxNode(next)) {
      break;
    }
    if (isTransparentWrapper(next)) {
      consumed += 1;
      appliedTo = next;
      continue;
    }
    if (!isTypeAssertion(next) || next.expression !== appliedTo) {
      break;
    }
    chain.push(next);
    consumed += 1;
    appliedTo = next;
  }

  return chain;
}
