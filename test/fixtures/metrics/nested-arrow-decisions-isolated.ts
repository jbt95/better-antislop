export function outerWithNestedArrow(source: number[]): number {
  let total = 0;
  const visit = (value: number): number => {
    if (value > 0 && value < 10) {
      return value;
    }
    if (value < 0) {
      return -value;
    }
    return 0;
  };
  for (const value of source) {
    total += visit(value);
  }
  return total;
}
