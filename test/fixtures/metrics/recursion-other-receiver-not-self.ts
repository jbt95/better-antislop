export class Caller {
  step(value: number, helper: { step: (value: number) => number }): number {
    if (value <= 0) {
      return 0;
    }
    return value + helper.step(value - 1);
  }
}
