export function outerWithNestedFunction(flag: boolean): number {
  function helper(value: number): number {
    if (value > 0 && flag) {
      return value;
    }
    return 0;
  }
  return helper(1) + helper(2);
}
