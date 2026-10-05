export function messageWithOperators(a: boolean, b: boolean): string {
  return `a && b || c ? d : e || ${a && b} z`;
}

export function twoQuasis(a: number): string {
  return `first ${a} && middle ${a} || last`;
}
