export function* delegating(source: Generator<number>): Generator<number> {
  yield* source;
  yield 0;
}
