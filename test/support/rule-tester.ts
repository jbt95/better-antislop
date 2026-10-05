import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'bun:test';
import {
  isRecord,
  isText,
  type CaseOutcome,
  type JsonRecord,
  type JsonValue,
  type RuleSpec,
} from './rule-spec.ts';

/**
 * The `bun test` half of the rule tests.
 *
 * oxlint's `RuleTester` is the only supported way to drive a rule and it
 * refuses to run under Bun, so each rule's cases are handed to a short-lived
 * Node process that runs `RuleTester` over them. This module keeps the Bun
 * side of that exchange small: one child process per rule, one Bun test per
 * case, and the failure text `RuleTester` produced reported verbatim.
 */

const DRIVER = join(dirname(fileURLToPath(import.meta.url)), 'rule-driver.ts');

/** The Node binary. Bun cannot host `RuleTester`, so the tests need the real one. */
const NODE = 'node';

function isOutcome(value: JsonValue): value is JsonRecord & CaseOutcome {
  if (!isRecord(value)) return false;
  const { error, kind, name } = value;
  return (
    isText(name) && (kind === 'valid' || kind === 'invalid') && (error === null || isText(error))
  );
}

/** One outcome per line, checked as it is read rather than assumed. */
function readOutcomes(stdout: string): CaseOutcome[] {
  const outcomes: CaseOutcome[] = [];
  for (const line of stdout.split('\n')) {
    if (line.length === 0) continue;
    const parsed: JsonValue = JSON.parse(line);
    if (!isOutcome(parsed)) throw new Error(`the rule driver sent something unexpected: ${line}`);
    outcomes.push(parsed);
  }
  return outcomes;
}

/**
 * Ask the Node driver what `RuleTester` makes of every case in `spec`.
 *
 * A driver that cannot start, or that dies before reporting, is a broken test
 * setup rather than a rule failure, so it throws here and fails the file.
 */
function collectOutcomes(spec: RuleSpec): CaseOutcome[] {
  const child = spawnSync(NODE, [DRIVER], {
    input: JSON.stringify(spec),
    encoding: 'utf8',
  });
  if (child.error !== undefined) throw child.error;
  if (child.status !== 0) {
    throw new Error(`the rule driver exited with ${String(child.status)}:\n${child.stderr}`);
  }
  const outcomes = readOutcomes(child.stdout);
  const expected = spec.cases.valid.length + spec.cases.invalid.length;
  if (outcomes.length !== expected) {
    throw new Error(`the rule driver reported ${outcomes.length} of ${expected} cases`);
  }
  return outcomes;
}

/** Register one Bun test per case, keeping `RuleTester`'s verdict for each. */
export function describeRule(spec: RuleSpec): void {
  const outcomes = collectOutcomes(spec);
  describe(spec.plugin, () => {
    describe(spec.rule, () => {
      for (const outcome of outcomes) {
        it(`${outcome.kind}: ${outcome.name}`, () => {
          if (outcome.error !== null) throw new Error(outcome.error);
        });
      }
    });
  });
}
