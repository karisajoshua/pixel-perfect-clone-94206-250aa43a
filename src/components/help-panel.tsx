import { HelpCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DOC_SECTIONS } from "@/lib/docs/content";
import ReactMarkdown from "react-markdown";

export function HelpPanel({ docId, fallback }: { docId?: string; fallback?: string }) {
  const section = docId ? DOC_SECTIONS.find((d) => d.id === docId) : undefined;
  const body = section?.body ?? fallback ?? "No documentation for this page yet.";
  const title = section?.title ?? "Help";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Help">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 prose prose-sm dark:prose-invert">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
        <div className="mt-6">
          <Link to="/admin/docs">
            <Button variant="outline" size="sm">Open full documentation</Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}