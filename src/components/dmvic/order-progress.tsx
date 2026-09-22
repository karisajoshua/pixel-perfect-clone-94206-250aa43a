import { CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DmvicCertificateOrderStatus } from "@/lib/dmvic/certificate-orders";

const stages = [
  { key: "validation", label: "Validate" },
  { key: "payment", label: "Payment" },
  { key: "issuance", label: "Issue" },
  { key: "complete", label: "Complete" },
] as const;

function progress(status: DmvicCertificateOrderStatus) {
  if (status === "awaiting_validation") return 0;
  if (status === "validated" || status === "awaiting_payment") return 1;
  if (status === "paid" || status === "issuing") return 2;
  if (status === "issued") return 4;
  return 0;
}

export function DmvicOrderProgress({ status }: { status: DmvicCertificateOrderStatus }) {
  const p=progress(status);
  const attention=["manual_review","failed","refund_pending","refunded"].includes(status);
  return <div className="space-y-2" aria-live="polite">
    <div className="grid grid-cols-4 gap-2">
      {stages.map((s,i)=>{const done=i<p, active=i===p && !attention && p<4; return <div key={s.key} className={cn("rounded-md border p-2 text-center text-xs transition-colors",done&&"border-emerald-500/30 bg-emerald-500/5",active&&"border-primary/40 bg-primary/5",attention&&i===Math.min(p,3)&&"border-amber-500/30 bg-amber-500/5")}>
        <div className="mb-1 flex justify-center">{done?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:active?<Loader2 className="h-4 w-4 animate-spin text-primary"/>:attention&&i===Math.min(p,3)?<AlertTriangle className="h-4 w-4 text-amber-600"/>:<Circle className="h-4 w-4 text-muted-foreground"/>}</div>{s.label}
      </div>})}
    </div>
    {attention&&<p className="text-xs text-amber-700">{status==="manual_review"?"DMVIC requires manual review before this transaction can continue.":status==="refund_pending"?"Certificate issuance did not complete. Refund handling is in progress.":status==="refunded"?"Payment has been refunded.":"This transaction needs attention before continuing."}</p>}
    {status==="issued"&&<p className="text-xs font-medium text-emerald-700">Certificate issued successfully.</p>}
  </div>;
}
