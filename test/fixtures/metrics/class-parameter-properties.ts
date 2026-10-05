export class Counter {
  private total: number = 0;

  constructor(
    private readonly step: number,
    public label: string,
  ) {
    this.total = step;
  }

  advance(): number {
    this.total += this.step;
    return this.total;
  }
}
