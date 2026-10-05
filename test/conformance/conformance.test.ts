import { join } from 'node:path';
import { Cause, Effect, Exit } from 'effect';
import { describe, it } from 'bun:test';
import { PACKAGE_ROOT, readMeasurements } from '../../tools/conformance/analyze.ts';
import type { ConformanceReport, DifferenceRow } from '../../tools/conformance/compare.ts';
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
