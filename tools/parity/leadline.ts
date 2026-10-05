import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { Effect, Option, Schema } from 'effect';
import { CommandFailed, LeadlineNotFound, UnreadableOutput, describeCause } from './errors.ts';

/** The binary name looked up on `PATH`, overridable for a custom install. */
const LEADLINE_BINARY = process.env['LEADLINE_BIN'] ?? 'leadline';

const MAX_BUFFER = 256 * 1024 * 1024;
const SAMPLE_BYTES = 400;

/** One function, normalised out of whatever shape leadline printed. */
export interface LeadlineRow {
  readonly file: string;
  readonly line: number;
  readonly name: string | null;
  readonly cognitive: number;
  readonly cyclomatic: number;
  /**
   * `null` when the output format carries no nesting measure.
   * `analyze --format agent-json` emits `cognitive`, `cyclomatic`, `line` and
   * `name`, and no nesting field, so the harness skips the nesting comparison
   * rather than inventing a value.
   */
  readonly maxNesting: number | null;
}

const FunctionRow = Schema.Struct({
  name: Schema.NullOr(Schema.String),
  line: Schema.Int,
  cognitive: Schema.Int,
  cyclomatic: Schema.Int,
  max_nesting: Schema.optionalKey(Schema.NullOr(Schema.Int)),
});

const FileReport = Schema.Struct({
  path: Schema.String,
  functions: Schema.Array(FunctionRow),
});

const AnalyzeOutput = Schema.Struct({ files: Schema.Array(FileReport) });

type LeadlineFunction = Schema.Schema.Type<typeof FunctionRow>;
type LeadlineFile = Schema.Schema.Type<typeof FileReport>;
type AnalyzeReport = Schema.Schema.Type<typeof AnalyzeOutput>;

const decodeAnalyzeOutput = Schema.decodeEffect(Schema.fromJsonString(AnalyzeOutput));

/** Turns the `PATH` search Node would do into a list of absolute candidates. */
function candidatesOnPath(binary: string): ReadonlyArray<string> {
  if (binary.includes('/')) {
    return [binary];
  }
  const searchPath = process.env['PATH'] ?? '';
  return searchPath
    .split(':')
    .filter((entry) => entry.length > 0)
    .map((entry) => join(entry, binary));
}

/** Resolves the binary to an absolute path, or `null` when it is not there. */
function resolveBinary(): Effect.Effect<string | null> {
  return Effect.gen(function* () {
    for (const candidate of candidatesOnPath(LEADLINE_BINARY)) {
      const found = yield* Effect.option(Effect.tryPromise(() => access(candidate)));
      if (Option.isSome(found)) {
        return candidate;
      }
    }
    return null;
  });
}

interface Captured {
  readonly exitCode: number | string | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Starts `leadline` and always resolves.
 *
 * The exit code of the child is data here, not an exception, so it survives to
 * the caller. `Effect.tryPromise` then only has to cover a spawn that throws.
 */
function capture(args: ReadonlyArray<string>, cwd: string): Promise<Captured> {
  const { promise, resolve } = Promise.withResolvers<Captured>();
  execFile(LEADLINE_BINARY, [...args], { cwd, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
    resolve({ exitCode: error === null ? 0 : (error.code ?? null), stdout, stderr });
  });
  return promise;
}

function runLeadline(target: string, packageRoot: string): Effect.Effect<string, CommandFailed> {
  const args = ['analyze', '--format', 'agent-json', target];
  const command = `${LEADLINE_BINARY} ${args.join(' ')}`;
  return Effect.gen(function* () {
    const captured = yield* Effect.tryPromise({
      try: () => capture(args, packageRoot),
      catch: (cause) =>
        new CommandFailed({
          tool: 'leadline',
          exitCode: null,
          command,
          detail: describeCause(cause),
        }),
    });
    if (captured.exitCode !== 0) {
      return yield* Effect.fail(
        new CommandFailed({
          tool: 'leadline',
          exitCode: captured.exitCode,
          command,
          detail: captured.stderr,
        }),
      );
    }
    return captured.stdout;
  });
}

function readAnalyzeOutput(stdout: string): Effect.Effect<AnalyzeReport, UnreadableOutput> {
  return Effect.mapError(
    decodeAnalyzeOutput(stdout),
    (error) =>
      new UnreadableOutput({
        tool: 'leadline',
        detail: error.message,
        sample: stdout.slice(0, SAMPLE_BYTES),
      }),
  );
}

function toRow(file: LeadlineFile, fn: LeadlineFunction): LeadlineRow {
  return {
    file: file.path,
    line: fn.line,
    name: fn.name,
    cognitive: fn.cognitive,
    cyclomatic: fn.cyclomatic,
    maxNesting: fn.max_nesting ?? null,
  };
}

/**
 * Runs `leadline analyze` over `target` and returns its rows.
 *
 * `target` is absolute. `packageRoot` is the working directory of the child, so
 * leadline resolves its own project files the same way on every run.
 */
export function readLeadlineRows(
  target: string,
  packageRoot: string,
): Effect.Effect<ReadonlyArray<LeadlineRow>, LeadlineNotFound | CommandFailed | UnreadableOutput> {
  return Effect.gen(function* () {
    const binary = yield* resolveBinary();
    if (binary === null) {
      return yield* Effect.fail(
        new LeadlineNotFound({
          binary: LEADLINE_BINARY,
          detail: 'install leadline, or set LEADLINE_BIN to its absolute path',
        }),
      );
    }
    const stdout = yield* runLeadline(target, packageRoot);
    const report = yield* readAnalyzeOutput(stdout);
    return report.files.flatMap((file) => file.functions.map((fn) => toRow(file, fn)));
  });
}
