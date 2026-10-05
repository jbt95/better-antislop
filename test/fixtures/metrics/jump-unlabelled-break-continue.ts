export function unlabelledJumps(rows: number[][]): number {
  let total = 0;
  for (const row of rows) {
    if (row.length === 0) {
      continue;
    }
    for (const cell of row) {
      if (cell < 0) {
        break;
      }
      total += cell;
    }
  }
  return total;
}
