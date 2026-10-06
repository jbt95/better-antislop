#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = join(repositoryRoot, 'skills/install-better-antislop/assets/better-antislop');
const sourceTrees = [
  { source: 'src', destination: 'src' },
  { source: 'vendor/anti-slop/src', destination: 'vendor/anti-slop/src' },
];
const fixedFiles = [
  { source: 'LICENSE', destination: 'LICENSE' },
  { source: 'vendor/anti-slop/LICENSE', destination: 'vendor/anti-slop/LICENSE' },
];

function sourceFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      const relativePath = `${prefix}${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(path, `${relativePath}/`);
      return entry.name.endsWith('.test.ts') ? [] : [relativePath];
    })
    .sort();
}

function allFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      const relativePath = `${prefix}${entry.name}`;
      return entry.isDirectory() ? allFiles(path, `${relativePath}/`) : [relativePath];
    })
    .sort();
}

function addSourceTrees(expected) {
  for (const tree of sourceTrees) {
    const sourceRoot = join(repositoryRoot, tree.source);
    for (const path of sourceFiles(sourceRoot)) {
      expected.set(`${tree.destination}/${path}`, readFileSync(join(sourceRoot, path)));
    }
  }
}

function addFixedFiles(expected) {
  for (const file of fixedFiles) {
    expected.set(file.destination, readFileSync(join(repositoryRoot, file.source)));
  }
}

function provenanceFile() {
  const packageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  const upstreamRecord = readFileSync(join(repositoryRoot, 'vendor/anti-slop/UPSTREAM.md'), 'utf8');
  const revision = upstreamRecord.match(/revision `([a-f0-9]{40})`/)?.[1];
  if (revision === undefined) {
    throw new Error('Could not read the pinned revision from vendor/anti-slop/UPSTREAM.md');
  }

  return Buffer.from(
    [
      '# Source provenance',
      '',
      `Plugin source: https://github.com/jbt95/better-antislop (version ${packageJson.version}).`,
      `Vendored rules: https://github.com/dmmulroy/anti-slop/tree/${revision}.`,
      'The bundled source is MIT-licensed; preserve all accompanying LICENSE and UPSTREAM.md files.',
      '',
      'This is a TypeScript source snapshot for local Oxlint use. No JavaScript build output is required.',
      '',
    ].join('\n'),
  );
}

function sourceSnapshot() {
  const expected = new Map();
  addSourceTrees(expected);
  addFixedFiles(expected);
  expected.set('UPSTREAM.md', provenanceFile());
  return expected;
}

function reportDrift(expected) {
  if (!existsSync(assetRoot)) return [`missing ${relative(repositoryRoot, assetRoot)}`];

  const actualPaths = allFiles(assetRoot);
  const actual = new Set(actualPaths);
  const differences = [];
  for (const [path, content] of expected) {
    if (!actual.has(path)) {
      differences.push(`missing ${path}`);
    } else if (!readFileSync(join(assetRoot, ...path.split('/'))).equals(content)) {
      differences.push(`changed ${path}`);
    }
  }
  for (const path of actualPaths) {
    if (!expected.has(path)) differences.push(`unexpected ${path}`);
  }
  return differences;
}

function writeSnapshot(expected) {
  rmSync(assetRoot, { recursive: true, force: true });
  for (const [path, content] of expected) {
    const destination = join(assetRoot, ...path.split('/'));
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
}

const expected = sourceSnapshot();
if (process.argv.includes('--check')) {
  const differences = reportDrift(expected);
  if (differences.length > 0) {
    console.error(
      `Skill assets differ from source:\n${differences.join('\n')}\nRun bun run sync:skill-assets.`,
    );
    process.exitCode = 1;
  } else {
    console.log('Skill assets match the runtime source.');
  }
} else {
  writeSnapshot(expected);
  console.log(`Synced ${relative(repositoryRoot, assetRoot)} from runtime TypeScript source.`);
}
