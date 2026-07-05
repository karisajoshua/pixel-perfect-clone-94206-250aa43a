import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { sendPlatformNotice } from "@/lib/platform.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Agency = { id: string; name: string };

export function SendNoticeDialog({
  trigger,
  agencies,
  defaultTenantId,
}: {
  trigger: React.ReactNode;
  agencies: Agency[];
  defaultTenantId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [audience, setAudience] = useState<"all" | "tenant">(defaultTenantId ? "tenant" : "all");
  const [tenantId, setTenantId] = useState<string | null>(defaultTenantId ?? null);
  const qc = useQueryClient();
  const fn = useServerFn(sendPlatformNotice);
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success("Notice sent");
      qc.invalidateQueries({ queryKey: ["platform-notices"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
      setOpen(false);
      setTitle(""); setBody("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Send a notice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agencies</SelectItem>
                <SelectItem value="tenant">Specific agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audience === "tenant" && (
            <div>
              <Label>Agency</Label>
              <Select value={tenantId ?? ""} onValueChange={(v) => setTenantId(v)}>
                <SelectTrigger><SelectValue placeholder="Choose agency" /></SelectTrigger>
                <SelectContent>
                  {agencies.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance" />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to tell them?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={m.isPending || !title.trim() || !body.trim() || (audience === "tenant" && !tenantId)}
            onClick={() => m.mutate({ data: { title, body, severity, audience, tenant_id: audience === "tenant" ? tenantId : null } })}
          >
            {m.isPending ? "Sending…" : "Send notice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}