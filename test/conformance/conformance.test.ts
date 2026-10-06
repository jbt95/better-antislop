import { deepEqual, equal, ok } from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Cause, Effect, Exit, Option } from 'effect';
import { describe, it } from 'bun:test';
import { PACKAGE_ROOT, readMeasurements } from '../../tools/conformance/analyze.ts';
import type {
  ConformanceReport,
  DifferenceRow,
  ScoredFunction,
} from '../../tools/conformance/compare.ts';
import { compareConformance } from '../../tools/conformance/compare.ts';
import type { ConformanceError } from '../../tools/conformance/errors.ts';
import { describeConformanceError } from '../../tools/conformance/errors.ts';
import { EXPECTATIONS_PATH, readExpectations } from '../../tools/conformance/expectations.ts';

/**
 * The conformance suite as a test.
 *
 * It measures the corpus, reads the golden file and hands both to the same
 * `compareConformance` the command line tool uses, so a pass here and a clean
 * `bun tools/conformance/index.ts` mean one thing. Re-implementing the
 * comparison inside the test would let the two drift, and a test that agreed
 * with itself would prove nothing about the engine.
 *
 * `describe` and `it` come from `bun:test`, declared in `test/support/bun-test.d.ts`.
 */

/** Where the golden file sits, reached the same way the tool reaches it. */
const GOLDEN_PATH = join(PACKAGE_ROOT, EXPECTATIONS_PATH);

/** One difference as one line a reader can act on. */
function describeDifference(row: DifferenceRow): string {
  if (row.fields.length === 0) return `  ${row.kind} ${row.fixture} ${row.identity}: ${row.detail}`;
  const fields = row.fields
    .map((field) => `${field.field} expected=${field.expected} measured=${field.measured}`)
    .join('; ');
  return `  ${row.kind} ${row.fixture} ${row.identity}: ${fields}`;
}

/** The whole report, so a failure shows every difference rather than the first. */
function renderReport(report: ConformanceReport): string {
  const summary = report.summary;
  return [
    `fixtures measured ${String(summary.measuredFixtures)}, recorded ${String(summary.expectedFixtures)}`,
    `functions measured ${String(summary.measuredFunctions)}, recorded ${String(summary.expectedFunctions)}`,
    `compared ${String(summary.compared)}, agreements ${String(summary.agreements)}, differences ${String(summary.differences)}`,
    ...report.rows.map(describeDifference),
  ].join('\n');
}

/** What a failed measurement throws out of this file. */
function failWith(error: ConformanceError): Effect.Effect<never> {
  return Effect.die(new Error(describeConformanceError(error)));
}

/** What a defect throws out of this file. */
function failWithDefect(cause: Cause.Cause<never>): Effect.Effect<never> {
  return Effect.die(new Error(`conformance: unexpected failure\n${Cause.pretty(cause)}`));
}

/** Measure the corpus, read the golden file, and compare the two. */
function runSuite(): Effect.Effect<ConformanceReport, ConformanceError> {
  return Effect.gen(function* () {
    const measured = yield* readMeasurements();
    const expectations = yield* readExpectations(GOLDEN_PATH);
    return compareConformance(measured, expectations);
  });
}

/**
 * One measurement and one comparison for the whole file.
 *
 * Measuring the corpus spawns a Node process and walks 70 files, so it happens
 * once here rather than once per assertion: the three checks below read the one
 * report. The outcome is a value rather than a throw, so a suite that cannot
 * run is reported by the assertions with the same text the command line tool
 * prints, instead of escaping as an unhandled rejection.
 */
const settled = await Effect.runPromiseExit(
  Effect.catchCause(
    Effect.catchTags(runSuite(), {
      CorpusUnreadable: failWith,
      ExpectationsMissing: failWith,
      ExpectationsUnreadable: failWith,
      ExpectationsUnwritten: failWith,
      DriverFailed: failWith,
      DriverOutputUnreadable: failWith,
      FixtureUnparsed: failWith,
    }),
    failWithDefect,
  ),
);

const outcome: ConformanceReport | Error = Exit.isSuccess(settled)
  ? settled.value
  : new Error(Cause.pretty(settled.cause));

describe('conformance', () => {
  it('matches the recorded expectations for every function of every fixture', () => {
    if (outcome instanceof Error) throw outcome;
    if (outcome.summary.differences > 0) {
      throw new Error(`the engine disagrees with docs/metrics.md:\n${renderReport(outcome)}`);
    }
  });

  it('compared at least one function', () => {
    if (outcome instanceof Error) throw outcome;
    if (outcome.summary.compared === 0) {
      throw new Error('nothing was compared, so the corpus proves nothing');
    }
  });

  it('recorded a function for every fixture it measured', () => {
    if (outcome instanceof Error) throw outcome;
    if (outcome.summary.measuredFunctions !== outcome.summary.expectedFunctions) {
      throw new Error(
        `the golden file records ${String(outcome.summary.expectedFunctions)} functions and this run measured ${String(outcome.summary.measuredFunctions)}`,
      );
    }
  });
});
const TEST_FILE = 'test/conformance/sample.ts';
const TEST_IDENTITY = 'function sample 2:3 ()';

const TEST_FUNCTION: ScoredFunction = {
  kind: 'function',
  name: 'sample',
  line: 2,
  column: 3,
  signature: '()',
  lines: 4,
  logicalLines: 2,
  parameters: 0,
  cyclomatic: 1,
  cognitive: 0,
  maxNesting: 0,
  halstead: {
    distinctOperators: 1,
    distinctOperands: 2,
    totalOperators: 1,
    totalOperands: 2,
    vocabulary: 3,
    length: 3,
    volume: 4,
    difficulty: 0.5,
    effort: 2,
  },
  maintainabilityIndex: 90,
  recursive: false,
};

function compareFunctions(
  measured: ReadonlyArray<ScoredFunction>,
  expected: ReadonlyArray<ScoredFunction>,
): ConformanceReport {
  return compareConformance([{ file: TEST_FILE, functions: measured }], {
    fixtures: { [TEST_FILE]: { functions: expected } },
  });
}

function expectOneDifference(
  report: ConformanceReport,
  summary: ConformanceReport['summary'],
  row: DifferenceRow,
): void {
  deepEqual(report, { summary, rows: [row] });
}

async function failureOf<A, E>(effect: Effect.Effect<A, E>): Promise<E> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) throw new Error('expected a typed Effect failure');
  const failure = Exit.findErrorOption(exit);
  if (Option.isNone(failure)) throw new Error('expected a typed Effect failure');
  return failure.value;
}

async function withTemporaryDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'better-antislop-conformance-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('compareConformance values', () => {
  it('reports changed metric values with the function identity and summary', () => {
    const report = compareFunctions([{ ...TEST_FUNCTION, lines: 5 }], [TEST_FUNCTION]);
    expectOneDifference(
      report,
      {
        measuredFixtures: 1,
        expectedFixtures: 1,
        measuredFunctions: 1,
        expectedFunctions: 1,
        compared: 1,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'value',
        fixture: TEST_FILE,
        identity: TEST_IDENTITY,
        detail: '1 of the metrics the specification defines differ',
        fields: [{ field: 'lines', expected: '4', measured: '5' }],
      },
    );
  });
});

describe('compareConformance function identities', () => {
  it('reports a measured function that has no recorded identity', () => {
    const report = compareFunctions([TEST_FUNCTION], []);
    expectOneDifference(
      report,
      {
        measuredFixtures: 1,
        expectedFixtures: 1,
        measuredFunctions: 1,
        expectedFunctions: 0,
        compared: 0,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'measured-only',
        fixture: TEST_FILE,
        identity: TEST_IDENTITY,
        detail: 'the specification file records no function with this identity',
        fields: [],
      },
    );
  });

  it('reports a recorded function that was not measured', () => {
    const report = compareFunctions([], [TEST_FUNCTION]);
    expectOneDifference(
      report,
      {
        measuredFixtures: 1,
        expectedFixtures: 1,
        measuredFunctions: 0,
        expectedFunctions: 1,
        compared: 0,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'expected-only',
        fixture: TEST_FILE,
        identity: TEST_IDENTITY,
        detail: 'this run measured no function with this identity',
        fields: [],
      },
    );
  });

  it('reports a duplicated identity as ambiguous', () => {
    const report = compareFunctions([TEST_FUNCTION, TEST_FUNCTION], [TEST_FUNCTION]);
    expectOneDifference(
      report,
      {
        measuredFixtures: 1,
        expectedFixtures: 1,
        measuredFunctions: 2,
        expectedFunctions: 1,
        compared: 0,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'ambiguous',
        fixture: TEST_FILE,
        identity: TEST_IDENTITY,
        detail: 'the identity matches 2 measured and 1 recorded functions',
        fields: [],
      },
    );
  });
});

describe('compareConformance fixture identities', () => {
  it('reports a measured fixture that has no recorded entry', () => {
    const report = compareConformance([{ file: TEST_FILE, functions: [] }], { fixtures: {} });
    expectOneDifference(
      report,
      {
        measuredFixtures: 1,
        expectedFixtures: 0,
        measuredFunctions: 0,
        expectedFunctions: 0,
        compared: 0,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'measured-fixture',
        fixture: TEST_FILE,
        identity: TEST_FILE,
        detail: 'the specification file has no entry for this fixture',
        fields: [],
      },
    );
  });

  it('reports a recorded fixture that was not measured', () => {
    const report = compareConformance([], {
      fixtures: { [TEST_FILE]: { functions: [] } },
    });
    expectOneDifference(
      report,
      {
        measuredFixtures: 0,
        expectedFixtures: 1,
        measuredFunctions: 0,
        expectedFunctions: 0,
        compared: 0,
        agreements: 0,
        differences: 1,
      },
      {
        kind: 'expected-fixture',
        fixture: TEST_FILE,
        identity: TEST_FILE,
        detail: 'this run measured no such fixture',
        fields: [],
      },
    );
  });
});

describe('conformance IO boundaries', () => {
  it('identifies a missing expectations file and its path', async () => {
    await withTemporaryDirectory(async (directory) => {
      const path = join(directory, 'expected.json');
      const error = await failureOf(readExpectations(path));
      if (error._tag !== 'ExpectationsMissing') {
        throw new Error(`expected ExpectationsMissing, received ${error._tag}`);
      }
      equal(error.path, path);
      equal(error.detail, 'there is no golden file to compare a run against');
    });
  });

  it('identifies malformed expectations and reports the schema failure', async () => {
    await withTemporaryDirectory(async (directory) => {
      const path = join(directory, 'expected.json');
      await writeFile(path, '{}', 'utf8');
      const error = await failureOf(readExpectations(path));
      if (error._tag !== 'ExpectationsUnreadable') {
        throw new Error(`expected ExpectationsUnreadable, received ${error._tag}`);
      }
      equal(error.path, path);
      ok(error.detail.includes('specification'));
    });
  });

  it('preserves the OS cause when the fixture directory cannot be listed', async () => {
    await withTemporaryDirectory(async (directory) => {
      const missingDirectory = join(directory, 'missing-corpus');
      const error = await failureOf(readMeasurements(missingDirectory));
      if (error._tag !== 'CorpusUnreadable') {
        throw new Error(`expected CorpusUnreadable, received ${error._tag}`);
      }
      equal(error.directory, missingDirectory);
      ok(error.detail.includes('ENOENT'));
    });
  });
});
