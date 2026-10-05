export function firstDefined(left: number | undefined, right: number): number {
  return left ?? right;
}
