import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { getClientPortalInfo, resetClientPortalPassword } from "@/lib/admin-users.functions";
import { CredentialsDialog, type PortalCreds } from "@/components/clients/client-form-dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
};

export function PortalLoginDialog({ open, onOpenChange, clientId }: Props) {
  const getInfo = useServerFn(getClientPortalInfo);
  const resetFn = useServerFn(resetClientPortalPassword);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCreds, setNewCreds] = useState<PortalCreds | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-portal-info", clientId],
    enabled: open,
    queryFn: () => getInfo({ data: { client_id: clientId } }),
  });

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };
  const portalUrl = typeof window !== "undefined" ? `${window.location.origin}/portal` : "https://app.zestinsurance.co.ke/portal";
  const identifier = data?.phone || data?.email || "";
  const identifierLabel = data?.phone ? "Phone" : "Email";

  const doReset = async () => {
    setBusy(true);
    try {
      const res = await resetFn({ data: { client_id: clientId } });
      setNewCreds(res);
      setConfirming(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reset password");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>Portal login</DialogTitle></DialogHeader>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.has_login ? (
            <p className="text-sm text-muted-foreground">This client has no portal login yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Passwords are stored hashed and cannot be revealed. Share the identifier below with the client, or reset the password to issue a new temporary one.</p>
              <div className="space-y-1.5">
                <Label>Portal link</Label>
                <div className="flex gap-2"><Input readOnly value={portalUrl} /><Button variant="outline" size="icon" onClick={() => copy(portalUrl)}><Copy className="h-4 w-4" /></Button></div>
              </div>
              <div className="space-y-1.5">
                <Label>{identifierLabel}</Label>
                <div className="flex gap-2"><Input readOnly value={identifier} /><Button variant="outline" size="icon" onClick={() => copy(identifier)}><Copy className="h-4 w-4" /></Button></div>
              </div>
              {data?.phone && data?.email && (
                <div className="space-y-1.5">
                  <Label>Email (alternate)</Label>
                  <div className="flex gap-2"><Input readOnly value={data.email} /><Button variant="outline" size="icon" onClick={() => copy(data.email!)}><Copy className="h-4 w-4" /></Button></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            {data?.has_login && (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                <KeyRound className="h-4 w-4 mr-1" /> Reset password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset portal password?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will invalidate the client's current password and generate a new temporary one. The new password will be shown once.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button onClick={doReset} disabled={busy}>{busy ? "Resetting…" : "Reset password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CredentialsDialog creds={newCreds} onClose={() => setNewCreds(null)} />
    </>
  );
}