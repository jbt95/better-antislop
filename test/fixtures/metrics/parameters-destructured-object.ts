export function fromObject({ a, b }: { a: number; b: number }): number {
  return a + b;
}

export function withDefault({ a, b } = { a: 0, b: 0 }): number {
  return a + b;
}
