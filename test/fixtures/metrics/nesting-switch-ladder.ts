export function switchInsideSwitch(value: number): number {
  let total = 0;
  switch (value) {
    case 1: {
      switch (value) {
        case 2: {
          switch (value) {
            case 3: {
              total = 3;
              break;
            }
            default: {
              total = 2;
            }
          }
          break;
        }
        default: {
          total = 1;
        }
      }
      break;
    }
    default: {
      total = 0;
    }
  }
  return total;
}
