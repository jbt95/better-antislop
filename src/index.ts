import { eslintCompatPlugin } from '@oxlint/plugins';
import antiSlopEffect from '../vendor/anti-slop/src/effect/index.ts';
import antiSlop from '../vendor/anti-slop/src/index.ts';
import { cognitiveComplexity, maxNestingDepth, minMaintainabilityIndex } from './rules/index.ts';

/**
 * The published plugin: this repository's three metric rules and the rules
 * vendored from `dmmulroy/anti-slop`, merged into one so a consumer configures
 * one `jsPlugins` entry and one rule prefix.
 *
 * The order of the spreads is the contract, not a style choice. A later spread
 * wins a name collision, so the metric rules come last: if a vendored rule ever
 * takes one of their names, this repository's implementation stays the one the
 * plugin exports rather than being replaced by a rule from a dependency. The
 * order of everything before them is not load-bearing, and it is still written
 * out so a reader can see which vendored tree each rule came from.
 *
 * The vendored trees keep their own `meta.name`. Only `rules` is read here, so
 * the published prefix is this plugin's own and the two names do not leak.
 *
 * Every rule ships without an opinion attached: nothing in this file turns one
 * on. `oxlint.config.ts` holds the eight this repository enables for itself.
 */
export default eslintCompatPlugin({
  meta: { name: 'better-antislop' },
  rules: {
    ...antiSlop.rules,
    ...antiSlopEffect.rules,
    'cognitive-complexity': cognitiveComplexity,
    'max-nesting-depth': maxNestingDepth,
    'min-maintainability-index': minMaintainabilityIndex,
  },
});
