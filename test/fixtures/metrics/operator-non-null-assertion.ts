export function asserted(input: string | undefined): string {
  return input!.length > 0 ? input! : '';
}
