#!/usr/bin/env bun
/**
 * Re-vendor `vendor/anti-slop/`, or report drift against its pinned revision.
 *
 * The revision arrives as a GitHub source tarball rather than through `git`:
 * a drift check has to run in a checkout with no remote configured and no
 * credentials, and a tarball pins content by object id without one. `tar` is
 * the only external program involved, because Node and Bun both lack a tar
 * reader and hand-unpacking 100 kB is not worth the failure modes.
 *
 * The vendored tree is exactly `VENDORED_PATHS` after `PATCHES`. Everything
 * else the revision carries stays behind, so a sync can never hand this
 * repository a second lint config, a second lockfile, or a second copy of
 * every rule.
 *
 * Written against the plain `node:` API rather than `Effect`, because this is a
 * one-shot maintenance tool: it runs once per sync and once per CI job, and an
 * error model it does not need would be the largest part of it.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'dmmulroy/anti-slop';
const REVISION = 'c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b';
const ARCHIVE_URL = `https://codeload.github.com/${REPOSITORY}/tar.gz/${REVISION}`;

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIRECTORY = join(REPOSITORY_ROOT, 'vendor', 'anti-slop');

/**
 * Everything copied out of the pinned revision. The revision also carries
 * `.github/`, `skills/`, `scripts/`, `AGENTS.md`, `tsconfig.json`,
 * `.gitignore` and `pnpm-lock.yaml`; `vendor/anti-slop/UPSTREAM.md` records why
 * each of them stays behind.
 */
const VENDORED_PATHS: readonly string[] = [
  '.oxlintrc.json',
  'LICENSE',
  'README.md',
  'package.json',
  'src',
];

/**
 * This repository's own provenance record. It is not revision content, so a
 * re-vendor keeps it and a drift check does not compare it.
 */
const LOCAL_RECORD = 'UPSTREAM.md';

/** One type-level edit to vendored source. */
interface Patch {
  /** Vendored path, relative to `vendor/anti-slop`. */
  readonly file: string;
  /** The `tsconfig.json` flag that rejects the upstream text. */
  readonly forcedBy: string;
  /** Upstream text, verbatim. */
  readonly from: string;
  /** Vendored text, verbatim. */
  readonly to: string;
}

const INTERSECTION_NARROWING_UPSTREAM = [
  '\t\treturn unsafeMembers.length > 0 && unsafeMembers.every((member) => member !== null)',
  '\t\t\t? unsafeMembers[0]',
  '\t\t\t: null;',
].join('\n');

const INTERSECTION_NARROWING_VENDORED = [
  '\t\tif (unsafeMembers.length === 0 || unsafeMembers.some((member) => member === null)) return null;',
  '\t\t// `every` does not narrow the array for the indexed read below.',
  '\t\tconst first = unsafeMembers[0];',
  '\t\treturn first ?? null;',
].join('\n');

/**
 * The only edits made to vendored source. Each one exists because this
 * repository compiles with a flag upstream does not set, and each one leaves
 * the runtime identical to upstream's. Upstream's other files are left
 * byte-for-byte alone, so a revision bump shows up as a diff against this list.
 */
const PATCHES: readonly Patch[] = [
  {
    file: 'src/rules/no-runtime-typeof.ts',
    forcedBy: 'noPropertyAccessFromIndexSignature',
    from: '\t\t\t\t\toption.allowInTypeGuards === true;',
    to: '\t\t\t\t\toption["allowInTypeGuards"] === true;',
  },
  {
    file: 'src/shared/dictionary-types.ts',
    forcedBy: 'noUncheckedIndexedAccess',
    from: INTERSECTION_NARROWING_UPSTREAM,
    to: INTERSECTION_NARROWING_VENDORED,
  },
];

/** The patches keyed by the file each one edits. */
const PATCHES_BY_FILE: Record<string, Patch> = Object.fromEntries(
  PATCHES.map((patch) => [patch.file, patch]),
);

const USAGE = `Usage: bun scripts/vendor-sync.ts [--check]

Re-vendors ${REPOSITORY}@${REVISION} into vendor/anti-slop/, or reports drift.

Arguments:
  --check   compare the vendored copy against the pinned revision and write
            nothing at all, so it is safe to run as a CI gate.

Exit codes:
  0  the vendored copy matches the pinned revision, or the re-vendor succeeded
  1  drift under --check
  2  the pinned revision could not be fetched, or a patch no longer applies`;

/**
 * Download and unpack the pinned revision into a fresh temporary directory.
 * The caller owns the returned directory and must remove it.
 */
async function fetchPinnedRevision(): Promise<string> {
  const workspace = mkdtempSync(join(tmpdir(), 'anti-slop-'));
  const archive = join(workspace, 'revision.tar.gz');
  const response = await fetch(ARCHIVE_URL);
  if (!response.ok) {
    throw new Error(`${ARCHIVE_URL} answered ${response.status} ${response.statusText}`);
  }
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xzf', archive, '-C', workspace, '--strip-components=1']);
  return workspace;
}

/** Every file below `root`, as `/`-separated paths relative to it, sorted. */
function filesUnder(root: string, prefix = ''): Array<string> {
  const groups = readdirSync(root, { withFileTypes: true }).map((entry) => {
    const path = `${prefix}${entry.name}`;
    return entry.isDirectory() ? filesUnder(join(root, entry.name), `${path}/`) : [path];
  });
  return groups.flat().sort();
}

/**
 * Apply one patch. Text that already carries the result is accepted, so
 * re-running over an already-patched file changes nothing, and `--check`
 * accepts the tree a previous sync wrote.
 */
function patched(patch: Patch, content: string): string {
  if (content.includes(patch.to)) return content;
  if (!content.includes(patch.from)) {
    throw new Error(
      `patch for ${patch.file} does not match ${REVISION}; ` +
        `check whether ${patch.forcedBy} still forces it`,
    );
  }
  return content.replace(patch.from, patch.to);
}

/** The files the vendor directory must hold, keyed by path relative to it. */
function expectedFiles(unpacked: string): Map<string, Buffer> {
  const expected = new Map<string, Buffer>();
  for (const path of filesUnder(unpacked)) {
    if (!VENDORED_PATHS.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) {
      continue;
    }
    const content = readFileSync(join(unpacked, path));
    const patch = PATCHES_BY_FILE[path];
    expected.set(
      path,
      patch === undefined ? content : Buffer.from(patched(patch, content.toString('utf8'))),
    );
  }
  return expected;
}

/**
 * Every way the vendored copy can differ from the revision. Allowlisted files
 * are compared by content; a top-level name that is neither allowlisted nor
 * this repository's own record is reported, which is what catches upstream
 * tooling, lockfiles and nested checkouts arriving with a sync.
 */
function drift(expected: ReadonlyMap<string, Buffer>): Array<string> {
  if (!existsSync(VENDOR_DIRECTORY)) return [`missing    ${VENDOR_DIRECTORY}`];
  const differences: Array<string> = [];
  for (const [path, content] of expected) {
    const vendored = join(VENDOR_DIRECTORY, path);
    if (!existsSync(vendored)) differences.push(`missing    ${path}`);
    else if (!readFileSync(vendored).equals(content)) differences.push(`changed    ${path}`);
  }
  const extra = readdirSync(VENDOR_DIRECTORY).filter(
    (name) => name !== LOCAL_RECORD && !VENDORED_PATHS.includes(name),
  );
  return [...differences, ...extra.map((name) => `unexpected ${name}`)];
}

/**
 * Replace the vendor directory with the revision. The allowlist is the whole
 * truth: leaving anything else behind would make the next drift check report
 * upstream files this repository never asked for.
 */
function writeVendored(expected: ReadonlyMap<string, Buffer>): void {
  if (existsSync(VENDOR_DIRECTORY)) {
    for (const name of readdirSync(VENDOR_DIRECTORY)) {
      if (name === LOCAL_RECORD) continue;
      rmSync(join(VENDOR_DIRECTORY, name), { recursive: true, force: true });
    }
  }
  for (const [path, content] of expected) {
    const target = join(VENDOR_DIRECTORY, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

/** Report the drift verdict, or write the revision, and return the exit code. */
function syncOrCheck(expected: ReadonlyMap<string, Buffer>, check: boolean): number {
  if (!check) {
    writeVendored(expected);
    process.stdout.write(`vendor:sync wrote ${expected.size} files from ${REVISION}\n`);
    return 0;
  }
  const differences = drift(expected);
  if (differences.length === 0) {
    process.stdout.write(`vendor:sync: no drift against ${REVISION} (${expected.size} files)\n`);
    return 0;
  }
  process.stderr.write(`vendor:sync: drift against ${REVISION}\n${differences.join('\n')}\n`);
  return 1;
}

async function main(): Promise<number> {
  const arguments_ = process.argv.slice(2);
  if (arguments_.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const unpacked = await fetchPinnedRevision();
  try {
    return syncOrCheck(expectedFiles(unpacked), arguments_.includes('--check'));
  } finally {
    rmSync(unpacked, { recursive: true, force: true });
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write(`vendor-sync: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
