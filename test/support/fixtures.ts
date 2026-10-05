/**
 * Fixtures shared by the metric rule tests.
 *
 * `nestedIfs` is written as a family so that the score of each member can be
 * read off its shape rather than measured: an `if` found at depth `n` costs
 * `1 + n` cognitive complexity and `n` levels of nesting, so the members score
 * 1/1, 3/2, 6/3, 10/4, 15/5 and 21/6 for one to six levels.
 */
export function nestedIfs(levels: number): string {
  const lines: string[] = ['export function tier(value: number): number {'];
  for (let depth = 0; depth < levels; depth += 1) {
    lines.push(`${'  '.repeat(depth + 1)}if (value > ${depth}) {`);
  }
  lines.push(`${'  '.repeat(levels + 1)}return ${levels};`);
  for (let depth = levels - 1; depth >= 0; depth -= 1) {
    lines.push(`${'  '.repeat(depth + 1)}}`);
  }
  lines.push('  return -1;');
  lines.push('}');
  return lines.join('\n');
}

/**
 * A function whose maintainability index is `64.99188980245168`, just under
 * the shipped limit of 65 and inside the window that rounds onto it.
 *
 * The shape is fixed by that number: seven lines, three distinct operators,
 * twelve distinct operands and no branch, which is what puts the index a
 * hundredth below the limit instead of a tenth below it.
 */
export const INDEX_BELOW_THE_LIMIT = [
  'export function ledgerTotal(seed: number): number {',
  '  let total = seed;',
  '  total = total + subtotal + tax + fee + duty + rate + levy + surcharge;',
  '  total = total + discount + tax + fee + duty + rate + levy + surcharge;',
  '  total = total + shipping + tax + fee + duty + rate + levy + surcharge;',
  '  return total;',
  '}',
].join('\n');

/** The same shape with one operand fewer, which lifts the index to `65.40859757045058`. */
export const INDEX_ABOVE_THE_LIMIT = [
  'export function ledgerTotal(seed: number): number {',
  '  let total = seed;',
  '  total = total + subtotal + tax + fee + duty + rate + levy;',
  '  total = total + discount + tax + fee + duty + rate + levy;',
  '  total = total + shipping + tax + fee + duty + rate + levy;',
  '  return total;',
  '}',
].join('\n');
