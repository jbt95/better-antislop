# better-antislop

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![npm: unpublished](https://img.shields.io/badge/npm-unpublished-lightgrey.svg)
![Oxlint 1.87.0](https://img.shields.io/badge/oxlint-1.87.0-blue.svg)

An oxlint plugin with function-level complexity metrics and TypeScript safety rules.
It contains three metric rules written here and 23 vendored rules from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop).

> **Source-distributed:** the package is marked private and is not an npm plugin
> dependency. Install its TypeScript source into your repository; no JavaScript
> build step is needed.

## Install

Use the installer skill to copy the source into your repository:

```sh
npx skills add jbt95/better-antislop --skill install-better-antislop
```

Then ask your coding agent to install and configure better-antislop. The skill
copies the TypeScript source to `tools/oxlint/better-antislop/`, matches
`@oxlint/plugins` to the repository's Oxlint version, and registers a local
`.ts` entrypoint. It refuses to overwrite an existing copy.

For a manual install from a clone of this repository, run
`node /path/to/better-antislop/skills/install-better-antislop/scripts/install.mjs`
from the consuming repository root. The script only copies files; merge the
configuration below with the target's existing configuration and add the
installed path to its formatter ignores.

## Configure

```json
{
  "ignorePatterns": ["tools/oxlint/better-antislop/**"],
  "jsPlugins": [
    {
      "name": "better-antislop",
      "specifier": "./tools/oxlint/better-antislop/src/index.ts"
    }
  ],
  "rules": {
    "better-antislop/cognitive-complexity": ["error", { "limit": 15 }],
    "better-antislop/max-nesting-depth": ["error", { "limit": 4 }],
    "better-antislop/min-maintainability-index": ["error", { "limit": 65 }]
  }
}
```

Keep `oxlint` and `@oxlint/plugins` on the same exact version. Tested with
`1.87.0`. The source entrypoint must be local to the consuming repository;
loading TypeScript from inside `node_modules` can fail under Node's type stripping.

## Documentation

### Use the plugin

- [Setup and configuration](docs/setup.md): package status and Oxlint setup.
- [Metric rules](docs/metric-rules.md): behavior and examples for this plugin's metric rules.
- [Vendored rules](docs/vendored-rules.md): rule catalog, options, and activation status.
- [Provenance and upgrades](docs/provenance.md): upstream source, licensing, and sync workflow.

### Understand the metrics

- [Specification overview](docs/metrics.md): sources, analysis boundaries, and function discovery.
- [Complexity metrics](docs/complexity.md): cyclomatic, cognitive, logical sequences, and nesting.
- [Halstead metrics](docs/halstead.md): operator and operand counts, volume, and maintainability index.
- [Function metrics](docs/function-metrics.md): size, recursion, nested functions, and output.
- [Metric verification](docs/metric-verification.md): edge cases and references.

### Develop

- [Conformance and analysis limits](docs/conformance.md): metric engine evidence and boundaries.
- [Conformance suite guide](tools/conformance/README.md): run and update recorded expectations.
- [Metric fixture index](test/fixtures/metrics/README.md): find the input for each metric case.

## License

MIT. See [LICENSE](LICENSE). Vendored rules are also MIT; see their
[license](vendor/anti-slop/LICENSE) and [provenance record](vendor/anti-slop/UPSTREAM.md).
