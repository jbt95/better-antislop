import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'bun:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(repositoryRoot, 'skills/install-better-antislop/scripts/install.mjs');

function runInstaller(workspace: string, destination: string) {
  return spawnSync(process.execPath, [installer, destination], {
    cwd: workspace,
    encoding: 'utf8',
  });
}

function assertRuntimeSource(destination: string) {
  assert.ok(existsSync(join(destination, 'src/index.ts')));
  assert.ok(existsSync(join(destination, 'vendor/anti-slop/src/index.ts')));
  assert.ok(
    readFileSync(join(destination, 'src/index.ts'), 'utf8').includes(
      '../vendor/anti-slop/src/index.ts',
    ),
  );
}

function assertLicensesAndProvenance(destination: string) {
  assert.ok(existsSync(join(destination, 'LICENSE')));
  assert.ok(existsSync(join(destination, 'vendor/anti-slop/LICENSE')));
  assert.ok(existsSync(join(destination, 'vendor/anti-slop/src/vendor/eslint-stylistic/LICENSE')));
  assert.ok(existsSync(join(destination, 'UPSTREAM.md')));
}

function assertNoGeneratedOutput(destination: string) {
  assert.ok(!existsSync(join(destination, 'src/index.js')));
  assert.ok(
    !existsSync(join(destination, 'vendor/anti-slop/src/rules/no-array-filter-map.test.ts')),
  );
}

function assertOxlintLoadsCopy(workspace: string) {
  const config = {
    ignorePatterns: ['tools/oxlint/better-antislop/**'],
    jsPlugins: [
      {
        name: 'better-antislop',
        specifier: './tools/oxlint/better-antislop/src/index.ts',
      },
    ],
    rules: { 'better-antislop/no-chained-type-assertions': 'error' },
  };
  writeFileSync(join(workspace, '.oxlintrc.json'), JSON.stringify(config));
  writeFileSync(
    join(workspace, 'sample.ts'),
    ['declare const value: unknown;', 'const _result = value as unknown as string;'].join('\n'),
  );

  const result = spawnSync(
    join(repositoryRoot, 'node_modules/.bin/oxlint'),
    ['--config', '.oxlintrc.json', 'sample.ts'],
    { cwd: workspace, encoding: 'utf8' },
  );
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);
  assert.ok(output.includes('better-antislop(no-chained-type-assertions)'));
}

function testFreshInstall() {
  const workspace = mkdtempSync(join(repositoryRoot, '.tmp-better-antislop-install-'));
  const destination = join(workspace, 'tools/oxlint/better-antislop');

  try {
    const result = runInstaller(workspace, destination);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assertRuntimeSource(destination);
    assertLicensesAndProvenance(destination);
    assertNoGeneratedOutput(destination);
    assertOxlintLoadsCopy(workspace);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function testNoOverwrite() {
  const workspace = mkdtempSync(join(tmpdir(), 'better-antislop-install-'));
  const destination = join(workspace, 'tools/oxlint/better-antislop');
  mkdirSync(destination, { recursive: true });
  const sentinel = join(destination, 'local-change.txt');
  writeFileSync(sentinel, 'keep me');

  try {
    const result = runInstaller(workspace, destination);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('Refusing to overwrite'));
    assert.equal(readFileSync(sentinel, 'utf8'), 'keep me');
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

describe('better-antislop skill installer', () => {
  it('copies local TypeScript source and licenses without build output', testFreshInstall);
  it('refuses to overwrite an existing installation', testNoOverwrite);
});
