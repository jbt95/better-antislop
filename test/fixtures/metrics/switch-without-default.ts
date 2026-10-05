export function withoutDefault(value: number): string {
  switch (value) {
    case 1:
      return 'one';
    case 2:
      return 'two';
  }
  return 'many';
}
