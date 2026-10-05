export function mixedTreeOrder(
  a: boolean,
  b: boolean,
  c: boolean,
  d: boolean,
  e: boolean,
): boolean {
  return a || (b && c) || (d && e);
}
