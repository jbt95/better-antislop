export function factorial(value: number): number {
  if (value <= 1) {
    return 1;
  }
  return value * factorial(value - 1);
}
