export function oneIf(flag: boolean): number {
  if (flag) {
    return 1;
  }
  return 0;
}

export function twoIfs(flag: boolean, other: boolean): number {
  if (flag) {
    if (other) {
      return 2;
    }
  }
  return 0;
}

export function threeIfs(flag: boolean, other: boolean, third: boolean): number {
  if (flag) {
    if (other) {
      if (third) {
        return 3;
      }
    }
  }
  return 0;
}

export function fourIfs(flag: boolean, other: boolean, third: boolean, fourth: boolean): number {
  if (flag) {
    if (other) {
      if (third) {
        if (fourth) {
          return 4;
        }
      }
    }
  }
  return 0;
}
