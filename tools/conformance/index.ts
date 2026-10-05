import { join } from 'node:path';
import { Cause, Effect } from 'effect';
import { FIXTURE_DIRECTORY, PACKAGE_ROOT, readMeasurements } from './analyze.ts';
import type { ConformanceReport, DifferenceRow, ScoredFixture } from './compare.ts';
import { compareConformance } from './compare.ts';
import type { ConformanceError } from './errors.ts';
import { describeConformanceError } from './errors.ts';
import {
  EXPECTATIONS_PATH,
  expectationsFromMeasurements,
  readExpectations,
  writeExpectations,
} from './expectations.ts';

/**
 * The conformance suite on the command line.
 *
 * `bun tools/conformance/index.ts` compares every function in the corpus
 * against `test/fixtures/metrics/expected.json`. `--update` rewrites that file,
 * and says loudly that the values in it came from the implementation and are
 * only worth what a reader of `docs/metrics.md` says about them.
 */

const USAGE = `Usage: bun tools/conformance/index.ts [--update]

Compares every function in ${FIXTURE_DIRECTORY} against the recorded
expectations in ${EXPECTATIONS_PATH}. The expectations are derived from
docs/metrics.md, not from the engine.

Arguments:
  --update      rewrite the expectations file from the current run, then stop.
                Every value it writes is unverified: read each one against
                docs/metrics.md before committing it.

Options:
  -h, --help    print this text

Exit codes:
  0  every fixture parsed, every function matched the recorded expectations
  1  a metric difference, a function or fixture missing on either side,
     a fixture that did not parse, a failed run, or no function compared`;

interface Invocation {
  readonly update: boolean;
  readonly showHelp: boolean;
  /** Every argument this command does not take, as one line to print back. */
  readonly unknownArgument: string | null;
}

function parseArgs(argv: ReadonlyArray<string>): Invocation {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { update: false, showHelp: true, unknownArgument: null };
  }
  const unknown = argv.filter((arg) => arg !== '--update');
  return {
    update: argv.includes('--update'),
    showHelp: false,
    unknownArgument: unknown.length === 0 ? null : unknown.join(' '),
  };
}

function renderDifference(row: DifferenceRow): string {
  const where = `${row.fixture} ${row.identity}`;
  if (row.fields.length === 0) return `  ${row.kind.padEnd(16)} ${where} — ${row.detail}`;
  const fields = row.fields
    .map((field) => `${field.field} expected=${field.expected} measured=${field.measured}`)
    .join('; ');
  return `  ${row.kind.padEnd(16)} ${where} — ${fields}`;
}

function renderReport(report: ConformanceReport): string {
  const summary = report.summary;
  const lines = [
    `conformance: ${FIXTURE_DIRECTORY}`,
    `fixtures measured ${String(summary.measuredFixtures)} | recorded ${String(summary.expectedFixtures)}`,
    `functions measured ${String(summary.measuredFunctions)} | recorded ${String(summary.expectedFunctions)}`,
    `compared ${String(summary.compared)} | agreements ${String(summary.agreements)} | differences ${String(summary.differences)}`,
  ];
  if (summary.compared === 0) {
    lines.push('no function was compared, so the corpus proves nothing');
  }
  if (report.rows.length > 0) {
    lines.push(`differences (${String(report.rows.length)}):`);
    lines.push(...report.rows.map(renderDifference));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * What `--update` prints after it writes the file.
 *
 * Every number in that file came from the implementation, so the file is a
 * claim about the engine rather than about the specification until somebody
 * reads it against `docs/metrics.md`.
 */
function renderReviewWarning(measured: ReadonlyArray<ScoredFixture>): string {
  const functions = measured.reduce((total, fixture) => total + fixture.functions.length, 0);
  return [
    '',
    '='.repeat(72),
    '  THE VALUES IN THIS FILE CAME FROM THE ENGINE, NOT FROM THE SPEC.',
    '  They are a draft until a human has read every one of them against',
    `  docs/metrics.md and signed off. ${String(functions)} functions were rewritten.`,
    '  A change to the specification is a change to this file, made by hand.',
    '='.repeat(72),
    '',
  ].join('\n');
}

/**
 * Conformance is proven only when something was compared and nothing differed.
 *
 * A corpus that measured no function would otherwise report success, and a
 * golden file that no run could reach would prove nothing at all.
 */
function exitCodeFor(report: ConformanceReport): number {
  return report.summary.compared > 0 && report.summary.differences === 0 ? 0 : 1;
}

function check(): Effect.Effect<number, ConformanceError> {
  return Effect.gen(function* () {
    const measured = yield* readMeasurements();
    const expectations = yield* readExpectations(join(PACKAGE_ROOT, EXPECTATIONS_PATH));
    const report = compareConformance(measured, expectations);
    yield* Effect.sync(() => {
      process.stdout.write(renderReport(report));
    });
    return exitCodeFor(report);
  });
}

function update(): Effect.Effect<number, ConformanceError> {
  return Effect.gen(function* () {
    const measured = yield* readMeasurements();
    const functions = measured.reduce((total, fixture) => total + fixture.functions.length, 0);
    if (functions === 0) {
      yield* Effect.sync(() => {
        process.stdout.write('conformance: no function was measured, nothing was written\n');
      });
      return 1;
    }
    const set = expectationsFromMeasurements(measured);
    yield* writeExpectations(join(PACKAGE_ROOT, EXPECTATIONS_PATH), set);
    yield* Effect.sync(() => {
      process.stdout.write(renderReviewWarning(measured));
    });
    return 0;
  });
}

function reportFailure(error: ConformanceError): Effect.Effect<number> {
  return Effect.sync(() => {
    process.stderr.write(`conformance: ${describeConformanceError(error)}\n`);
    return 1;
  });
}

function reportDefect(cause: Cause.Cause<never>): Effect.Effect<number> {
  return Effect.sync(() => {
    process.stderr.write(`conformance: unexpected failure\n${Cause.pretty(cause)}\n`);
    return 1;
  });
}

function run(): Effect.Effect<number> {
  const invocation = parseArgs(process.argv.slice(2));
  if (invocation.showHelp) {
    return Effect.sync(() => {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    });
  }
  if (invocation.unknownArgument !== null) {
    return Effect.sync(() => {
      process.stderr.write(
        `conformance: unexpected argument ${invocation.unknownArgument}\n\n${USAGE}\n`,
      );
      return 1;
    });
  }
  const started = invocation.update ? update() : check();
  return Effect.catchCause(
    Effect.catchTags(started, {
      CorpusUnreadable: reportFailure,
      ExpectationsMissing: reportFailure,
      ExpectationsUnreadable: reportFailure,
      ExpectationsUnwritten: reportFailure,
      DriverFailed: reportFailure,
      DriverOutputUnreadable: reportFailure,
      FixtureUnparsed: reportFailure,
    }),
    reportDefect,
  );
}

process.exitCode = await Effect.runPromise(run());
