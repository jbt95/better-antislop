export class Walker {
  step(value: number): number {
    if (value <= 0) {
      return 0;
    }
    return value + this.step(value - 1);
  }
}
