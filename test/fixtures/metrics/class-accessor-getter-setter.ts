export class Cell {
  #value: number = 0;

  get value(): number {
    return this.#value;
  }

  set value(next: number) {
    if (next < 0) {
      return;
    }
    this.#value = next;
  }
}
