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
    <div className="zest-premium-reveal flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[1.8rem] font-semibold leading-tight tracking-[-0.025em] text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {actions}
        {helpDocId && <HelpPanel docId={helpDocId} />}
      </div>
    </div>
  );
}