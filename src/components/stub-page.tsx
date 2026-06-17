export function StubPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <div className="text-3xl">🚧</div>
        <p className="mt-3 text-sm text-muted-foreground">This module is being rolled out in an upcoming phase of the project.</p>
      </div>
    </div>
  );
}