export function callOptional(handler: (() => number) | undefined): number | undefined {
  return handler?.();
}
