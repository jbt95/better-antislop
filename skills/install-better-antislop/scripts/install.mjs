#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(skillRoot, 'assets/better-antislop');
const targetArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const target = resolve(process.cwd(), targetArgument ?? 'tools/oxlint/better-antislop');

if (!existsSync(source)) {
  console.error('The bundled better-antislop source assets are missing.');
  process.exitCode = 1;
} else if (existsSync(target)) {
  console.error(`Refusing to overwrite ${target}. Review the existing copy before updating it.`);
  process.exitCode = 1;
} else {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  const entry = relative(process.cwd(), resolve(target, 'src/index.ts')).split('\\').join('/');
  console.log(`Copied the TypeScript plugin to ${target}`);
  console.log(`Register it in Oxlint with: { name: 'better-antislop', specifier: './${entry}' }`);
}
