export function constructing(): Date {
  return new Date();
}

export function newTarget(): boolean {
  return new.target === undefined;
}

export function moduleUrl(): string {
  return import.meta.url;
}
