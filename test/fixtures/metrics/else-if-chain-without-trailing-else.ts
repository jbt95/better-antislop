export function elseIfChainNoElse(a: boolean, b: boolean): number {
  if (a) {
    return 1;
  } else if (b) {
    return 2;
  }
  return 0;
}
