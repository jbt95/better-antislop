export function plainLabel(rows: number[]): number {
  let total = 0;
  scan: for (const row of rows) {
    total += row;
  }
  return total;
}
