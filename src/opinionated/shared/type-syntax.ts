import type { ESTree, Scope, ScopeManager } from '@oxlint/plugins';

/**
 * How to read the type an author wrote in a parameter position.
 *
 * The broad-parameter rules need the same three answers for every parameter:
 * what type is written, which binding scopes govern the names inside it, and
 * does that written type mention the keyword the rule rejects once every alias
 * it names is followed. Keeping that walk here stops the two rules from
 * drifting apart on what counts as the same type.
 *
 * Stops here: the walk reads syntax and the binding scopes of the file being
 * linted. It cannot follow a declaration from another file, and it does not
 * look inside a type literal or an interface body.
 */

/** The broad type keywords the parameter rules reject. */
export type BroadTypeKeyword = 'TSUnknownKeyword' | 'TSObjectKeyword';

/**
 * The type written on one formal parameter, or `null` when there is none.
 * Reaches through parameter properties, defaults and rest elements, so a
 * promoted or destructured parameter is read like any other one.
 */
export function parameterTypeAnnotation(
  parameter: ESTree.ParamPattern,
): ESTree.TSTypeAnnotation | null {
  if (parameter.type === 'TSParameterProperty') {
    return parameterTypeAnnotation(parameter.parameter);
  }
  if (parameter.type === 'AssignmentPattern') {
    return parameterTypeAnnotation(parameter.left);
  }
  return parameter.typeAnnotation ?? null;
}

/**
 * The scopes that govern the type names written inside `node`, innermost
 * first. Walking this list is what lets a parameter annotation resolve an
 * alias declared in an enclosing block, instead of matching on identifier
 * text and accepting any name that happens to look the same.
 */
export function bindingScopes(scopeManager: ScopeManager, node: ESTree.Node): readonly Scope[] {
  const chain: Scope[] = [];
  let scope = scopeManager.acquire(node);
  while (scope !== null) {
    chain.push(scope);
    scope = scope.upper;
  }
  return chain;
}

/**
 * True when the written type mentions `keyword`, either directly or through a
 * union, a container, a generic argument, or a type alias bound in this file.
 *
 * `visited` holds the alias names already followed, so a pair of aliases that
 * point at each other terminates instead of recursing forever.
 */
export function typeMentionsKeyword(
  annotation: ESTree.TSType,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  if (annotation.type === keyword) {
    return true;
  }
  return (
    containerMentions(annotation, scopes, keyword, visited) ||
    memberListMentions(annotation, scopes, keyword, visited) ||
    namedMentions(annotation, scopes, keyword, visited)
  );
}

/**
 * The kinds that hold other types in named slots: the element of an array, the
 * type under a parenthesis or a type operator, the two sides of an indexed
 * access, and the bound an `infer` writes down. Every slot is a `TSType` of its
 * own, so each is read by the same walk. A kind with no slot answers `false`:
 * a type literal, an interface, a type query or a plain keyword has no
 * container left to look through.
 */
function containerMentions(
  annotation: ESTree.TSType,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  switch (annotation.type) {
    case 'TSArrayType':
      return typeMentionsKeyword(annotation.elementType, scopes, keyword, visited);
    case 'TSIndexedAccessType':
      return (
        typeMentionsKeyword(annotation.objectType, scopes, keyword, visited) ||
        typeMentionsKeyword(annotation.indexType, scopes, keyword, visited)
      );
    case 'TSInferType':
      return inferBoundMentions(annotation, scopes, keyword, visited);
    case 'TSParenthesizedType':
    case 'TSTypeOperator':
      return typeMentionsKeyword(annotation.typeAnnotation, scopes, keyword, visited);
    default:
      return false;
  }
}

/**
 * An `infer` writes no type of its own, so the walk reads the constraint or the
 * default it binds, and stops when the author wrote neither.
 */
function inferBoundMentions(
  infer: ESTree.TSInferType,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  const bound = infer.typeParameter.constraint ?? infer.typeParameter.default;
  return bound === null || bound === undefined
    ? false
    : typeMentionsKeyword(bound, scopes, keyword, visited);
}

/**
 * The kinds written as a list of members: the arms of a union or an
 * intersection, the four slots of a conditional, and the elements of a tuple.
 */
function memberListMentions(
  annotation: ESTree.TSType,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  switch (annotation.type) {
    case 'TSConditionalType':
      return [
        annotation.checkType,
        annotation.extendsType,
        annotation.trueType,
        annotation.falseType,
      ].some((part) => typeMentionsKeyword(part, scopes, keyword, visited));
    case 'TSIntersectionType':
    case 'TSUnionType':
      return annotation.types.some((member) =>
        typeMentionsKeyword(member, scopes, keyword, visited),
      );
    case 'TSTupleType':
      return annotation.elementTypes.some((member) =>
        tupleElementMentions(member, scopes, keyword, visited),
      );
    default:
      return false;
  }
}

/**
 * The kinds that name the type they hold: a type reference, which may also carry
 * generic arguments, and the labelled member of a tuple. A reference is the only
 * one the walk follows by name, through the alias it is bound to.
 */
function namedMentions(
  annotation: ESTree.TSType,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  switch (annotation.type) {
    case 'TSNamedTupleMember':
      return tupleElementMentions(annotation.elementType, scopes, keyword, visited);
    case 'TSTypeReference':
      return (
        typeArgumentsMention(annotation.typeArguments, scopes, keyword, visited) ||
        aliasMentions(annotation, scopes, keyword, visited)
      );
    default:
      return false;
  }
}

/**
 * One slot of a tuple type. `[a?: object]` and `[...object[]]` wrap the type
 * the author wrote in an optional or a rest node, and neither wrapper is a
 * `TSType`, so a walk through a tuple steps into them before it reads the type
 * underneath.
 */
function tupleElementMentions(
  element: ESTree.TSTupleElement,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  switch (element.type) {
    case 'TSOptionalType':
    case 'TSRestType':
      return typeMentionsKeyword(element.typeAnnotation, scopes, keyword, visited);
    default:
      return typeMentionsKeyword(element, scopes, keyword, visited);
  }
}

function typeArgumentsMention(
  typeArguments: ESTree.TSTypeParameterInstantiation | null,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  if (typeArguments === null) {
    return false;
  }
  return typeArguments.params.some((argument) =>
    typeMentionsKeyword(argument, scopes, keyword, visited),
  );
}

function aliasMentions(
  reference: ESTree.TSTypeReference,
  scopes: readonly Scope[],
  keyword: BroadTypeKeyword,
  visited: ReadonlySet<string>,
): boolean {
  const declaration = resolveTypeAlias(reference, scopes);
  if (declaration === null || visited.has(declaration.id.name)) {
    return false;
  }
  const followed = new Set(visited);
  followed.add(declaration.id.name);
  return typeMentionsKeyword(declaration.typeAnnotation, scopes, keyword, followed);
}

/**
 * Finds the type alias a reference names. Walks the binding scopes outward and
 * stops at the first name that is bound at all, so a name bound to a value or
 * to an import ends the walk instead of being followed by text.
 */
function resolveTypeAlias(
  reference: ESTree.TSTypeReference,
  scopes: readonly Scope[],
): ESTree.TSTypeAliasDeclaration | null {
  const name = reference.typeName;
  if (name.type !== 'Identifier') {
    return null;
  }
  for (const scope of scopes) {
    const variable = scope.set.get(name.name);
    if (variable === undefined) {
      continue;
    }
    for (const definition of variable.defs) {
      if (definition.node.type === 'TSTypeAliasDeclaration') {
        return definition.node;
      }
    }
    return null;
  }
  return null;
}
