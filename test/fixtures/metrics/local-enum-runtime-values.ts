export function localScale(value: number): number {
  enum Scale {
    Small = 1,
    Large = 2,
  }
  return Scale.Small + value;
}
