import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitServiceRequest } from "@/lib/service-requests.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Props = {
  policyId?: string;
  type: "renewal" | "cancellation" | "info" | "callback";
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function ServiceRequestButton({ policyId, type, label, variant = "outline" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [contact, setContact] = useState<"email" | "phone" | "whatsapp" | "sms">("email");
  const fn = useServerFn(submitServiceRequest);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      fn({ data: { request_type: type, policy_id: policyId, preferred_contact: contact, reason: reason || null } }),
    onSuccess: () => {
      toast.success("Request submitted. Our team will contact you shortly.");
      qc.invalidateQueries({ queryKey: ["portal-service-requests"] });
      setOpen(false);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to submit"),
  });
  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Preferred contact</Label>
              <Select value={contact} onValueChange={(v) => setContact(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone call</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{type === "cancellation" ? "Reason for cancellation" : "Notes (optional)"}</Label>
              <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "Submitting…" : "Submit request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}