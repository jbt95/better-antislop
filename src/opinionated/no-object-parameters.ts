import type { ESTree, Rule } from '@oxlint/plugins';
import {
  bindingScopes,
  parameterTypeAnnotation,
  typeMentionsKeyword,
} from './shared/type-syntax.ts';

/**
 * Reject `object` in a parameter position.
 *
 * `object` accepts every non-primitive value, so the body can read any property
 * it names and the compiler stays silent. A union containing it, a container of
 * it, and an alias declared in this file that resolves to it all carry the same
 * loss, so each of them is reported once, at the parameter that carries it.
 *
 * Stops here: the rule reads the type written on a parameter in this file,
 * following unions, containers and aliases declared here. It does not look
 * inside a type literal, and an imported alias has no declaration here.
 */
export const noObjectParameters: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Name the fields a function needs instead of accepting `object`.',
    },
    messages: {
      objectParameter:
        'A parameter typed `object` accepts every non-primitive value, so this function can read any property it names and the compiler will not stop it. Name the fields and invariants the function needs, and parse external input before it reaches this seam.',
    },
    schema: [],
    defaultOptions: [],
  },
  createOnce(context) {
    const inspect = (node: ESTree.Function | ESTree.ArrowFunctionExpression): void => {
      const scopes = bindingScopes(context.sourceCode.scopeManager, node);
      const followedAliases = new Set<string>();

      for (const parameter of node.params) {
        const annotation = parameterTypeAnnotation(parameter);
        if (annotation === null) {
          continue;
        }
        const written = annotation.typeAnnotation;
        if (typeMentionsKeyword(written, scopes, 'TSObjectKeyword', followedAliases)) {
          context.report({ node: parameter, messageId: 'objectParameter' });
        }
      }
    };

    return {
      FunctionDeclaration: inspect,
      FunctionExpression: inspect,
      ArrowFunctionExpression: inspect,
      TSDeclareFunction: inspect,
      TSEmptyBodyFunctionExpression: inspect,
    };
  },
};
