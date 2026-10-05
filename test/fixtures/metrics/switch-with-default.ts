export function withDefault(value: number): string {
  switch (value) {
    case 1:
      return 'one';
    case 2:
      return 'two';
    default:
      return 'many';
  }
}
