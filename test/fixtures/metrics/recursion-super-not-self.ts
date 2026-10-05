export class Base {
  step(value: number): number {
    return value;
  }
}

export class Derived extends Base {
  step(value: number): number {
    if (value <= 0) {
      return 0;
    }
    return value + super.step(value - 1);
  }
}
