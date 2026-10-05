const flag = true;
let stored = 0;

export const config = {
  name: 'config',
  shorthand: flag,
  method(): number {
    if (flag) {
      return 1;
    }
    return 0;
  },
  get computed(): number {
    return 2;
  },
  set computed(value: number) {
    stored = value;
  },
  arrow: (value: number): number => value + 1,
};
