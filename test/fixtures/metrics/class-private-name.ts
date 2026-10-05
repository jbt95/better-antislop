export class Vault {
  #secret: number = 1;

  read(): number {
    return this.#secret;
  }

  write(value: number): void {
    this.#secret = value;
  }
}
