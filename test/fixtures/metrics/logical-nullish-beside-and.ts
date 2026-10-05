export function nullishLeftOfAnd(left: number | undefined, middle: number, right: number): number {
  return (left ?? middle) && right;
}

export function nullishRightOfAnd(left: number, middle: number, right: number): number {
  return left ?? (middle && right);
}
