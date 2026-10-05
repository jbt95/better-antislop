export class Registry {
  static entries: Map<string, string> = new Map();

  static {
    if (Registry.entries.size > 0) {
      Registry.entries.clear();
    }
  }
}
