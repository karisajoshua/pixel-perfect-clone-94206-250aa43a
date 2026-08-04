import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { transferVehicleOwnership } from "@/lib/vehicles.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vehicle: { id: string; registration_no: string; client_id: string; currentOwnerLabel?: string } | null;
  onDone?: () => void;
};

export function TransferOwnershipDialog({ open, onOpenChange, vehicle, onDone }: Props) {
  const [clients, setClients] = useState<any[]>([]);
  const [clientText, setClientText] = useState("");
  const [showList, setShowList] = useState(false);
  const [searching, setSearching] = useState(false);
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const transferFn = useServerFn(transferVehicleOwnership);

  useEffect(() => {
    if (!open) return;
    setClientText(""); setNewClientId(null); setReason("");
    setClients([]);
  }, [open]);

  // Debounced server-side search across the whole client database
  useEffect(() => {
    if (!open) return;
    const t = clientText.trim();
    if (t.length < 2) { setClients([]); setSearching(false); return; }
    setSearching(true);
    const esc = t.replace(/[%,()]/g, " ");
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company_name, client_type")
        .or(`full_name.ilike.%${esc}%,company_name.ilike.%${esc}%`)
        .order("full_name")
        .limit(20);
      setClients(data ?? []);
      setSearching(false);
    }, 250);
    return () => { clearTimeout(handle); setSearching(false); };
  }, [open, clientText]);

  const filtered = clients.filter((c) => c.id !== vehicle?.client_id);

  const submit = async () => {
    if (!vehicle || !newClientId) return;
    setSaving(true);
    try {
      await transferFn({ data: { vehicle_id: vehicle.id, new_client_id: newClientId, reason: reason.trim() || undefined } });
      toast.success("Vehicle ownership transferred");
      onDone?.(); onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer vehicle ownership</DialogTitle>
          <DialogDescription>
            {vehicle ? <>Move <span className="font-mono font-medium">{vehicle.registration_no}</span> from <span className="font-medium">{vehicle.currentOwnerLabel ?? "current owner"}</span> to a new client. Existing policies keep their original client for history.</> : null}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5 relative">
            <Label>New owner *</Label>
            <Input
              placeholder="Search client by name…"
              value={clientText}
              onChange={(e) => { setClientText(e.target.value); setShowList(true); setNewClientId(null); }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
            />
            {showList && (searching || clientText.trim().length >= 2) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-56 overflow-auto">
                {searching && <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>}
                {!searching && filtered.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No clients match.</div>}
                {!searching && filtered.map((c) => {
                  const name = c.client_type === "corporate" ? (c.company_name ?? c.full_name) : c.full_name;
                  return (
                    <button key={c.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setClientText(name ?? ""); setNewClientId(c.id); setShowList(false); }}
                    >{name}</button>
                  );
                })}
              </div>
            )}
            {clientText.trim() && !newClientId && (
              <p className="text-xs text-muted-foreground">
                {clientText.trim().length < 2 ? "Type at least 2 characters to search." : "Pick a client from the list."}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Reason / notes</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vehicle sold, ownership transferred at NTSA on…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !newClientId}>{saving ? "Transferring…" : "Transfer ownership"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}