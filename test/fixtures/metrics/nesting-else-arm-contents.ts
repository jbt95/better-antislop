export function nestedIfInElse(a: boolean, b: boolean): number {
  if (a) {
    return 1;
  } else {
    if (b) {
      return 2;
    }
  }
  return 0;
}

export function nestedIfInElseIf(a: boolean, b: boolean, c: boolean): number {
  if (a) {
    return 1;
  } else if (b) {
    if (c) {
      return 2;
    }
  }
  return 0;
}
