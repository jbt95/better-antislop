export function twiceRecursive(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value === 1) {
    return twiceRecursive(value - 1);
  }
  return twiceRecursive(value - 1) + twiceRecursive(value - 2);
}
