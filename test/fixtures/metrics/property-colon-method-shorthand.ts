export const moduleCounter = {
  size(): number {
    return 1;
  },
};

export function methodInFunction(): number {
  const counter = {
    size(): number {
      return 1;
    },
  };
  return counter.size;
}
