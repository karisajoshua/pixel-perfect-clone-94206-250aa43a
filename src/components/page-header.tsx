import { type ReactNode } from "react";
import { HelpPanel } from "@/components/help-panel";

export function PageHeader({
  title,
  subtitle,
  actions,
  helpDocId,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  helpDocId?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        {actions}
        {helpDocId && <HelpPanel docId={helpDocId} />}
      </div>
    </div>
  );
}