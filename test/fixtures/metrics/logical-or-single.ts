export function eitherEnabled(flag: boolean, fallback: boolean): boolean {
  return flag || fallback;
}
