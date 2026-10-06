import { Schema } from 'effect';

export const HalsteadSchema = Schema.Struct({
  distinctOperators: Schema.Int,
  distinctOperands: Schema.Int,
  totalOperators: Schema.Int,
  totalOperands: Schema.Int,
  vocabulary: Schema.Int,
  length: Schema.Int,
  volume: Schema.Number,
  difficulty: Schema.Number,
  effort: Schema.Number,
});

/**
 * One function, identified by where it starts and what it declares.
 *
 * `line` alone moves when a line is inserted above and `name` alone changes
 * when a function is renamed, so the identity carries all four of `kind`,
 * `name`, `line` and `signature`. `column` is what separates two functions that
 * start on one line.
 */
export const ScoredFunctionSchema = Schema.Struct({
  kind: Schema.Literals([
    'function',
    'method',
    'arrow',
    'constructor',
    'getter',
    'setter',
    'anonymous',
  ]),
  name: Schema.NullOr(Schema.String),
  line: Schema.Int,
  column: Schema.Int,
  signature: Schema.String,
  lines: Schema.Int,
  logicalLines: Schema.Int,
  parameters: Schema.Int,
  cyclomatic: Schema.Int,
  cognitive: Schema.Int,
  maxNesting: Schema.Int,
  halstead: HalsteadSchema,
  maintainabilityIndex: Schema.Number,
  recursive: Schema.Boolean,
});

const ScoredFixtureFields = {
  file: Schema.String,
  functions: Schema.Array(ScoredFunctionSchema),
};

export const ScoredFixtureSchema = Schema.Struct(ScoredFixtureFields);

export const DriverFixtureSchema = Schema.Struct({
  ...ScoredFixtureFields,
  error: Schema.optionalKey(Schema.String),
});

export const DriverOutputSchema = Schema.Struct({
  fixtures: Schema.Array(DriverFixtureSchema),
});

export const ExpectedFixtureSchema = Schema.Struct({
  functions: Schema.Array(ScoredFunctionSchema),
});

export const ExpectationsSchema = Schema.Struct({
  specification: Schema.String,
  fixtures: Schema.Record(Schema.String, ExpectedFixtureSchema),
});

export type ScoredFunction = Schema.Schema.Type<typeof ScoredFunctionSchema>;
export type ScoredFixture = Schema.Schema.Type<typeof ScoredFixtureSchema>;
export type DriverFixture = Schema.Schema.Type<typeof DriverFixtureSchema>;
export type ExpectedFixture = Schema.Schema.Type<typeof ExpectedFixtureSchema>;
