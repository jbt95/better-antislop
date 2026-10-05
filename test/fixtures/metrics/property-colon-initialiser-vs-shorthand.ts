const size = 1;

export function keyedProperty(): number {
  return { size: 1 }.size;
}

export function shorthandProperty(): number {
  return { size }.size;
}

export function twoKeyedProperties(): number {
  return { width: 1, height: 2 }.width;
}
