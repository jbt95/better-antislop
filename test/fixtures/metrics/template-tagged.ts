export function tagged(label: string, value: number): string {
  return String.raw`${label} && ${value}`;
}
