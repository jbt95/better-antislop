import type { ExpectedFixture, ScoredFixture, ScoredFunction } from './model.ts';
export type { ExpectedFixture, ScoredFixture, ScoredFunction };

/**
 * The comparison between a fresh measurement run and the recorded expectation.
 *
 * This module is pure. It reads no file, starts no process, and knows nothing
 * about Effect, so `bun test` and the command line tool can both compare
 * through the same code and a difference means the same thing to both.
 */

/** The whole golden file: every fixture, keyed by its path. */
export interface ExpectationSet {
  readonly fixtures: Readonly<Record<string, ExpectedFixture>>;
}

/** Why one pair did not agree. */
export type DifferenceKind =
  | 'value'
  | 'measured-only'
  | 'expected-only'
  | 'ambiguous'
  | 'measured-fixture'
  | 'expected-fixture';

/** One metric that differs, with both numbers as they were read. */
export interface FieldDifference {
  readonly field: string;
  readonly expected: string;
  readonly measured: string;
}

/** One function that did not compare clean, and why. */
export interface DifferenceRow {
  readonly kind: DifferenceKind;
  readonly fixture: string;
  readonly identity: string;
  readonly detail: string;
  readonly fields: ReadonlyArray<FieldDifference>;
}

/** The counts a report is summarised by. */
export interface ConformanceSummary {
  readonly measuredFixtures: number;
  readonly expectedFixtures: number;
  readonly measuredFunctions: number;
  readonly expectedFunctions: number;
  readonly compared: number;
  readonly agreements: number;
  readonly differences: number;
}

/** Everything a run of the comparison produced. */
export interface ConformanceReport {
  readonly summary: ConformanceSummary;
  readonly rows: ReadonlyArray<DifferenceRow>;
}

/**
 * The counts and the Halstead values, in the order they are reported.
 *
 * A fixed order is what makes two runs over one corpus print the same lines,
 * and it is what makes a diff of two reports readable.
 */
const COUNTED_FIELDS = [
  'lines',
  'logicalLines',
  'parameters',
  'cyclomatic',
  'cognitive',
  'maxNesting',
  'recursive',
  'maintainabilityIndex',
] as const;

const HALSTEAD_FIELDS = [
  'distinctOperators',
  'distinctOperands',
  'totalOperators',
  'totalOperands',
  'vocabulary',
  'length',
  'volume',
  'difficulty',
  'effort',
] as const;

/** How a kind of difference is ordered inside one fixture. */
const KIND_ORDER: Record<DifferenceKind, number> = {
  value: 0,
  'measured-only': 1,
  'expected-only': 2,
  ambiguous: 3,
  'measured-fixture': 4,
  'expected-fixture': 5,
};

const ANONYMOUS = '<anonymous>';

/** The join key. Two functions compare when this string is equal. */
function identityOf(fn: ScoredFunction): string {
  return `${fn.kind} ${fn.name ?? ANONYMOUS} ${String(fn.line)}:${String(fn.column)} ${fn.signature}`;
}

/** Every metric of one function, read field by field so each can differ alone. */
function differencesOf(
  expected: ScoredFunction,
  measured: ScoredFunction,
): ReadonlyArray<FieldDifference> {
  const found: FieldDifference[] = [];
  for (const field of COUNTED_FIELDS) {
    const before = String(expected[field]);
    const after = String(measured[field]);
    if (before !== after) found.push({ field, expected: before, measured: after });
  }
  for (const field of HALSTEAD_FIELDS) {
    const before = String(expected.halstead[field]);
    const after = String(measured.halstead[field]);
    if (before !== after) {
      found.push({ field: `halstead.${field}`, expected: before, measured: after });
    }
  }
  return found;
}

/** Groups rows by join key, keeping every row that carries the key. */
function indexByIdentity(functions: ReadonlyArray<ScoredFunction>): Map<string, ScoredFunction[]> {
  const index = new Map<string, ScoredFunction[]>();
  for (const fn of functions) {
    const key = identityOf(fn);
    const bucket = index.get(key);
    if (bucket === undefined) {
      index.set(key, [fn]);
    } else {
      bucket.push(fn);
    }
  }
  return index;
}

/** Sorts rows so one function's differences sit together and two runs agree. */
function byLocation(left: DifferenceRow, right: DifferenceRow): number {
  if (left.fixture !== right.fixture) return left.fixture < right.fixture ? -1 : 1;
  if (KIND_ORDER[left.kind] !== KIND_ORDER[right.kind]) {
    return KIND_ORDER[left.kind] - KIND_ORDER[right.kind];
  }
  return left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0;
}

/** What one fixture's two function lists added up to. */
interface Tally {
  measured: number;
  expected: number;
  compared: number;
  agreements: number;
}

/** Reports one matched pair, or none at all when nothing differs. */
function pairRows(
  fixture: string,
  expected: ScoredFunction,
  measured: ScoredFunction,
  tally: Tally,
): DifferenceRow[] {
  tally.compared += 1;
  const fields = differencesOf(expected, measured);
  if (fields.length === 0) {
    tally.agreements += 1;
    return [];
  }
  const identity = identityOf(measured);
  return [
    {
      kind: 'value',
      fixture,
      identity,
      detail: `${String(fields.length)} of the metrics the specification defines differ`,
      fields,
    },
  ];
}

/**
 * A row for one function the join could not settle, with no field to show.
 */
function gapRow(
  kind: DifferenceKind,
  fixture: string,
  identity: string,
  detail: string,
): DifferenceRow {
  return { kind, fixture, identity, detail, fields: [] };
}

/** The row for a measured function the golden file does not record. */
function measuredOnlyRow(fixture: string, identity: string): DifferenceRow {
  return gapRow(
    'measured-only',
    fixture,
    identity,
    'the specification file records no function with this identity',
  );
}

/** The row for an identity that more than one function claims. */
function ambiguousRow(
  fixture: string,
  identity: string,
  measured: number,
  recorded: number,
): DifferenceRow {
  const detail = `the identity matches ${String(measured)} measured and ${String(recorded)} recorded functions`;
  return gapRow('ambiguous', fixture, identity, detail);
}

/**
 * Reports every measured function against what the golden file records.
 *
 * A key that appears twice on one side is not silently collapsed: two functions
 * that claim one identity mean the identity is not an identity, and choosing
 * between them would hide exactly the edit that caused it.
 */
function measuredSide(
  fixture: string,
  expectations: ReadonlyMap<string, ScoredFunction[]>,
  measurements: ReadonlyMap<string, ScoredFunction[]>,
  tally: Tally,
): DifferenceRow[] {
  const rows: DifferenceRow[] = [];
  for (const [key, bucket] of measurements) {
    const opposite = expectations.get(key);
    if (opposite === undefined) {
      rows.push(measuredOnlyRow(fixture, key));
      continue;
    }
    if (bucket.length > 1 || opposite.length > 1) {
      rows.push(ambiguousRow(fixture, key, bucket.length, opposite.length));
      continue;
    }
    const [recorded] = opposite;
    const [measured] = bucket;
    // Each bucket holds exactly one row at this point; the guard is the compiler's.
    if (recorded === undefined || measured === undefined) continue;
    rows.push(...pairRows(fixture, recorded, measured, tally));
  }
  return rows;
}

/** Every recorded function this run measured nothing for. */
function expectedSide(
  fixture: string,
  expectations: ReadonlyMap<string, ScoredFunction[]>,
  measurements: ReadonlyMap<string, ScoredFunction[]>,
): DifferenceRow[] {
  const rows: DifferenceRow[] = [];
  for (const [key, bucket] of expectations) {
    if (measurements.has(key) || bucket.length > 1) continue;
    rows.push(
      gapRow('expected-only', fixture, key, 'this run measured no function with this identity'),
    );
  }
  return rows;
}

/** Joins one fixture's two function lists and reports what the join did not settle. */
function joinFixture(
  fixture: string,
  expected: ReadonlyArray<ScoredFunction>,
  measured: ReadonlyArray<ScoredFunction>,
  tally: Tally,
): DifferenceRow[] {
  const expectations = indexByIdentity(expected);
  const measurements = indexByIdentity(measured);
  tally.measured += measured.length;
  tally.expected += expected.length;
  return [
    ...measuredSide(fixture, expectations, measurements, tally),
    ...expectedSide(fixture, expectations, measurements),
  ];
}

/** Compares one measured fixture against its recorded entry. */
function compareFixture(
  fixture: ScoredFixture,
  expectations: ExpectationSet,
  tally: Tally,
): DifferenceRow[] {
  const recorded = expectations.fixtures[fixture.file];
  if (recorded === undefined) {
    return [
      gapRow(
        'measured-fixture',
        fixture.file,
        fixture.file,
        'the specification file has no entry for this fixture',
      ),
    ];
  }
  return joinFixture(fixture.file, recorded.functions, fixture.functions, tally);
}

/** Every recorded fixture this run did not measure. */
function unmeasuredFixtures(
  expectations: ExpectationSet,
  measured: ReadonlyArray<ScoredFixture>,
): DifferenceRow[] {
  const seen = new Set(measured.map((fixture) => fixture.file));
  const rows: DifferenceRow[] = [];
  for (const file of Object.keys(expectations.fixtures)) {
    if (seen.has(file)) continue;
    rows.push(gapRow('expected-fixture', file, file, 'this run measured no such fixture'));
  }
  return rows;
}

/**
 * Compares a fresh measurement run against the recorded expectations.
 *
 * The report is sorted and complete: a function missing on either side is a
 * difference, not an absence, and a fixture missing on either side is one too.
 */
export function compareConformance(
  measured: ReadonlyArray<ScoredFixture>,
  expectations: ExpectationSet,
): ConformanceReport {
  const tally: Tally = { measured: 0, expected: 0, compared: 0, agreements: 0 };
  const rows = measured.flatMap((fixture) => compareFixture(fixture, expectations, tally));
  rows.push(...unmeasuredFixtures(expectations, measured));
  rows.sort(byLocation);
  return {
    summary: {
      measuredFixtures: measured.length,
      expectedFixtures: Object.keys(expectations.fixtures).length,
      measuredFunctions: tally.measured,
      expectedFunctions: tally.expected,
      compared: tally.compared,
      agreements: tally.agreements,
      differences: rows.length,
    },
    rows,
  };
}
