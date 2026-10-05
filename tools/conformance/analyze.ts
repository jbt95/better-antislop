import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect, Schema } from 'effect';
import type { ScoredFixture, ScoredFunction } from './compare.ts';
import {
  CorpusUnreadable,
  DriverFailed,
  DriverOutputUnreadable,
  FixtureUnparsed,
  describeCause,
} from './errors.ts';

/**
 * The IO seam of the conformance suite.
 *
 * Two things here touch the outside world: the fixture directory is listed, and
 * a short-lived Node process measures the fixtures. Everything after that —
 * reading the corpus, comparing, rendering — is a plain function.
 *
 * Paths handed to the driver are relative to the package root and the driver
 * runs there, so the keys the golden file is written with are the same on every
 * machine and never depend on the working directory of the caller.
 */

/** The package root, so every path below is built from this and not from `cwd`. */
export const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The corpus, relative to the package root, as the golden file keys it. */
export const FIXTURE_DIRECTORY = 'test/fixtures/metrics';

/** The Node half. It lives with the tests because it is the test bridge. */
const DRIVER = fileURLToPath(new URL('../../test/support/analyze-driver.ts', import.meta.url));

const FIXTURE_EXTENSIONS: ReadonlyArray<string> = ['.ts', '.tsx'];

const MAX_BUFFER = 256 * 1024 * 1024;

const SAMPLE_BYTES = 400;

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

const ScoredFixtureSchema = Schema.Struct({
  file: Schema.String,
  functions: Schema.Array(ScoredFunctionSchema),
  error: Schema.optionalKey(Schema.String),
});

const DriverOutputSchema = Schema.Struct({
  fixtures: Schema.Array(ScoredFixtureSchema),
});

type DriverFixture = Schema.Schema.Type<typeof ScoredFixtureSchema>;

const decodeDriverOutput = Schema.decodeEffect(Schema.fromJsonString(DriverOutputSchema));

/** A path joined for a golden-file key, which always uses a forward slash. */
function keyPath(directory: string, name: string): string {
  return join(directory, name).split(sep).join('/');
}

/**
 * Every fixture in the corpus, as paths relative to the package root.
 *
 * A `.txt` extension never appears here, and `README.md` is left out because it
 * is a document rather than parser input.
 */
export function listFixtures(
  directory: string = FIXTURE_DIRECTORY,
): Effect.Effect<ReadonlyArray<string>, CorpusUnreadable> {
  return Effect.mapError(
    Effect.tryPromise(() => readdir(directory, { withFileTypes: true })),
    (cause) => new CorpusUnreadable({ directory, detail: describeCause(cause) }),
  ).pipe(
    Effect.map((entries) =>
      entries
        .filter(
          (entry) => entry.isFile() && FIXTURE_EXTENSIONS.some((end) => entry.name.endsWith(end)),
        )
        .map((entry) => keyPath(directory, entry.name))
        .sort(),
    ),
  );
}

interface Captured {
  readonly exitCode: number | string | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Starts the driver and always resolves.
 *
 * The exit code of the child is data here, not an exception, so it survives to
 * the caller. `Effect.tryPromise` then only has to cover a spawn that throws.
 */
function capture(args: ReadonlyArray<string>): Promise<Captured> {
  const { promise, resolve } = Promise.withResolvers<Captured>();
  execFile(
    'node',
    [...args],
    { cwd: PACKAGE_ROOT, maxBuffer: MAX_BUFFER },
    (error, stdout, stderr) => {
      resolve({ exitCode: error === null ? 0 : (error.code ?? null), stdout, stderr });
    },
  );
  return promise;
}

/** Runs the driver over the corpus and returns what it wrote to stdout. */
function runDriver(files: ReadonlyArray<string>): Effect.Effect<string, DriverFailed> {
  const command = `node analyze-driver.ts ${files.length === 0 ? '(no fixture)' : `${String(files.length)} fixtures`}`;
  return Effect.gen(function* () {
    const captured = yield* Effect.tryPromise({
      try: () => capture([DRIVER, ...files]),
      catch: (cause) => new DriverFailed({ command, exitCode: null, detail: describeCause(cause) }),
    });
    if (captured.exitCode !== 0) {
      return yield* Effect.fail(
        new DriverFailed({ command, exitCode: captured.exitCode, detail: captured.stderr }),
      );
    }
    return captured.stdout;
  });
}

/** Decodes the driver's document, or says what it wrote instead. */
function readDriverOutput(
  stdout: string,
): Effect.Effect<ReadonlyArray<DriverFixture>, DriverOutputUnreadable> {
  return Effect.mapError(
    Effect.map(decodeDriverOutput(stdout), (output) => output.fixtures),
    (error) =>
      new DriverOutputUnreadable({ detail: error.message, sample: stdout.slice(0, SAMPLE_BYTES) }),
  );
}

/**
 * Every fixture the driver could not parse, as one failure.
 *
 * A fixture that does not parse was measured by nothing, so reporting it as an
 * empty file would let a broken corpus report success.
 */
function failOnUnparsed(
  fixtures: ReadonlyArray<DriverFixture>,
): Effect.Effect<void, FixtureUnparsed> {
  const broken = fixtures.filter((fixture) => fixture.error !== undefined);
  if (broken.length === 0) return Effect.void;
  return Effect.fail(
    new FixtureUnparsed({
      file: broken[0]?.file ?? '',
      detail: broken
        .map((fixture) => `${fixture.file}: ${fixture.error ?? 'no reason given'}`)
        .join('\n'),
    }),
  );
}

/** Drops the field the driver only sets on a failure, keeping the rows typed. */
function toScored(fixture: DriverFixture): ScoredFixture {
  const functions: ReadonlyArray<ScoredFunction> = fixture.functions;
  return { file: fixture.file, functions };
}

/**
 * Measures the whole corpus.
 *
 * Every function in every fixture is returned, in the order the engine reports
 * them, so the comparison reads the same list the rules would see.
 */
export function readMeasurements(
  directory: string = FIXTURE_DIRECTORY,
): Effect.Effect<
  ReadonlyArray<ScoredFixture>,
  CorpusUnreadable | DriverFailed | DriverOutputUnreadable | FixtureUnparsed
> {
  return Effect.gen(function* () {
    const files = yield* listFixtures(directory);
    const fixtures = yield* readDriverOutput(yield* runDriver(files));
    yield* failOnUnparsed(fixtures);
    return fixtures.map((fixture) => toScored(fixture));
  });
}
