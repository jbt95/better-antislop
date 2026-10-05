import type { ESTree, Options, Rule } from '@oxlint/plugins';
import { isOptionRecord, isStringValue } from './shared/assertions.ts';
import {
  bindingScopes,
  parameterTypeAnnotation,
  typeMentionsKeyword,
} from './shared/type-syntax.ts';

/** The conventional error-cause parameter, which carries its evidence in use. */
const DEFAULT_ALLOWED_NAMES: readonly string[] = ['cause'];

/**
 * Reject `unknown` in a parameter position.
 *
 * `unknown` in a parameter means every read inside the body starts with no
 * information, so each one has to guess again and no guess is ever checked.
 * Two exceptions survive: the parameter a type predicate narrows, because the
 * signature is the guarantee, and the conventional error-cause parameter.
 *
 * Stops here: the rule reads the type written on a parameter in this file,
 * following unions, containers and aliases declared here. It cannot see whether
 * the value was already decoded, and an imported alias has no declaration here.
 */
export const noUnknownParameters: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Keep `unknown` out of parameters so every read has a type behind it.',
    },
    messages: {
      unknownParameter:
        'A parameter typed `unknown` carries no evidence: every read of it inside this function guesses, and nothing ever confirms the guess. Name the type this parameter actually carries, or decode the value where it enters the program and pass the decoded shape.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowedNames: {
            type: 'array',
            items: { type: 'string' },
            description: 'Parameter names that may keep the broad type.',
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowedNames: [...DEFAULT_ALLOWED_NAMES] }],
  },
  createOnce(context) {
    const inspect = (node: ESTree.Function | ESTree.ArrowFunctionExpression): void => {
      const allowedNames = readAllowedNames(context.options);

      const subject = predicateSubject(node.returnType);
      const scopes = bindingScopes(context.sourceCode.scopeManager, node);
      const followedAliases = new Set<string>();

      for (const parameter of node.params) {
        const annotation = parameterTypeAnnotation(parameter);
        if (annotation === null) {
          continue;
        }
        const name = parameterName(parameter);
        // The predicate's own subject is the one parameter the signature narrows.
        if (name !== null && (name === subject || allowedNames.includes(name))) {
          continue;
        }
        const written = annotation.typeAnnotation;
        if (typeMentionsKeyword(written, scopes, 'TSUnknownKeyword', followedAliases)) {
          context.report({ node: parameter, messageId: 'unknownParameter' });
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

/**
 * The parameter names the options exempt.
 *
 * oxlint binds options per file, after `createOnce` returned, so this is the
 * first moment the configured exceptions can be read. An option that is not a
 * JSON object, or a list that is not there, leaves the conventional names.
 */
function readAllowedNames(options: Readonly<Options>): readonly string[] {
  const [configured] = options;
  if (!isOptionRecord(configured)) return DEFAULT_ALLOWED_NAMES;
  const given = configured['allowedNames'];
  if (!Array.isArray(given)) return DEFAULT_ALLOWED_NAMES;
  return given.filter((entry): entry is string => isStringValue(entry));
}

/** The parameter an `is T` or `asserts ... is T` return type talks about. */
function predicateSubject(annotation: ESTree.TSTypeAnnotation | null | undefined): string | null {
  if (annotation === null || annotation === undefined) {
    return null;
  }
  const returnType = annotation.typeAnnotation;
  if (returnType.type !== 'TSTypePredicate') {
    return null;
  }
  const subject = returnType.parameterName;
  return subject.type === 'Identifier' ? subject.name : null;
}

/** The name a parameter binds, or `null` for a destructuring pattern. */
function parameterName(parameter: ESTree.ParamPattern): string | null {
  if (parameter.type === 'TSParameterProperty') {
    return parameterName(parameter.parameter);
  }
  if (parameter.type === 'AssignmentPattern') {
    return parameterName(parameter.left);
  }
  if (parameter.type === 'RestElement') {
    return parameterName(parameter.argument);
  }
  return parameter.type === 'Identifier' ? parameter.name : null;
}
