export function ternaryChainAlternate(a: number, b: number, c: number): number {
  return a > 0 ? 1 : b > 0 ? 2 : c > 0 ? 3 : 0;
}
