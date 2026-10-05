export function ternaryInConsequent(a: number, b: number): number {
  return a > 0 ? (b > 0 ? (b > 10 ? 3 : 2) : 1) : 0;
}

export function ternaryInAlternate(a: number, b: number): number {
  return a > 0 ? 0 : b > 0 ? (b > 10 ? 3 : 2) : 1;
}
