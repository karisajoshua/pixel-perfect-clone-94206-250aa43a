import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DOC_SECTIONS } from "@/lib/docs/content";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/admin/docs")({
  component: DocsPage,
});

function DocsPage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return DOC_SECTIONS;
    return DOC_SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(t) ||
        s.summary.toLowerCase().includes(t) ||
        s.body.toLowerCase().includes(t),
    );
  }, [q]);

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
      <PageHeader
        title="Documentation"
        subtitle="Everything you need to know about running the agency on Zest."
      />
      <Input
        placeholder="Search documentation…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {DOC_SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-sm text-primary hover:underline">
            {s.title}
          </a>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-20">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>{s.title}</span>
                {s.route && (
                  <Link to={s.route}>
                    <Button size="sm" variant="outline">Go to page</Button>
                  </Link>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{s.summary}</p>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{s.body}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No documentation matches "{q}".</p>
        )}
      </div>
    </div>
  );
}