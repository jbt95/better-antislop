import { readFileSync } from 'node:fs';
import { RuleTester } from 'oxlint/plugins-dev';
import type { Options, Plugin, Rule } from '@oxlint/plugins';
import metricsPlugin from '../../src/index.ts';
import opinionatedPlugin from '../../src/opinionated/index.ts';
import {
  isCount,
  isList,
  isOptions,
  isRecord,
  isText,
  type CaseKind,
  type CaseOutcome,
  type JsonRecord,
  type JsonValue,
} from './rule-spec.ts';

/**
 * The Node half of the rule tests.
 *
 * oxlint's `RuleTester` is the only supported way to drive a rule, and it
 * refuses to run under Bun, so `bun test` hands the cases to this process and
 * reads one outcome per case back from stdout. Every case runs in its own
 * `RuleTester.run` call so a malformed case fails alone instead of poisoning
 * the ones after it.
 *
 * The cases arrive as JSON, which is the only untyped thing in this file. Each
 * decoder reads its argument once and hands the named shape inward, so nothing
 * below `decodeSpec` ever looks at a raw representation tag.
 */

/** Every plugin this package publishes, under the name a consumer configures. */
const PUBLISHED: Readonly<Record<string, Plugin>> = {
  'better-antislop-metrics': metricsPlugin,
  'better-antislop': opinionatedPlugin,
};

/** Fixtures are TypeScript: several rules only have anything to say about types. */
const TESTER = new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } },
});

/** The spec once decoded: the same cases, in the shapes `RuleTester` wants. */
interface DecodedSpec {
  readonly plugin: string;
  readonly rule: string;
  readonly cases: {
    readonly valid: RuleTester.ValidTestCase[];
    readonly invalid: RuleTester.InvalidTestCase[];
  };
}

/** The fields both halves of the case list have, already read into their types. */
interface DecodedBase {
  readonly code: string;
  readonly name?: string;
  readonly options?: Options;
}

/** Read an optional string field, rejecting one that is present but not a string. */
function optionalText(source: JsonRecord, key: string): string | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (!isText(value)) throw new Error(`${key} must be a string when it is present`);
  return value;
}

/** Read the optional `options` field, which `RuleTester` binds per file. */
function optionalOptions(source: JsonRecord): Options | undefined {
  if (!('options' in source)) return undefined;
  const value = source['options'];
  if (!isOptions(value)) throw new Error('options must be a list');
  return value;
}

/** Rebuild the matcher `RuleTester` expects from what JSON can carry. */
function decodeMatcher(matcher: JsonValue): string | RegExp {
  if (isText(matcher)) return matcher;
  if (!isRecord(matcher)) throw new Error('a message matcher must be a string or a pattern');
  const { flags, pattern } = matcher;
  if (!isText(pattern) || !isText(flags)) {
    throw new Error('a pattern needs a pattern string and a flags string');
  }
  return new RegExp(pattern, flags);
}

function decodeError(entry: JsonValue): RuleTester.Error | string {
  if (isText(entry)) return entry;
  if (!isRecord(entry)) throw new Error('a test error must be a string or an object');
  const messageId = optionalText(entry, 'messageId');
  if (messageId !== undefined) {
    return 'message' in entry
      ? { messageId, message: decodeMatcher(entry['message']) }
      : { messageId };
  }
  if (!('message' in entry)) throw new Error('a test error needs a message or a messageId');
  return { message: decodeMatcher(entry['message']) };
}

function decodeErrors(errors: JsonValue): RuleTester.InvalidTestCase['errors'] {
  if (isCount(errors)) return errors;
  if (!isList(errors)) throw new Error('an invalid case needs a count or a list of errors');
  return errors.map((entry) => decodeError(entry));
}

function decodeBase(entry: JsonValue): DecodedBase {
  if (!isRecord(entry)) throw new Error('a test case must be an object');
  const code = entry['code'];
  if (!isText(code)) throw new Error('a test case needs a code');
  const name = optionalText(entry, 'name');
  const options = optionalOptions(entry);
  return {
    code,
    ...(name === undefined ? {} : { name }),
    ...(options === undefined ? {} : { options }),
  };
}

function decodeInvalidCase(entry: JsonValue): RuleTester.InvalidTestCase {
  if (!isRecord(entry)) throw new Error('a test case must be an object');
  if (!('errors' in entry)) throw new Error('an invalid case needs errors');
  return { ...decodeBase(entry), errors: decodeErrors(entry['errors']) };
}

/**
 * True for anything `JSON.parse` can hand back.
 *
 * `JSON.parse` is typed as returning `any`, so this is the one place the raw
 * text becomes a value with a name: the return type is a type predicate
 * because that is where the guarantee lives, and the parameter is `unknown`
 * because nothing has a type for it until the check has run. Every decoder
 * below takes `JsonValue`, so no representation tag is read after this.
 */
function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  if (typeof value === 'object') {
    return Object.values(value).every((entry) => isJsonValue(entry));
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * The two halves of the case list, each one decoded before it is used.
 *
 * Both halves come out of the same JSON object, so the shape check and the
 * two reads are kept together here and `decodeSpec` stays the boundary it
 * claims to be.
 */
function decodeCases(cases: JsonRecord): DecodedSpec['cases'] {
  const valid = cases['valid'];
  const invalid = cases['invalid'];
  if (!isList(valid) || !isList(invalid)) {
    throw new Error('the spec needs a valid and an invalid case list');
  }
  return {
    valid: valid.map((entry) => decodeBase(entry)),
    invalid: invalid.map((entry) => decodeInvalidCase(entry)),
  };
}

/**
 * Decode the JSON the Bun side wrote.
 *
 * This is the process boundary, so the cases are read field by field rather
 * than taken on trust: everything downstream works on the named shapes.
 */
function decodeSpec(raw: string): DecodedSpec {
  const parsed: unknown = JSON.parse(raw);
  if (!isJsonValue(parsed)) throw new Error('the spec must be JSON');
  if (!isRecord(parsed)) throw new Error('the spec must be a JSON object');
  const plugin = parsed['plugin'];
  const rule = parsed['rule'];
  if (!isText(plugin)) throw new Error('the spec needs a string plugin');
  if (!isText(rule)) throw new Error('the spec needs a string rule');
  const cases = parsed['cases'];
  if (!isRecord(cases)) throw new Error('the spec needs a cases object');
  return { plugin, rule, cases: decodeCases(cases) };
}

function resolveRule(spec: DecodedSpec): Rule {
  const plugin = PUBLISHED[spec.plugin];
  if (plugin === undefined) throw new Error(`no plugin is published as ${spec.plugin}`);
  const rule = plugin.rules[spec.rule];
  if (rule === undefined) throw new Error(`${spec.plugin} publishes no rule ${spec.rule}`);
  return rule;
}

/** Run one case on its own and turn whatever it throws into an outcome. */
function report(name: string, kind: CaseKind, run: () => void): CaseOutcome {
  try {
    run();
    return { name, kind, error: null };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { name, kind, error: text };
  }
}

function label(testCase: DecodedBase): string {
  return testCase.name === undefined ? testCase.code : testCase.name;
}

const spec: DecodedSpec = decodeSpec(readFileSync(0, 'utf8'));
const rule: Rule = resolveRule(spec);
const reported: CaseOutcome[] = [];

for (const testCase of spec.cases.valid) {
  reported.push(
    report(label(testCase), 'valid', () => {
      TESTER.run(spec.rule, rule, { valid: [testCase], invalid: [] });
    }),
  );
}
for (const testCase of spec.cases.invalid) {
  reported.push(
    report(label(testCase), 'invalid', () => {
      TESTER.run(spec.rule, rule, { valid: [], invalid: [testCase] });
    }),
  );
}
for (const outcome of reported) {
  process.stdout.write(`${JSON.stringify(outcome)}\n`);
}
