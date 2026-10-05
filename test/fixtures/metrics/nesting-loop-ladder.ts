export function forOfInsideForOf(source: number[]): number {
  let total = 0;
  for (const outer of source) {
    for (const middle of source) {
      for (const inner of source) {
        total += outer + middle + inner;
      }
    }
  }
  return total;
}

export function whileInsideWhile(limit: number): number {
  let total = 0;
  let outer = 0;
  while (outer < limit) {
    let middle = 0;
    while (middle < limit) {
      let inner = 0;
      while (inner < limit) {
        total += inner;
        inner += 1;
      }
      middle += 1;
    }
    outer += 1;
  }
  return total;
}

export function doWhileInsideDoWhile(limit: number): number {
  let total = 0;
  let outer = 0;
  do {
    let middle = 0;
    do {
      total += middle;
      middle += 1;
    } while (middle < limit);
    outer += 1;
  } while (outer < limit);
  return total;
}

export function forInInsideForIn(record: Record<string, number>): number {
  let total = 0;
  for (const key in record) {
    for (const inner in record) {
      total += key.length + inner.length;
    }
  }
  return total;
}
