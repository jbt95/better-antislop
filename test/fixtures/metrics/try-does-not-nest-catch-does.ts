export function tryIsNotStructural(candidate: number): number {
  try {
    if (candidate > 0) {
      return 1;
    }
  } catch {
    if (candidate < 0) {
      return -1;
    }
  }
  return 0;
}

export function finallyIsNotStructural(candidate: number): number {
  try {
    if (candidate > 0) {
      return 1;
    }
  } finally {
    if (candidate < 0) {
      return -1;
    }
  }
  return 0;
}
