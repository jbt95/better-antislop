import { defineConfig } from 'oxlint';

/**
 * Lint configuration for this repository's own source.
 * The two `jsPlugins` entries are the plugins this package publishes. They are
 * loaded from source on purpose: a change to the metric engine must fail the
 * repository's own lint run, not only the conformance suite.
 */
export default defineConfig({
  plugins: ['eslint', 'oxc', 'typescript', 'unicorn', 'import', 'promise'],
  env: {
    builtin: true,
    node: true,
  },
  categories: {
    correctness: 'error',
  },
  // `node_modules` and `dist` are already covered by `.gitignore`, which oxlint
  // reads by default.
  //
  // `test/fixtures` is test data, not source. Its files exist precisely to be
  // over the complexity thresholds this package enforces, so linting them would
  // fail the build on the very cases the conformance suite needs. They are still
  // real TypeScript and are still parsed by the suite; they are simply not code
  // anyone maintains.
  ignorePatterns: ['oxprobe-artifacts', 'test/fixtures/**'],
  jsPlugins: ['./src/index.ts', './src/opinionated/index.ts'],
  rules: {
    // `cognitive-complexity` keeps the shipped default of 15. It sits in a gap
    // rather than inside a crowd: it names four functions here, and the scores
    // just below it are 14, 12 and 12. `max-nesting-depth` keeps 4 for the same
    // reason, nothing in this repository reaches it.
    //
    // `min-maintainability-index` is lowered from the shipped default of 65 to
    // 50, and that is the only recalibration here. The published 65 comes from
    // module-level analysis, where it means "this module is hard to maintain".
    // Against one function it collapses into a length test: every term in the
    // formula is a logarithm and the line term dominates, so 65 leaves room
    // only for a very small Halstead volume. A fifteen-line function barely
    // clears it and a twenty-line one cannot, so here 65 named about two
    // functions in five, including nine-line arrow functions whose message,
    // "shorten it and lower its operator and operand count", asks for
    // something no edit can deliver.
    //
    // 50 leaves room for a function with real branching and still names about
    // one in ten, and the shortest function it names is close to thirty lines.
    // It therefore still says what it is for: this function is too big. Every
    // function it names at 50 is a real finding and is fixed in code, never by
    // raising the number. AGENTS.md, "Threshold policy", carries the argument.
    'better-antislop-metrics/cognitive-complexity': ['error', { limit: 15 }],
    'better-antislop-metrics/max-nesting-depth': ['error', { limit: 4 }],
    'better-antislop-metrics/min-maintainability-index': ['error', { limit: 50 }],

    // ---- Opinionated house rules ------------------------------------------
    'better-antislop/no-chained-type-assertions': 'error',
    'better-antislop/require-safety-comment-for-type-assertion': 'error',
    // `allowInTypePredicateFunctions` is on for this repository's own source.
    // A type predicate is the remedy the rule's own message recommends: the
    // function signature names the guarantee, so nothing downstream re-reads
    // the representation tag. The clearest case is the pair that decodes rule
    // options out of the config file, `isOptionRecord` and `isNumberValue` in
    // `src/rules/create-metric-rule.ts`, where nothing outside the file knows
    // the shape the JSON had. Without the option the rule reports the remedy it
    // asks for. The exception is the rule's own documented switch, it is
    // scoped to functions whose signature is a predicate, and every comparison
    // outside one is still reported. It stays on everywhere rather than being
    // listed per file: a boundary decode is a house policy, not a file accident.
    'better-antislop/no-runtime-typeof-narrowing': [
      'error',
      { allowInTypePredicateFunctions: true },
    ],
    'better-antislop/no-unknown-parameters': 'error',
    'better-antislop/no-object-parameters': 'error',

    // ---- Native complexity ceilings, kept as a second, independent opinion -
    'eslint/complexity': ['error', { max: 20 }],
    'eslint/max-depth': ['error', { max: 4 }],
    'eslint/max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
    'eslint/max-lines-per-function': [
      'error',
      { max: 120, IIFEs: true, skipBlankLines: false, skipComments: false },
    ],
    'eslint/max-params': ['error', { max: 4 }],
    'eslint/max-statements': ['error', { max: 80 }],

    // ---- Correctness -------------------------------------------------------
    'eslint/eqeqeq': ['error', 'always'],
    'eslint/no-await-in-loop': 'error',
    'eslint/no-compare-neg-zero': 'error',
    'eslint/no-eval': 'error',
    'eslint/no-implicit-coercion': 'error',
    'eslint/no-lonely-if': 'error',
    'eslint/no-new-func': 'error',
    'eslint/no-param-reassign': 'error',
    'eslint/no-shadow': 'error',
    'eslint/no-throw-literal': 'error',
    'eslint/no-unassigned-vars': 'error',
    'eslint/no-unmodified-loop-condition': 'error',
    'eslint/no-unreachable-loop': 'error',
    'eslint/no-useless-catch': 'error',
    'eslint/require-await': 'error',

    // ---- TypeScript --------------------------------------------------------
    'typescript/consistent-type-imports': 'error',
    'typescript/no-explicit-any': 'error',
    'typescript/no-import-type-side-effects': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-unused-vars': 'error',

    // `typescript/no-floating-promises` and
    // `typescript/no-unnecessary-type-arguments` need type information, which
    // oxlint only provides under `--type-aware` with `oxlint-tsgolint` installed.
    // The `lint` script does not pass that flag, so they are left out rather
    // than configured to do nothing.

    // ---- Modules -----------------------------------------------------------
    'import/no-cycle': 'error',
    'import/no-duplicates': 'error',
    'import/no-self-import': 'error',
    'promise/always-return': 'error',

    // ---- oxc and unicorn ---------------------------------------------------
    'oxc/no-accumulating-spread': 'error',
    'oxc/no-map-spread': 'error',
    'unicorn/explicit-length-check': 'error',
    'unicorn/no-array-callback-reference': 'error',
    'unicorn/prefer-node-protocol': 'error',
    'unicorn/prefer-string-slice': 'error',
  },
});
