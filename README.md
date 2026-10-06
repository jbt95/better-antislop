# better-antislop

[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![npm: unpublished](https://img.shields.io/badge/npm-unpublished-lightgrey.svg)
![Oxlint 1.87.0](https://img.shields.io/badge/oxlint-1.87.0-blue.svg)

An oxlint plugin with function-level complexity metrics and TypeScript safety rules.
It contains three metric rules written here and 23 vendored rules from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop).

> **Unpublished:** npm installation is not available. The configuration below is for
> a published release.

## Configure

```json
{
  "jsPlugins": ["oxlint-plugin-better-antislop"],
  "rules": {
    "better-antislop/cognitive-complexity": ["error", { "limit": 15 }],
    "better-antislop/max-nesting-depth": ["error", { "limit": 4 }],
    "better-antislop/min-maintainability-index": ["error", { "limit": 65 }]
  }
}
```

Tested with oxlint `1.87.0` and `@oxlint/plugins` `1.87.0`.

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
