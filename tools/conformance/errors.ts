import { Data } from 'effect';

/**
 * Every failure the conformance suite can report.
 *
 * The suite has five IO boundaries: reading the fixture directory, reading the
 * expectations file, writing it back, spawning the Node driver, and decoding
 * what the driver wrote. Each boundary fails into the union below, so a
 * failure can be named, never dropped, and no plain `Error` reaches the error
 * channel.
 */

/** The fixture directory could not be listed. */
export class CorpusUnreadable extends Data.TaggedError('CorpusUnreadable')<{
  readonly directory: string;
  readonly detail: string;
}> {}

/**
 * The expectations file is not there.
 *
 * Its own tag, because a missing golden file must never read as a clean run:
 * the suite cannot pass a file it was never given.
 */
export class ExpectationsMissing extends Data.TaggedError('ExpectationsMissing')<{
  readonly path: string;
  readonly detail: string;
}> {}

/** The expectations file is there but is not what the suite can read. */
export class ExpectationsUnreadable extends Data.TaggedError('ExpectationsUnreadable')<{
  readonly path: string;
  readonly detail: string;
}> {}

/** The expectations file could not be rewritten. */
export class ExpectationsUnwritten extends Data.TaggedError('ExpectationsUnwritten')<{
  readonly path: string;
  readonly detail: string;
}> {}

/** The Node driver could not be started, or reported failure. */
export class DriverFailed extends Data.TaggedError('DriverFailed')<{
  readonly command: string;
  /** A string code means the process never started, for example `ENOENT`. */
  readonly exitCode: number | string | null;
  readonly detail: string;
}> {}

/** The Node driver wrote something the suite cannot decode. */
export class DriverOutputUnreadable extends Data.TaggedError('DriverOutputUnreadable')<{
  readonly detail: string;
  readonly sample: string;
}> {}

/** A fixture did not parse, so it was measured by nothing. */
export class FixtureUnparsed extends Data.TaggedError('FixtureUnparsed')<{
  readonly file: string;
  readonly detail: string;
}> {}

export type ConformanceError =
  | CorpusUnreadable
  | ExpectationsMissing
  | ExpectationsUnreadable
  | ExpectationsUnwritten
  | DriverFailed
  | DriverOutputUnreadable
  | FixtureUnparsed;

/**
 * Renders one suite failure for a terminal.
 *
 * A terminating branch: it returns text for every member of the union.
 */
export function describeConformanceError(error: ConformanceError): string {
  switch (error._tag) {
    case 'CorpusUnreadable':
      return `fixture directory could not be listed: ${error.directory}\n${error.detail}`;
    case 'ExpectationsMissing':
      return (
        `expectations file not found: ${error.path}\n${error.detail}\n` +
        'run `bun tools/conformance --update` to write one, then review every value in it against docs/metrics.md'
      );
    case 'ExpectationsUnreadable':
      return `expectations file could not be read: ${error.path}\n${error.detail}`;
    case 'ExpectationsUnwritten':
      return `expectations file could not be written: ${error.path}\n${error.detail}`;
    case 'DriverFailed':
      return `the analyze driver failed, exit code ${error.exitCode ?? 'none'}\ncommand: ${error.command}\n${error.detail}`;
    case 'DriverOutputUnreadable':
      return `the analyze driver wrote output this suite cannot read\n${error.detail}\nfirst bytes:\n${error.sample}`;
    case 'FixtureUnparsed':
      return `fixture did not parse: ${error.file}\n${error.detail}`;
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
