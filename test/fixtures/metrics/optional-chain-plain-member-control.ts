export function readPlain(input: { inner: { value: number } }): number {
  return input.inner.value;
}

export function readOptional(input: { inner?: { value: number } }): number | undefined {
  return input?.inner?.value;
}
