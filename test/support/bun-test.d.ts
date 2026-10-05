/**
 * The two Bun test globals the rule-test bridge uses.
 *
 * `tsconfig.json` asks for `node` types only, and this package does not depend
 * on `@types/bun`, so `import { describe, it } from 'bun:test'` would not
 * resolve for anyone who type checks the `test/` tree. Declaring the two
 * functions keeps that tree type clean without pulling in a dependency.
 */
declare module 'bun:test' {
  type TestBody = () => void;
  type TestBlock = (name: string, body: TestBody) => void;
  export const describe: TestBlock;
  export const it: TestBlock;
}
