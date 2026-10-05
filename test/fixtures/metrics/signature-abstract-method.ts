export abstract class Service {
  abstract run(input: string): Promise<void>;

  concrete(input: string): Promise<void> {
    if (input.length > 0) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('empty'));
  }
}
