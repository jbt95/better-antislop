import type { ESTree, Options, Rule, SourceCode } from '@oxlint/plugins';
import {
  enclosingStatementCandidates,
  isConstAssertion,
  isOptionRecord,
  isStringValue,
  readSafetyJustification,
} from './shared/assertions.ts';

const DEFAULT_MARKER = 'SAFETY';

/**
 * Require evidence next to every assertion that claims a type.
 *
 * The comment is the only record that anyone checked the invariant the cast
 * depends on. The rule never writes one itself, because a justification the
 * author did not write is a fabrication, and a wrong one is worse than none.
 *
 * Stops here: the rule reads comments and enclosing statements in this file.
 * It cannot judge whether the written invariant is true, and a comment that
 * does not end on the line above the statement does not count.
 */
export const requireSafetyCommentForTypeAssertion: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require a marked comment with a reason beside every type assertion.',
    },
    messages: {
      missingJustification:
        'Nothing records why this assertion holds, so the cast is the whole evidence and there is none. Add a comment reading {{marker}}: followed by the invariant this value already satisfies, on the line directly above the statement.',
      emptyJustification:
        'The {{marker}} comment above this assertion names no invariant, which reads the same as having no comment at all. Write the fact you checked, after the colon.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          marker: {
            type: 'string',
            description: 'The word that opens a justification comment, before the colon.',
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ marker: DEFAULT_MARKER }],
  },
  createOnce(context) {
    const inspect = (node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): void => {
      // `as const` removes a type instead of claiming one, so it asserts nothing.
      if (isConstAssertion(node)) {
        return;
      }

      // oxlint binds options per file, after `createOnce` returned, so this is
      // the first moment the configured marker can be read.
      const sourceCode = context.sourceCode;
      const marker = readMarker(context.options);
      const verdict = readVerdict(sourceCode, node, marker);

      if (verdict === 'justified') {
        return;
      }

      context.report({
        node,
        messageId: verdict === 'marker-only' ? 'emptyJustification' : 'missingJustification',
        data: { marker },
      });
    };

    return {
      TSAsExpression: inspect,
      TSTypeAssertion: inspect,
    };
  },
};

/** The configured marker word, or the default when the option is absent or malformed. */
function readMarker(options: Readonly<Options>): string {
  const [first] = options;
  if (!isOptionRecord(first)) {
    return DEFAULT_MARKER;
  }
  const chosen = first['marker'];
  return isStringValue(chosen) ? chosen : DEFAULT_MARKER;
}

/**
 * What the written comments say about one assertion: a reason was given, only
 * the marker was given, or nothing was written at all.
 */
type Verdict = 'justified' | 'marker-only' | 'silent';

/**
 * The strongest verdict the comments around `node` can give, read from the
 * nearest enclosing statement outward. A reason anywhere ends the walk, because
 * one justification answers the rule whether it sits above the statement or
 * above the declaration that statement belongs to.
 */
function readVerdict(sourceCode: SourceCode, node: ESTree.Node, marker: string): Verdict {
  let verdict: Verdict = 'silent';
  for (const candidate of enclosingStatementCandidates(sourceCode.getAncestors(node))) {
    const above = readCommentsAbove(sourceCode, candidate, marker);
    if (above === 'justified') {
      return above;
    }
    if (above !== 'silent') {
      verdict = above;
    }
  }
  return verdict;
}

/**
 * The verdict the comments directly above one candidate give. Only a comment
 * that ends on the line above the statement counts, and a reason beats a bare
 * marker however many bare markers sit above it.
 */
function readCommentsAbove(
  sourceCode: SourceCode,
  candidate: ESTree.Node,
  marker: string,
): Verdict {
  let verdict: Verdict = 'silent';
  for (const comment of sourceCode.getCommentsBefore(candidate)) {
    if (comment.loc.end.line + 1 !== candidate.loc.start.line) {
      continue;
    }
    const justification = readSafetyJustification(comment.value, marker);
    if (justification === null) {
      continue;
    }
    if (justification.length > 0) {
      return 'justified';
    }
    verdict = 'marker-only';
  }
  return verdict;
}
