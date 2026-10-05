export class Handler {
  handle = (value: number): number => {
    if (value > 0 && value < 10) {
      return value;
    }
    return 0;
  };

  static create = (): Handler => new Handler();
}
