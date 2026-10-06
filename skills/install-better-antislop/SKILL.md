---
name: install-better-antislop
description: Install the better-antislop Oxlint rules as local TypeScript source, configure the plugin, or update a reviewed source copy without generating JavaScript.
---

# Install better-antislop

The plugin is source-distributed, following `dmmulroy/anti-slop`: the consuming repository owns a local copy of the TypeScript source. Do not add this repository as an npm or Git dependency and do not build JavaScript just to load the plugin. Node rejects TypeScript stripping for entrypoints under `node_modules`; Oxlint can load the same `.ts` entrypoint from a local project directory.

## Establish the target

1. Read the target repository's agent instructions and `git status`.
2. Identify its package manager, installed `oxlint` version, Oxlint configuration, formatter configuration, and any existing better-antislop copy or rule prefix.
3. If a copy already exists, stop before copying. Inspect its provenance and local changes, then ask whether to update or preserve it. The installer intentionally refuses to replace an existing destination.

## Fresh install

1. From the target repository root, run the bundled installer:

   ```sh
   node <skill-directory>/scripts/install.mjs
   ```

   The default destination is `tools/oxlint/better-antislop/`. A different relative or absolute destination can be passed as the first argument. The script copies TypeScript source, all included license and provenance files, and an upstream record; it does not modify the manifest, lint config, or formatter config.

2. Add `@oxlint/plugins` as a development dependency at exactly the target repository's resolved `oxlint` version. If Oxlint is already installed, preserve its version and match it; otherwise select a current compatible Oxlint version and add both packages as development dependencies at that exact version. Do not add `oxlint-plugin-better-antislop` as a dependency.

3. Register the copied entrypoint using Oxlint's local-plugin object form. Merge the destination ignore into existing ignores rather than replacing them:

   ```ts
   export default defineConfig({
     ignorePatterns: ['tools/oxlint/better-antislop/**'],
     jsPlugins: [
       {
         name: 'better-antislop',
         specifier: './tools/oxlint/better-antislop/src/index.ts',
       },
     ],
     rules: {
       'better-antislop/cognitive-complexity': ['error', { limit: 15 }],
       'better-antislop/max-nesting-depth': ['error', { limit: 4 }],
     },
   });
   ```

   If the copy used a different destination, update both paths. Enable only rules the user or repository policy wants. Rule names and options are documented at https://github.com/jbt95/better-antislop/blob/main/docs/metric-rules.md and https://github.com/jbt95/better-antislop/blob/main/docs/vendored-rules.md.

4. Add the same installed-source path to the formatter's ignore list so copied upstream code is not reformatted. Inspect for other local agent-tooling paths and merge those narrowly; do not ignore all dot-directories.

5. Run the repository's lint and typecheck commands. Fix or report findings in repository-owned code; do not weaken rule severities to hide findings.

## Updating a local copy

Never run the fresh installer over an existing directory. Compare the existing source with the new skill assets, preserve local modifications, review upstream rule changes, and update the provenance record and licenses. Confirm with the user before replacing conflicting local policy. Re-run lint and typecheck after the update.
