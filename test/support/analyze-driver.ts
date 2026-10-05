import { readFileSync } from 'node:fs';
import type { ESTree, Rule } from '@oxlint/plugins';
import { RuleTester } from 'oxlint/plugins-dev';
import { analyzeProgram } from '../../src/engine/contract.ts';
import type { FunctionKind, HalsteadMetrics, Span } from '../../src/engine/types.ts';

/**
 * The Node half of the conformance suite.
 *
 * Two facts make this a separate process. `oxlint/plugins-dev` exports only
 * `RuleTester`, so a rule is the one supported way to obtain a parsed `Program`,
 * and `RuleTester` refuses to run under Bun. The suite therefore runs under
 * `bun test`, hands this process the fixture paths on the command line, and
 * reads one JSON document of measurements back from stdout.
 *
 * `analyzeProgram` is called inside the `Program` visitor and never after it.
 * The `Program` node is a live view into the lint session's source buffer, and
 * `node.loc` is a lazy getter over it, so a call made after `RuleTester.run`
 * has returned reads a buffer that has already been released.
 */

/** Thrown by the visitor to end the run as soon as one file has been measured. */
const STOP = Symbol('stop');

/** How much of a declaration head an identity keeps. */
const SIGNATURE_LIMIT = 72;

/** The quotes a default value or an annotation can hide a brace behind. */
const QUOTES = '\'"`';

/** One function, as this process measured it. */
interface MeasuredFunction {
  readonly kind: FunctionKind;
  readonly name: string | null;
  readonly line: number;
  readonly column: number;
  readonly signature: string;
  readonly lines: number;
  readonly logicalLines: number;
  readonly parameters: number;
  readonly cyclomatic: number;
  readonly cognitive: number;
  readonly maxNesting: number;
  readonly halstead: HalsteadMetrics;
  readonly maintainabilityIndex: number;
  readonly recursive: boolean;
}

/** One file, measured. `error` is present only when the file did not parse. */
interface MeasuredFixture {
  readonly file: string;
  readonly functions: ReadonlyArray<MeasuredFunction>;
  readonly error?: string;
}

/**
 * Where every line of `source` starts, indexed by the line number itself.
 *
 * Line one starts at index one, so a `line` from a span indexes this directly.
 */
function lineStarts(source: string): ReadonlyArray<number> {
  const starts: number[] = [0, 0];
  for (let index = 0; index < source.length; index += 1) {
    if (source.charAt(index) === '\n') starts.push(index + 1);
  }
  return starts;
}

/** The offset the named line begins at. */
function startOf(starts: ReadonlyArray<number>, line: number): number {
  const offset = starts[line];
  if (offset === undefined) {
    throw new Error(`the span names line ${String(line)}, which the source does not have`);
  }
  return offset;
}

/** The index just past the string literal or template that begins at `index`. */
function skipQuoted(source: string, index: number): number {
  const quote = source.charAt(index);
  let cursor = index + 1;
  while (cursor < source.length && source.charAt(cursor) !== quote) {
    cursor += source.charAt(cursor) === '\\' ? 2 : 1;
  }
  return cursor + 1;
}

/** True where the character at `index` is the `{` of a body or the `=` of `=>`. */
function opensBody(source: string, index: number): boolean {
  return (
    source.charAt(index) === '{' ||
    (source.charAt(index) === '=' && source.charAt(index + 1) === '>')
  );
}

/**
 * Where the body begins: the first `{` or `=>` at bracket depth zero.
 *
 * A brace inside a parameter list opens a pattern, not a body, and a brace
 * inside a quoted string is text. A bodyless declaration has neither, so the
 * whole span is its own head.
 */
function bodyStart(source: string, start: number, end: number): number {
  let depth = 0;
  let index = start;
  while (index < end) {
    const character = source.charAt(index);
    if (QUOTES.includes(character)) {
      index = skipQuoted(source, index);
    } else if (character === '(' || character === '[') {
      depth += 1;
      index += 1;
    } else if (character === ')' || character === ']') {
      depth -= 1;
      index += 1;
    } else if (depth === 0 && opensBody(source, index)) {
      // The head keeps the `=>` of an arrow, because the `=>` is part of the
      // declaration, and drops the `{` of a block, because that opens the body.
      return source.charAt(index) === '{' ? index : index + 2;
    } else {
      index += 1;
    }
  }
  return end;
}

/**
 * A short declaration head for one function, used only as an identity.
 *
 * The line and the name alone do not survive an edit: inserting a line moves
 * every function below it, and renaming one changes what it is called. The
 * head changes only when the signature changes, so a comparison across a
 * golden file and a fresh run names the function it means.
 */
function declarationHead(source: string, starts: ReadonlyArray<number>, span: Span): string {
  const start = startOf(starts, span.start.line) + span.start.column;
  const end = startOf(starts, span.end.line) + span.end.column;
  const head = source
    .slice(start, bodyStart(source, start, end))
    .replace(/\s+/g, ' ')
    .trim();
  return head.length > SIGNATURE_LIMIT ? head.slice(0, SIGNATURE_LIMIT) : head;
}

/** Measure every function the engine found in one parsed program. */
function measure(program: ESTree.Program, file: string, source: string): MeasuredFixture {
  const starts = lineStarts(source);
  const functions = analyzeProgram(program, { filename: file }).functions.map((fn) => ({
    kind: fn.kind,
    name: fn.name,
    line: fn.span.start.line,
    column: fn.span.start.column,
    signature: declarationHead(source, starts, fn.span),
    lines: fn.lines,
    logicalLines: fn.logicalLines,
    parameters: fn.parameters,
    cyclomatic: fn.cyclomatic,
    cognitive: fn.cognitive,
    maxNesting: fn.maxNesting,
    halstead: fn.halstead,
    maintainabilityIndex: fn.maintainabilityIndex,
    recursive: fn.recursive,
  }));
  return { file, functions };
}

/**
 * Run one file through `RuleTester` and report what the engine measured.
 *
 * Each file gets its own `RuleTester` and its own run, so a file that fails to
 * parse is reported on its own instead of ending the process and taking the
 * rest of the corpus with it.
 */
function measureFile(file: string): MeasuredFixture {
  const source = readFileSync(file, 'utf8');
  const language = file.endsWith('.tsx') ? 'tsx' : 'ts';
  let measured: MeasuredFixture | null = null;
  const rule: Rule = {
    create: () => ({
      Program(program: ESTree.Program): void {
        measured = measure(program, file, source);
        throw STOP;
      },
    }),
  };
  try {
    new RuleTester({ languageOptions: { parserOptions: { lang: language } } }).run(
      'better-antislop-conformance',
      rule,
      { valid: [{ code: source, filename: file }], invalid: [] },
    );
  } catch (error) {
    if (error !== STOP) {
      return { file, functions: [], error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (measured === null) return { file, functions: [], error: 'the rule visitor never ran' };
  return measured;
}

const reported: MeasuredFixture[] = process.argv.slice(2).map((file) => measureFile(file));

process.stdout.write(JSON.stringify({ fixtures: reported }));
