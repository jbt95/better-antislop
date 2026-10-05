export class Formatter {
  format(value: number): string {
    if (value > 0) {
      return String(value);
    }
    return 'zero';
  }

  static create(): Formatter {
    return new Formatter();
  }
}
