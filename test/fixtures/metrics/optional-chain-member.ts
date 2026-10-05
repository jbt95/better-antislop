export function readNested(input: { inner?: { value?: number } }): number | undefined {
  return input?.inner?.value;
}
