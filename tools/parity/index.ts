import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Cause, Effect } from 'effect';
import type { CollectResult } from './collect.ts';
import { collectPluginMetrics } from './collect.ts';
import type { MismatchRow, ParityReport } from './compare.ts';
import { compareMetrics } from './compare.ts';
import type { ParityError } from './errors.ts';
import { describeParityError } from './errors.ts';
import { readLeadlineRows } from './leadline.ts';

/**
 * The package root, from this file's own location.
 *
 * Every path the harness hands to a subprocess is built from this, never from
 * the working directory of the process, so `bun tools/parity/index.ts` behaves
 * the same from anywhere on disk.
 */
const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const USAGE = `Usage: bun tools/parity/index.ts [DIR]

Compares the metrics this plugin reports per function against the same functions
as scored by the leadline Rust engine.

Arguments:
  DIR   directory to compare, absolute or relative to the current directory.
        Defaults to the current directory.

Options:
  -h, --help   print this text

Environment:
  LEADLINE_BIN   path to the leadline binary, when it is not on PATH

Exit codes:
  0  every file parsed, and every compared function matched leadline
  1  a metric mismatch, a row missing on either side, an ambiguous key,
     a file that would not parse, a failed run, or no function compared at all`;

interface Invocation {
  readonly target: string;
  readonly showHelp: boolean;
  readonly unknownOption: string | null;
}

function parseArgs(argv: ReadonlyArray<string>): Invocation {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { target: '.', showHelp: true, unknownOption: null };
  }
  const unknown = argv.filter((arg) => arg.startsWith('-'));
  if (unknown.length > 0) {
    return { target: '.', showHelp: false, unknownOption: unknown.join(' ') };
  }
  return { target: argv[0] ?? '.', showHelp: false, unknownOption: null };
}

function renderMismatch(row: MismatchRow): string {
  const where = `${row.file}:${row.line} ${row.name}`;
  if (row.diffs.length === 0) {
    return `  ${row.kind.padEnd(12)} ${where.padEnd(56)} ${row.detail}`;
  }
  const fields = row.diffs
    .map((diff) => `${diff.field} plugin=${diff.plugin} leadline=${diff.leadline}`)
    .join('; ');
  return `  ${row.kind.padEnd(12)} ${where.padEnd(56)} ${fields}`;
}

function renderReport(target: string, collected: CollectResult, report: ParityReport): string {
  const summary = report.summary;
  const lines = [
    `parity: ${target}`,
    `files linted ${collected.filesLinted} | plugin rows ${summary.pluginRows} | leadline rows ${summary.leadlineRows}`,
    `compared ${summary.compared} | agreements ${summary.agreements} | mismatches ${summary.mismatches}`,
    `skipped nesting ${summary.skippedNesting} | skipped name ${summary.skippedName}`,
    `plugin rule diagnostics ${collected.ruleDiagnostics} | unlabelled ${collected.unlabelledDiagnostics}`,
  ];
  if (collected.unparsedFiles.length > 0) {
    lines.push(
      `UNPARSED FILES (${collected.unparsedFiles.length}): the plugin scored nothing in these, so every function leadline reports in them shows up as leadline-only`,
    );
    lines.push(...collected.unparsedFiles.map((file) => `  ${file.file}: ${file.detail}`));
  }
  if (summary.compared === 0) {
    lines.push('no function was compared, so parity is not proven');
  }
  if (report.rows.length > 0) {
    lines.push(`mismatches (${report.rows.length}):`);
    lines.push(...report.rows.map(renderMismatch));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Parity is proven only when something was compared, nothing disagreed, and
 * every file was readable. An unparsed file scores nothing, so treating it as
 * a pass would let a broken corpus report success.
 */
function exitCodeFor(report: ParityReport, collected: CollectResult): number {
  if (collected.unparsedFiles.length > 0) {
    return 1;
  }
  return report.summary.compared > 0 && report.summary.mismatches === 0 ? 0 : 1;
}

function runParity(target: string): Effect.Effect<number, ParityError> {
  const absoluteTarget = isAbsolute(target) ? target : resolve(process.cwd(), target);
  return Effect.gen(function* () {
    const leadlineRows = yield* readLeadlineRows(absoluteTarget, PACKAGE_ROOT);
    const collected = yield* collectPluginMetrics(absoluteTarget, PACKAGE_ROOT);
    const report = compareMetrics(collected.rows, leadlineRows);
    yield* Effect.sync(() => {
      process.stdout.write(renderReport(absoluteTarget, collected, report));
    });
    return exitCodeFor(report, collected);
  });
}

function reportFailure(error: ParityError): Effect.Effect<number> {
  return Effect.sync(() => {
    process.stderr.write(`parity: ${describeParityError(error)}\n`);
    return 1;
  });
}

function reportDefect(cause: Cause.Cause<never>): Effect.Effect<number> {
  return Effect.sync(() => {
    process.stderr.write(`parity: unexpected failure\n${Cause.pretty(cause)}\n`);
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
  if (invocation.unknownOption !== null) {
    return Effect.sync(() => {
      process.stderr.write(`parity: unknown option ${invocation.unknownOption}\n\n${USAGE}\n`);
      return 1;
    });
  }
  return Effect.catchCause(
    Effect.catchTags(runParity(invocation.target), {
      LeadlineNotFound: reportFailure,
      OxlintNotFound: reportFailure,
      CommandFailed: reportFailure,
      UnreadableOutput: reportFailure,
      ScratchWriteFailed: reportFailure,
    }),
    reportDefect,
  );
}

process.exitCode = await Effect.runPromise(run());
