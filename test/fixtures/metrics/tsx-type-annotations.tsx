export function labelled(props: { label: string }): JSX.Element {
  return <span data-label={props.label}>{props.label}</span>;
}

export function asserted(value: unknown): string {
  const text = value as string;
  return text;
}
