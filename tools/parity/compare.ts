import { basename } from 'node:path';
import type { PluginRow } from './collect.ts';
import type { LeadlineRow } from './leadline.ts';

/**
 * Why a pair of rows did not agree.
 *
 * `value` is a numeric disagreement. The other three are gaps: one side has a
 * function the other side never reported, or both sides claim the same key.
 */
export type MismatchKind = 'value' | 'ambiguous' | 'plugin-only' | 'leadline-only';

export interface FieldDiff {
  readonly field: string;
  readonly plugin: string;
  readonly leadline: string;
}

export interface MismatchRow {
  readonly kind: MismatchKind;
  readonly file: string;
  readonly line: number;
  readonly name: string;
  readonly detail: string;
  readonly diffs: ReadonlyArray<FieldDiff>;
}

export interface ParitySummary {
  readonly pluginRows: number;
  readonly leadlineRows: number;
  /** Functions present on both sides under one key. */
  readonly compared: number;
  /** Compared functions whose every comparable field is equal. */
  readonly agreements: number;
  readonly mismatches: number;
  /** Compared functions where leadline carried no nesting measure. */
  readonly skippedNesting: number;
  /** Compared functions where one side had no name, so names were not compared. */
  readonly skippedName: number;
}

export interface ParityReport {
  readonly summary: ParitySummary;
  readonly rows: ReadonlyArray<MismatchRow>;
}

interface Location {
  readonly file: string;
  readonly line: number;
  readonly name: string | null;
}

const ANONYMOUS = '<anonymous>';

/** Fixed order so two runs over the same corpus print the same lines. */
const KIND_ORDER: Record<MismatchKind, number> = {
  value: 0,
  ambiguous: 1,
  'plugin-only': 2,
  'leadline-only': 3,
};

/**
 * The join key: the basename and the 1-based start line of the function.
 *
 * leadline and oxlint print paths relative to different roots, so only the
 * basename is stable. A path segment cannot contain a slash, so joining the two
 * parts with one cannot collide.
 */
function matchKey(file: string, line: number): string {
  return [basename(file), String(line)].join('/');
}

function byLocation(left: Location, right: Location): number {
  return (
    left.file.localeCompare(right.file) ||
    left.line - right.line ||
    (left.name ?? '').localeCompare(right.name ?? '')
  );
}

/**
 * Orders the report the way the key does, so one function's rows sit together.
 *
 * Sorting on the raw path would interleave two unrelated namespaces, because
 * leadline reports `src/a.ts` and oxlint reports `a.ts` for the same function.
 */
function byMismatch(left: MismatchRow, right: MismatchRow): number {
  return (
    basename(left.file).localeCompare(basename(right.file)) ||
    left.line - right.line ||
    KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
    left.name.localeCompare(right.name) ||
    left.file.localeCompare(right.file)
  );
}

function indexByKey(rows: ReadonlyArray<LeadlineRow>): Map<string, LeadlineRow[]> {
  const index = new Map<string, LeadlineRow[]>();
  for (const row of rows) {
    const key = matchKey(row.file, row.line);
    const bucket = index.get(key);
    if (bucket === undefined) {
      index.set(key, [row]);
    } else {
      bucket.push(row);
    }
  }
  return index;
}

interface PairOutcome {
  readonly diffs: ReadonlyArray<FieldDiff>;
  readonly skippedNesting: boolean;
  readonly skippedName: boolean;
}

/** Records one compared field, but only where the two engines disagree. */
function addDiff(diffs: FieldDiff[], field: string, plugin: string, leadline: string): void {
  if (plugin !== leadline) diffs.push({ field, plugin, leadline });
}

/**
 * Compares one matched pair field by field.
 *
 * Nesting is compared only when leadline carried a value. Names are compared
 * only when both sides named the function, because the two engines spell an
 * anonymous function differently.
 */
function comparePair(left: PluginRow, right: LeadlineRow): PairOutcome {
  const diffs: FieldDiff[] = [];
  addDiff(diffs, 'cognitive', String(left.cognitive), String(right.cognitive));
  addDiff(diffs, 'cyclomatic', String(left.cyclomatic), String(right.cyclomatic));

  const skippedNesting = right.maxNesting === null;
  if (!skippedNesting) addDiff(diffs, 'nesting', String(left.nesting), String(right.maxNesting));

  const skippedName = left.name === '' || right.name === null;
  if (!skippedName) addDiff(diffs, 'name', left.name, right.name ?? '');

  return { diffs, skippedNesting, skippedName };
}

function displayName(row: Location): string {
  return row.name === null || row.name === '' ? ANONYMOUS : row.name;
}

/** Builds a row reported on its own, with no field-by-field comparison. */
function gapRow(row: Location, kind: MismatchKind, detail: string): MismatchRow {
  return { kind, file: row.file, line: row.line, name: displayName(row), detail, diffs: [] };
}

/** Builds the row for a matched pair whose compared fields disagree. */
function valueRow(row: PluginRow, diffs: ReadonlyArray<FieldDiff>): MismatchRow {
  return {
    kind: 'value',
    file: row.file,
    line: row.line,
    name: displayName(row),
    detail: 'metric value differs',
    diffs,
  };
}

/** The running tallies a join produces; they become the report summary. */
interface Tally {
  compared: number;
  agreements: number;
  skippedNesting: number;
  skippedName: number;
}

/** What one pass over the plugin rows produced. */
interface Join {
  readonly tally: Tally;
  readonly rows: ReadonlyArray<MismatchRow>;
}

/** What one plugin row's join key resolved to. */
type Resolution =
  | { readonly kind: 'pair'; readonly candidate: LeadlineRow }
  | { readonly kind: 'plugin-only' }
  | { readonly kind: 'ambiguous'; readonly shared: number };

/**
 * Takes the rows behind `key` out of the index and says what they resolved to.
 *
 * A key that holds one row is a pair. A key that holds none means leadline
 * never reported a function at that line. A key that holds several is dropped
 * whole rather than matched against whichever row came first: parity is
 * unproven there, and those rows are not reported again as unclaimed.
 */
function resolveKey(index: Map<string, LeadlineRow[]>, key: string): Resolution {
  const [candidate, ...shared] = index.get(key) ?? [];
  index.delete(key);
  if (shared.length > 0) return { kind: 'ambiguous', shared: shared.length };
  if (candidate === undefined) return { kind: 'plugin-only' };
  return { kind: 'pair', candidate };
}

/** Builds the row for a key that did not resolve to exactly one pair. */
function unresolvedRow(row: PluginRow, resolved: Resolution): MismatchRow {
  if (resolved.kind === 'ambiguous') {
    return gapRow(row, 'ambiguous', `${resolved.shared + 1} leadline rows share this key`);
  }
  return gapRow(row, 'plugin-only', 'leadline reported no function at this line');
}

/** Walks every plugin row once and reports what its key did and did not find. */
function joinRows(ordered: ReadonlyArray<PluginRow>, index: Map<string, LeadlineRow[]>): Join {
  const tally: Tally = { compared: 0, agreements: 0, skippedNesting: 0, skippedName: 0 };
  const rows: MismatchRow[] = [];

  for (const row of ordered) {
    const resolved = resolveKey(index, matchKey(row.file, row.line));
    if (resolved.kind !== 'pair') {
      rows.push(unresolvedRow(row, resolved));
      continue;
    }

    const outcome = comparePair(row, resolved.candidate);
    tally.compared += 1;
    tally.skippedNesting += outcome.skippedNesting ? 1 : 0;
    tally.skippedName += outcome.skippedName ? 1 : 0;
    if (outcome.diffs.length > 0) rows.push(valueRow(row, outcome.diffs));
    else tally.agreements += 1;
  }

  return { tally, rows };
}

/** Every leadline row no plugin row claimed. */
function unclaimedRows(index: ReadonlyMap<string, ReadonlyArray<LeadlineRow>>): MismatchRow[] {
  const rows: MismatchRow[] = [];
  for (const bucket of index.values()) {
    for (const row of bucket) {
      rows.push(gapRow(row, 'leadline-only', 'the plugin reported no function at this line'));
    }
  }
  return rows;
}

/**
 * Joins the two row sets on `(basename, line)` and reports every disagreement.
 *
 * A key that two leadline rows share cannot be resolved, so it counts as a
 * mismatch rather than an agreement: parity is unproven there.
 */
export function compareMetrics(
  pluginRows: ReadonlyArray<PluginRow>,
  leadlineRows: ReadonlyArray<LeadlineRow>,
): ParityReport {
  const index = indexByKey([...leadlineRows].sort(byLocation));
  const ordered = [...pluginRows].sort(byLocation);
  const { tally, rows } = joinRows(ordered, index);
  const unclaimed = unclaimedRows(index);

  return {
    summary: {
      pluginRows: ordered.length,
      leadlineRows: leadlineRows.length,
      mismatches: rows.length + unclaimed.length,
      compared: tally.compared,
      agreements: tally.agreements,
      skippedNesting: tally.skippedNesting,
      skippedName: tally.skippedName,
    },
    rows: [...rows, ...unclaimed].sort(byMismatch),
  };
}
