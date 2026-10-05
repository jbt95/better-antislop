export function nestedCatch(source: number[]): number {
  let total = 0;
  try {
    total += source.length;
    try {
      total += source.length;
      try {
        total += source.length;
      } catch {
        total -= 1;
      }
    } catch {
      total -= 1;
    }
  } catch {
    total -= 1;
  }
  return total;
}
