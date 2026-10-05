import type { ESTree, Options, Rule, ScopeManager, SourceCode } from '@oxlint/plugins';
import { isBooleanValue, isOptionRecord, isSyntaxNode } from './shared/assertions.ts';

/** The one platform value whose absence a guard is allowed to ask about. */
const ABSENT = 'undefined';

/**
 * Reject narrowing a value by its runtime representation.
 *
 * A comparison against the representation tag makes the branch read a type the
 * data does not guarantee, and the guarantee never appears anywhere else. Two
 * narrow exceptions survive: an existence probe, which asks whether a binding
 * the program did not define is present rather than what a value holds, and,
 * when the option is turned on, a function whose own signature already says
 * what it guarantees.
 *
 * The absent tag alone is not an existence probe. `typeof someLocal` asks what
 * a value the program wrote happens to hold, which is the same representation
 * check the rule rejects everywhere else, so the operand has to be a name with
 * no binding behind it.
 *
 * Stops here: the rule reads comparisons written in this file. It cannot know
 * whether the value came from outside the program, and a guard imported from
 * another file is out of reach.
 */
export const noRuntimeTypeofNarrowing: Rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Reject ad hoc representation checks that stand in for a real type.',
    },
    messages: {
      typeofNarrowing:
        'This comparison branches on how a value happens to be represented at run time, so every branch below reads a type the data never promised. Give the value a real type where it enters the program, or move the check into a function that returns a type predicate so the guarantee has a name.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowInTypePredicateFunctions: {
            type: 'boolean',
            description:
              'Allow representation checks inside a function whose return type is a type predicate or an assertion.',
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypePredicateFunctions: false }],
  },
  createOnce(context) {
    // Filled once per file by `Program`, which runs before any expression is
    // visited, so a comparison only costs a set lookup.
    const unboundNames = new Set<ESTree.Node>();

    return {
      Program: (): void => {
        unboundNames.clear();
        for (const name of namesWithoutBinding(context.sourceCode.scopeManager)) {
          unboundNames.add(name);
        }
      },
      BinaryExpression: (node: ESTree.BinaryExpression): void => {
        // oxlint refuses to hand out `context.sourceCode` while `createOnce` runs,
        // so the file is only read from inside the visitors below.
        const sourceCode = context.sourceCode;

        const comparison = typeofComparison(node);
        if (comparison === null) {
          return;
        }

        // Comparing against the absent tag asks whether a binding exists. That
        // is a statement about the platform, not a claim about a value's shape.
        // oxc tags every literal `Literal` and keeps the kind in `value`, and a
        // strict comparison only a string can win, so the tag alone is enough.
        // The operand decides it, though: the probe has to name something the
        // program never declared.
        if (isExistenceProbe(unboundNames, comparison)) {
          return;
        }

        // oxlint binds options per file, after `createOnce` returned, so this is
        // the first moment the configured exception can be read.
        if (
          allowsPredicateFunctions(context.options) &&
          insidePredicateFunction(sourceCode, node)
        ) {
          return;
        }

        context.report({ node, messageId: 'typeofNarrowing' });
      },
    };
  },
};

/**
 * One `typeof` tag set against the value the operator reads.
 */
interface TypeofComparison {
  /** The value whose representation the operator reports. */
  readonly operand: ESTree.Expression;
  /** What the tag is compared with. A second `typeof` counts as that value. */
  readonly tag: ESTree.Expression;
}

/**
 * The `typeof` comparison this expression makes, or `null` when it does not
 * compare one tag against another value.
 */
function typeofComparison(node: ESTree.BinaryExpression): TypeofComparison | null {
  if (node.operator !== '===' && node.operator !== '!==') {
    return null;
  }
  const leftTag = typeofTag(node.left);
  if (leftTag !== null) {
    return { operand: leftTag.argument, tag: node.right };
  }
  const rightTag = typeofTag(node.right);
  return rightTag === null ? null : { operand: rightTag.argument, tag: node.left };
}

/** The `typeof` expression itself, so its operand can be reached. */
function typeofTag(node: ESTree.Expression): ESTree.UnaryExpression | null {
  return node.type === 'UnaryExpression' && node.operator === 'typeof' ? node : null;
}

/**
 * Every name `scopeManager` resolves to nothing this file declares.
 *
 * Two shapes of reference reach that answer and both are platform probes. A
 * name the environment lists as a global resolves to a variable this file
 * never defines, so the variable carries no definition. A name nothing lists
 * stays unresolved, which is what oxlint records for an identifier it cannot
 * bind at all. A local, a parameter, an import, a type-only import, a hoisted
 * `var` and a name read before its `const` is initialised all resolve to a
 * variable that does carry a definition, so none of them reaches the set.
 */
function namesWithoutBinding(scopeManager: ScopeManager): readonly ESTree.Node[] {
  const names: ESTree.Node[] = [];
  for (const scope of scopeManager.scopes) {
    for (const reference of scope.references) {
      const resolved = reference.resolved;
      if (resolved === null || resolved.defs.length === 0) {
        names.push(reference.identifier);
      }
    }
  }
  return names;
}

/**
 * True when the comparison asks whether a binding the program did not define
 * exists.
 *
 * The exemption is about who owns the name. `typeof document` asks whether the
 * platform provides it, while `typeof missing` asks what a local, a parameter
 * or an import the program itself declared happens to hold, which is the
 * representation check the rule rejects everywhere else. A name the program
 * never wrote can be the first and not the second.
 *
 * A bare name is required, because a binding is what the exception is about.
 * `typeof holder.missing` reads through a binding the program holds, so it is
 * reported even where `holder` itself is a platform global.
 */
function isExistenceProbe(
  unboundNames: ReadonlySet<ESTree.Node>,
  comparison: TypeofComparison,
): boolean {
  return (
    comparison.tag.type === 'Literal' &&
    comparison.tag.value === ABSENT &&
    comparison.operand.type === 'Identifier' &&
    unboundNames.has(comparison.operand)
  );
}

/** The documented exception, or `false` when the option is absent or malformed. */
function allowsPredicateFunctions(options: Readonly<Options>): boolean {
  const [first] = options;
  if (!isOptionRecord(first)) {
    return false;
  }
  const flag = first['allowInTypePredicateFunctions'];
  return isBooleanValue(flag) ? flag : false;
}

/**
 * True when an ancestor of `node` is a function whose own return type names the
 * shape it checked. The `allowInTypePredicateFunctions` exception is scoped to
 * exactly these, so the option and the shape it looks for are read together.
 */
function insidePredicateFunction(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return sourceCode
    .getAncestors(node)
    .some(
      (ancestor) =>
        isSyntaxNode(ancestor) && isRuntimeFunction(ancestor) && declaresTypePredicate(ancestor),
    );
}

/** A runtime function. A type position never narrows a value. */
function isRuntimeFunction(
  node: ESTree.Node,
): node is ESTree.Function | ESTree.ArrowFunctionExpression {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSEmptyBodyFunctionExpression'
  );
}

/** True when the function's own return type names the shape it checked. */
function declaresTypePredicate(node: ESTree.Function | ESTree.ArrowFunctionExpression): boolean {
  const returnType = node.returnType;
  if (returnType === null || returnType === undefined) {
    return false;
  }
  return returnType.typeAnnotation.type === 'TSTypePredicate';
}
