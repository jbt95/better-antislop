export function overloaded(value: string): string;
export function overloaded(value: number): number;
export function overloaded(value: string | number): string | number {
  if (typeof value === 'string') {
    return value;
  }
  return value;
}
