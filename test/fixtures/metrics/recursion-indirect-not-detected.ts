export function isEven(value: number): boolean {
  if (value === 0) {
    return true;
  }
  return isOdd(value - 1);
}

export function isOdd(value: number): boolean {
  if (value === 0) {
    return false;
  }
  return isEven(value - 1);
}
