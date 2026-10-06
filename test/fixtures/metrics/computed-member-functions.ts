declare const dynamicKey: string;

export class DynamicMethods {
  [dynamicKey](): number {
    return 1;
  }

  [dynamicKey] = (): number => 2;
}

export const dynamicObject = {
  [dynamicKey](): number {
    return 3;
  },
  [dynamicKey]: (): number => 4,
};
