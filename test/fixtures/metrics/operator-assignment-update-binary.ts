export function assignmentFamily(target: { value: number }, other: number): number {
  target.value = 1;
  target.value += 2;
  target.value ??= 3;
  target.value++;
  --target.value;
  const compared = target.value === other;
  return compared ? target.value : other;
}
