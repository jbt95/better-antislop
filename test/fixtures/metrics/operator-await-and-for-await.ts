export async function awaiting(source: Promise<number>): Promise<number> {
  const value = await source;
  return value;
}

export async function iterating(source: AsyncIterable<number>): Promise<number> {
  let total = 0;
  for await (const value of source) {
    total += value;
  }
  return total;
}
