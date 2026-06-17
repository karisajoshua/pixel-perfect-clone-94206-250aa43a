import { createFileRoute } from "@tanstack/react-router";

// Placeholder pages for modules being delivered in upcoming phases.
function makeStub(title: string, body: string) {
  return function StubPage() {
    return (
      <div className="p-8 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{body}</p>
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          This module is being rolled out in an upcoming phase.
        </div>
      </div>
    );
  };
}

export const stub = makeStub;