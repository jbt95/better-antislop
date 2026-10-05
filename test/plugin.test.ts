import { describe, it } from 'bun:test';
import type { Rule } from '@oxlint/plugins';
import plugin from '../src/index.ts';
import {
  cognitiveComplexity,
  maxNestingDepth,
  minMaintainabilityIndex,
} from '../src/rules/index.ts';

/**
 * The surface of the merged plugin.
 *
 * `src/index.ts` is three sources spread into one rule map, and two of those
 * sources are vendored. A rule dropped from either vendored index would
 * disappear without a trace: most of them are off in this repository's own
 * configuration, so no lint run would notice and no conformance measurement
 * covers them. Writing every rule name out here turns that into a failing
 * test, and the import itself already fails if a vendored source stops
 * resolving.
 */

/** The 26 rules the plugin is built from, grouped by the source they came from. */
const EXPECTED: readonly string[] = [
  // vendor/anti-slop/src/index.ts
  'no-array-filter-map',
  'no-reduce-accumulator-copy',
  'no-chained-type-assertions',
  'no-conditional-empty-object-spread',
  'no-known-value-widening',
  'no-module-mocking',
  'no-object-parameters',
  'no-reflect-apply',
  'no-reflect-get',
  'no-runtime-typeof',
  'no-unsafe-dictionary-type',
  'no-shape-in-symbol-names',
  'no-unknown-parameters',
  'no-unknown-returns',
  'no-unknown-type-aliases',
  'no-widen-then-assert',
  'require-readable-spacing',
  'require-safety-comment-for-type-assertion',
  // vendor/anti-slop/src/effect/index.ts
  'no-manual-effect-error-tag',
  'no-manual-tag-comparison',
  'no-manual-tagged-construction',
  'no-service-constructor-imports',
  'prefer-effect-match',
  // src/rules/index.ts
  'cognitive-complexity',
  'max-nesting-depth',
  'min-maintainability-index',
];

/**
 * The three rules this repository owns, each bound to the object
 * `src/rules/index.ts` exports under that name.
 *
 * The comparison is by identity and that is the point. `src/index.ts` spreads
 * the metric rules last, so a vendored rule that ever took one of these names
 * would be the object the plugin exported under the key, and naming the names
 * alone would not catch it.
 */
const METRIC_RULES: readonly (readonly [string, Rule])[] = [
  ['cognitive-complexity', cognitiveComplexity],
  ['max-nesting-depth', maxNestingDepth],
  ['min-maintainability-index', minMaintainabilityIndex],
];

describe('better-antislop', () => {
  it('exports the 26 rules it is built from, and nothing else', () => {
    const exported: string[] = Object.keys(plugin.rules);
    const missing: string[] = EXPECTED.filter((name) => !exported.includes(name));
    const extra: string[] = exported.filter((name) => !EXPECTED.includes(name));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `the plugin exports ${String(exported.length)} rules, not ${String(EXPECTED.length)}\n` +
          `missing: ${missing.join(', ') || 'none'}\n` +
          `not expected: ${extra.join(', ') || 'none'}`,
      );
    }
  });

  it('resolves each metric rule to the implementation this repository owns', () => {
    for (const [name, metric] of METRIC_RULES) {
      if (plugin.rules[name] !== metric) {
        throw new Error(`${name} does not resolve to the rule from src/rules/index.ts`);
      }
    }
  });

  it('publishes under the prefix every rule key in oxlint.config.ts carries', () => {
    if (plugin.meta?.name !== 'better-antislop') {
      throw new Error(`the plugin publishes as ${String(plugin.meta?.name)}`);
    }
  });
});
