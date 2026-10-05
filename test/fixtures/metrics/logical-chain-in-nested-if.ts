export function chainUnderTwoIfs(a: boolean, b: boolean, c: boolean, flag: boolean): boolean {
  if (flag) {
    if (a) {
      return b && c;
    }
  }
  return false;
}
