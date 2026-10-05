export function withDefaultValue(value: number, fallback: number = 0): number {
  return value + fallback;
}

export function withRest(first: number, ...rest: number[]): number {
  return rest.length + first;
}

export function fromArray([first, second]: number[]): number {
  return first + second;
}
