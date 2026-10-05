import { readFile, writeFile } from 'node:fs/promises';
import { Effect, Schema } from 'effect';
import type { ExpectedFixture, ExpectationSet, ScoredFixture } from './compare.ts';
import {
  ExpectationsMissing,
  ExpectationsUnreadable,
  ExpectationsUnwritten,
  describeCause,
} from './errors.ts';

/**
 * The expectations file.
 *
 * It is a golden file, and a golden file written from the implementation proves
 * nothing, so its provenance is stated here as well as in the README: every
 * value in it was derived from `docs/metrics.md`, reviewed against the
 * specification, and rewritten only on purpose.
 */

/** Where the file sits, relative to the package root. */
export const EXPECTATIONS_PATH = 'test/fixtures/metrics/expected.json';

const HalsteadSchema = Schema.Struct({
  distinctOperators: Schema.Int,
  distinctOperands: Schema.Int,
  totalOperators: Schema.Int,
  totalOperands: Schema.Int,
  vocabulary: Schema.Int,
  length: Schema.Int,
  volume: Schema.Number,
  difficulty: Schema.Number,
  effort: Schema.Number,
});

const ScoredFunctionSchema = Schema.Struct({
  kind: Schema.Literals([
    'function',
    'method',
    'arrow',
    'constructor',
    'getter',
    'setter',
    'anonymous',
  ]),
  name: Schema.NullOr(Schema.String),
  line: Schema.Int,
  column: Schema.Int,
  signature: Schema.String,
  lines: Schema.Int,
  logicalLines: Schema.Int,
  parameters: Schema.Int,
  cyclomatic: Schema.Int,
  cognitive: Schema.Int,
  maxNesting: Schema.Int,
  halstead: HalsteadSchema,
  maintainabilityIndex: Schema.Number,
  recursive: Schema.Boolean,
});

const ExpectedFixtureSchema = Schema.Struct({
  functions: Schema.Array(ScoredFunctionSchema),
});

const ExpectationsSchema = Schema.Struct({
  specification: Schema.String,
  fixtures: Schema.Record(Schema.String, ExpectedFixtureSchema),
});

const decodeExpectations = Schema.decodeEffect(Schema.fromJsonString(ExpectationsSchema));

/** True for the rejection Node raises when a path is not there. */
function isAbsent(cause: unknown): cause is Error & { readonly code: string } {
  return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
}

/**
 * Builds the expectations file a measurement run would write.
 *
 * Pure, and keyed by the fixture path, so the file the update mode writes and
 * the file the check mode reads are the same shape by construction. The rows go
 * in as they arrive: the driver and the decoder between them already give every
 * field its place, so nothing has to be re-ordered to make the file stable.
 */
export function expectationsFromMeasurements(
  measured: ReadonlyArray<ScoredFixture>,
): ExpectationSet {
  const fixtures: Record<string, ExpectedFixture> = {};
  for (const fixture of measured) {
    fixtures[fixture.file] = { functions: fixture.functions };
  }
  return { fixtures };
}

/** The file as text: two-space indentation and a trailing newline. */
export function renderExpectations(set: ExpectationSet): string {
  return `${JSON.stringify({ specification: 'docs/metrics.md', fixtures: set.fixtures }, null, 2)}\n`;
}

/**
 * Reads the expectations file.
 *
 * A file that is not there fails as `ExpectationsMissing` and never as an empty
 * run: a suite that cannot see its expectations has proven nothing, and the
 * message says which mode writes one.
 */
export function readExpectations(
  path: string,
): Effect.Effect<ExpectationSet, ExpectationsMissing | ExpectationsUnreadable> {
  return Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => readFile(path, 'utf8'),
      catch: (cause) =>
        isAbsent(cause)
          ? new ExpectationsMissing({
              path,
              detail: 'there is no golden file to compare a run against',
            })
          : new ExpectationsUnreadable({ path, detail: describeCause(cause) }),
    });
    const decoded = yield* Effect.mapError(
      decodeExpectations(raw),
      (error) => new ExpectationsUnreadable({ path, detail: error.message }),
    );
    return decoded;
  });
}

/** Writes the expectations file, or says why it could not be written. */
export function writeExpectations(
  path: string,
  set: ExpectationSet,
): Effect.Effect<void, ExpectationsUnwritten> {
  return Effect.tryPromise({
    try: () => writeFile(path, renderExpectations(set), 'utf8'),
    catch: (cause) => new ExpectationsUnwritten({ path, detail: describeCause(cause) }),
  });
}
