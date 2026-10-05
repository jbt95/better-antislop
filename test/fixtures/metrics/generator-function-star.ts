export function* counter(limit: number): Generator<number> {
  for (let index = 0; index < limit; index += 1) {
    yield index;
  }
}
