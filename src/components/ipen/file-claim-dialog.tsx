import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { createIpenClaim } from "@/lib/ipen/claims.functions";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  claim: {
    id: string;
    incident_date?: string | null;
    description?: string | null;
    location?: string | null;
    policies?: { ipen_policy_id?: string | null } | null;
    vehicles?: { id?: string } | null;
  };
  onFiled?: () => void;
};

export function IpenFileClaimDialog({ open, onOpenChange, claim, onFiled }: Props) {
  const [policyId, setPolicyId] = useState(claim.policies?.ipen_policy_id ?? "");
  const [insuredItemId, setInsuredItemId] = useState("");
  const [dateOfLoss, setDateOfLoss] = useState(claim.incident_date ?? new Date().toISOString().slice(0,10));
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().slice(0,10));
  const [claimDetails, setClaimDetails] = useState(claim.description ?? "");
  const [riskLocation, setRiskLocation] = useState(claim.location ?? "");
  const [police, setPolice] = useState(false);
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(createIpenClaim);

  const submit = async () => {
    if (!policyId || !insuredItemId || !claimDetails || !riskLocation) { toast.error("Fill all required fields"); return; }
    setBusy(true);
    try {
      await fn({ data: {
        localClaimId: claim.id,
        policyId, insuredItemId,
        claimDate: reportedDate, dateOfLoss, reportedDate,
        claimDetails, riskLocation,
        reportedToPolice: police,
      }});
      toast.success("Claim filed with IPEN");
      onFiled?.();
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Failed to file claim"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>File claim via IPEN</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <F label="IPEN policy ID *"><Input value={policyId} onChange={(e) => setPolicyId(e.target.value)} placeholder="Linked policy IPEN id" /></F>
          <F label="Insured item ID *"><Input value={insuredItemId} onChange={(e) => setInsuredItemId(e.target.value)} placeholder="Vehicle/asset id on IPEN" /></F>
          <F label="Date of loss *"><Input type="date" value={dateOfLoss} onChange={(e) => setDateOfLoss(e.target.value)} /></F>
          <F label="Reported date"><Input type="date" value={reportedDate} onChange={(e) => setReportedDate(e.target.value)} /></F>
          <div className="col-span-2"><F label="Location *"><Input value={riskLocation} onChange={(e) => setRiskLocation(e.target.value)} /></F></div>
          <div className="col-span-2"><F label="Details *"><Textarea rows={4} value={claimDetails} onChange={(e) => setClaimDetails(e.target.value)} /></F></div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={police} onCheckedChange={(v) => setPolice(!!v)} /> Reported to police
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}File claim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}