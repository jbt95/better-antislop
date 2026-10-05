export function Panel(props: { title: string; visible: boolean }): JSX.Element {
  if (!props.visible) {
    return <div className="panel" />;
  }
  return (
    <section className="panel">
      <h1>{props.title}</h1>
    </section>
  );
}
