import { Data } from 'effect';

/**
 * Every failure the parity harness can report.
 *
 * The harness has exactly four IO boundaries: spawning `oxlint`, spawning
 * `leadline`, and writing and removing the scratch files those runs need. Each
 * boundary fails into the union below, so no failure can be dropped and no
 * plain `Error` ever reaches the error channel.
 */

/** `leadline` is not on `PATH`, and `LEADLINE_BIN` does not point at it. */
export class LeadlineNotFound extends Data.TaggedError('LeadlineNotFound')<{
  readonly binary: string;
  readonly detail: string;
}> {}

/** The `oxlint` binary is missing from the package's `node_modules/.bin`. */
export class OxlintNotFound extends Data.TaggedError('OxlintNotFound')<{
  readonly binary: string;
  readonly detail: string;
}> {}

/** A tool started and then reported failure, or could not be started at all. */
export class CommandFailed extends Data.TaggedError('CommandFailed')<{
  readonly tool: string;
  /** A string code means the process never started, for example `ENOENT`. */
  readonly exitCode: number | string | null;
  readonly command: string;
  readonly detail: string;
}> {}

export class UnreadableOutput extends Data.TaggedError('UnreadableOutput')<{
  readonly tool: string;
  readonly detail: string;
  readonly sample: string;
}> {}

/** A scratch config, scratch plugin or scratch directory could not be handled. */
export class ScratchWriteFailed extends Data.TaggedError('ScratchWriteFailed')<{
  readonly path: string;
  readonly detail: string;
}> {}

export type ParityError =
  | LeadlineNotFound
  | OxlintNotFound
  | CommandFailed
  | UnreadableOutput
  | ScratchWriteFailed;

/**
 * Renders one harness failure for a terminal.
 *
 * A terminating branch: it returns text for every member of the union.
 */
export function describeParityError(error: ParityError): string {
  switch (error._tag) {
    case 'LeadlineNotFound':
      return `leadline binary not found: ${error.binary}\n${error.detail}`;
    case 'OxlintNotFound':
      return `oxlint binary not found: ${error.binary}\n${error.detail}`;
    case 'CommandFailed':
      return `${error.tool} failed, exit code ${error.exitCode ?? 'none'}\ncommand: ${error.command}\n${error.detail}`;
    case 'UnreadableOutput':
      return `${error.tool} wrote output this tool cannot read\n${error.detail}\nfirst bytes:\n${error.sample}`;
    case 'ScratchWriteFailed':
      return `scratch file failed at ${error.path}\n${error.detail}`;
  }
}

/**
 * Turns a rejection value from a Node IO call into one line of text.
 *
 * `unknown` is the documented error-cause convention here and nowhere else:
 * the value arrives from a rejected `Promise` at an IO boundary and is
 * rendered immediately, never stored or passed on.
 */
export function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
}
