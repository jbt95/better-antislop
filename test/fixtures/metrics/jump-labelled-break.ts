export function labelledBreak(rows: number[][]): number {
  let total = 0;
  outer: for (const row of rows) {
    for (const cell of row) {
      if (cell < 0) {
        break outer;
      }
      total += cell;
    }
  }
  return total;
}
