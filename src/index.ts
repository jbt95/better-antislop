import { eslintCompatPlugin } from '@oxlint/plugins';
import { cognitiveComplexity, maxNestingDepth, minMaintainabilityIndex } from './rules/index.ts';

export default eslintCompatPlugin({
  meta: { name: 'better-antislop-metrics' },
  rules: {
    'cognitive-complexity': cognitiveComplexity,
    'max-nesting-depth': maxNestingDepth,
    'min-maintainability-index': minMaintainabilityIndex,
  },
});
