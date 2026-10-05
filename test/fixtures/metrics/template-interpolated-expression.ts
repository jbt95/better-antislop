export function interpolated(flag: boolean, count: number): string {
  return `${flag ? 'yes' : 'no'}: ${count}`;
}
