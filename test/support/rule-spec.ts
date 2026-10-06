import type { Options } from '@oxlint/plugins';

/**
 * The contract between the two halves of the rule tests.
 *
 * `bun test` collects the cases and owns the reporting, but oxlint's
 * `RuleTester` refuses to run under Bun: it checks for a Bun global and
 * reports that its raw AST transfer is unsupported here. So the cases cross
 * into a short-lived Node process, which runs `RuleTester` over them and sends
 * one outcome per case back. This module is the shape of that exchange, read
 * by both halves.
 *
 * It is deliberately not `RuleTester.TestCases`. A `RegExp` does not survive
 * `JSON.stringify`, so a message matcher is written either as a string or as
 * the two pieces a regular expression is made of, and the driver rebuilds it.
 */

/** A JSON object, the only shape whose fields can be read by name. */
export interface JsonRecord {
  readonly [key: string]: JsonValue;
}

/** Every value JSON can carry, and so the whole domain of this bridge. */
export type JsonValue = JsonRecord | readonly JsonValue[] | string | number | boolean | null;

/*
 * The shapes the decoders ask about. Each is a type predicate, so the
 * representation test that defines it is the one place a `typeof` tag is
 * read, and every caller branches on a named type instead.
 *
 * A field read off a JSON record can be absent, so `undefined` is part of what
 * each one answers for: "not there" is not a value, and none of these claim it.
 */

/** True for a JSON object. */
export function isRecord(value: JsonValue | undefined): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True for a JSON string. */
export function isText(value: JsonValue | undefined): value is string {
  return typeof value === 'string';
}

/** True for a JSON number, which is the only count a case may state. */
export function isCount(value: JsonValue | undefined): value is number {
  return typeof value === 'number';
}

/** True for a JSON list. */
export function isList(value: JsonValue | undefined): value is readonly JsonValue[] {
  return Array.isArray(value);
}

/** True for a list of rule options, which is what `RuleTester` binds. */
export function isOptions(value: JsonValue | undefined): value is Options {
  return Array.isArray(value);
}

/** A regular expression in the two pieces JSON can carry. */
export interface Pattern {
  readonly pattern: string;
  readonly flags: string;
}

/** What `RuleTester` accepts as a message matcher, in a form JSON can carry. */
export type MessageMatcher = string | Pattern;

/** One expected error. Only the fields a test pins are modelled. */
export interface ExpectedError {
  readonly messageId?: string;
  readonly message?: MessageMatcher;
}

/** What every case has in common. */
interface CaseBase {
  /** What the test is called in the Bun report. Defaults to the code. */
  readonly name?: string;
  readonly code: string;
  readonly options?: Options;
}

/** A case the rule must accept without reporting anything. */
export type ValidCase = CaseBase;

/** A case the rule must report, with what it has to report. */
export interface InvalidCase extends CaseBase {
  readonly errors: number | readonly (string | ExpectedError)[];
}

/** Every case for one rule. */
export interface RuleSpec {
  /** The name `oxlint.config.ts` activates the plugin under. */
  readonly plugin: string;
  /** The name the plugin publishes the rule under, without the plugin prefix. */
  readonly rule: string;
  readonly cases: {
    readonly valid: readonly ValidCase[];
    readonly invalid: readonly InvalidCase[];
  };
}

/** Which half of the case list one case came from. */
export type CaseKind = 'valid' | 'invalid';

/** What the Node process reports back about one case. */
export interface CaseOutcome {
  readonly name: string;
  readonly kind: CaseKind;
  /** `null` when `RuleTester` accepted the case. */
  readonly error: string | null;
}
