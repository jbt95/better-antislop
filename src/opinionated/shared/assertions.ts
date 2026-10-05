import type { ESTree, Node, Options } from '@oxlint/plugins';

/**
 * The type-assertion syntax that the rules have to read the same way.
 *
 * `no-chained-type-assertions` needs to know which node is a cast, which one
 * is the `as const` form that claims nothing, and how a chain hides inside
 * parentheses. `require-safety-comment-for-type-assertion` needs to know the
 * same first two things, plus which statements a justification comment may sit
 * above and how a marked comment reads. `no-runtime-typeof-narrowing` walks
 * ancestors too, so the one guard that reads a host-reported node lives here as
 * well.
 *
 * Rule options are the second thing several of these rules have to read the
 * same way. They arrive from the config file as JSON, so the compiler cannot
 * see their shape, and the guards at the end of this module are the one place
 * that shape is decoded.
 *
 * Stops here: every helper is pure syntax over the file being linted. Nothing
 * in this module reads types, and nothing can follow a declaration that lives
 * in another file.
 */

/** The two ESTree shapes that cast an expression to a written type. */
export type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;

/** Type guard for the two casting shapes, so `as const` stays reachable. */
export function isTypeAssertion(node: ESTree.Node): node is TypeAssertion {
  return node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion';
}

/**
 * `as const` removes a type instead of claiming one. It discards no evidence,
 * so it needs no justification and a chain of them states nothing. oxc parses
 * the keyword as a type reference named `const`.
 */
export function isConstAssertion(node: TypeAssertion): boolean {
  const annotation = node.typeAnnotation;
  return (
    annotation.type === 'TSTypeReference' &&
    annotation.typeName.type === 'Identifier' &&
    annotation.typeName.name === 'const'
  );
}

/** The two shapes that hold an expression without claiming anything for it. */
export type TransparentWrapper = ESTree.ParenthesizedExpression | ESTree.TSNonNullExpression;

/** True for a wrapper that contributes no cast of its own. */
export function isTransparentWrapper(node: ESTree.Node): node is TransparentWrapper {
  return node.type === 'ParenthesizedExpression' || node.type === 'TSNonNullExpression';
}

/**
 * The expression a cast actually applies to. Parentheses and `!` are kept in
 * the tree, and a chain hides inside them, so every chain walk steps through
 * them before it looks at the node underneath.
 */
export function stripTransparentWrappers(node: ESTree.Expression): ESTree.Expression {
  let current = node;
  while (isTransparentWrapper(current)) {
    current = current.expression;
  }
  return current;
}

/** Statement and declaration shapes a justification comment may sit above. */
const OWNER_TYPES: Readonly<Record<string, true>> = {
  BlockStatement: true,
  BreakStatement: true,
  ClassDeclaration: true,
  ContinueStatement: true,
  DebuggerStatement: true,
  DoWhileStatement: true,
  EmptyStatement: true,
  ExportAllDeclaration: true,
  ExportDefaultDeclaration: true,
  ExportNamedDeclaration: true,
  ExpressionStatement: true,
  ForInStatement: true,
  ForOfStatement: true,
  ForStatement: true,
  FunctionDeclaration: true,
  IfStatement: true,
  LabeledStatement: true,
  ReturnStatement: true,
  SwitchStatement: true,
  ThrowStatement: true,
  TryStatement: true,
  TSEnumDeclaration: true,
  TSExportAssignment: true,
  TSImportEqualsDeclaration: true,
  TSInterfaceDeclaration: true,
  TSModuleDeclaration: true,
  TSTypeAliasDeclaration: true,
  VariableDeclaration: true,
  WhileStatement: true,
  WithStatement: true,
};

/**
 * True for the entries `sourceCode.getAncestors` reports.
 *
 * Its declared result is the host-facing `Node`, which is a bare span with no
 * syntax tag, so this guard is the boundary decode that widens one entry to
 * the syntax node it always is. The tag is the evidence, not a representation
 * test: an entry without one is not a node, and a walk that meets it stops
 * instead of reading a node out of it.
 */
export function isSyntaxNode(node: Node): node is ESTree.Node {
  return 'type' in node;
}

/**
 * Every statement or declaration that encloses the visited node, innermost
 * first. The input is what `sourceCode.getAncestors` hands back: outermost
 * first, and without the node itself.
 *
 * An assertion may be justified above the statement that holds it, above the
 * declaration that statement belongs to, or above that declaration's export
 * clause, so the caller offers each of these in turn.
 */
export function enclosingStatementCandidates(ancestors: readonly Node[]): readonly ESTree.Node[] {
  const candidates: ESTree.Node[] = [];
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    if (ancestor !== undefined && isSyntaxNode(ancestor) && ancestor.type in OWNER_TYPES) {
      candidates.push(ancestor);
    }
  }
  return candidates;
}

/**
 * Reads the reason out of a comment that carries a safety marker.
 *
 * Returns the text after the marker and its colon, an empty string when the
 * marker is there but carries no reason, and `null` when the comment is not a
 * marker comment at all. Three answers let the rule tell "no comment" apart
 * from "a comment that says nothing", which are different mistakes.
 */
export function readSafetyJustification(value: string, marker: string): string | null {
  const prefix = `${marker}:`;
  for (const rawLine of value.split('\n')) {
    const line = rawLine.trim().replace(/^\*+/, '').trim();
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

/**
 * One option value as it arrives from the config file, or nothing at all.
 *
 * `isOptionRecord` is the boundary decode for that raw data, the same decode
 * `src/rules/create-metric-rule.ts` makes for the metric rules: it is the one
 * place a rule option becomes a named shape, and nothing downstream of it reads
 * the value as raw JSON again.
 */
type RawOption = Options[number] | undefined;

/** The JSON object form of the single option a rule accepts. */
type OptionRecord = Extract<Options[number], Record<string, Options[number]>>;

/** True for an option the author wrote as a JSON object. */
export function isOptionRecord(value: RawOption): value is OptionRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows a decoded option value to the string it may carry. */
export function isStringValue(value: RawOption): value is string {
  return typeof value === 'string';
}

/** Narrows a decoded option value to the boolean it may carry. */
export function isBooleanValue(value: RawOption): value is boolean {
  return typeof value === 'boolean';
}
