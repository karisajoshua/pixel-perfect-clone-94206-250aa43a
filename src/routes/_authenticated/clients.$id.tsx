import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Upload, MessageSquarePlus, FileText, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog, CredentialsDialog, type PortalCreds } from "@/components/clients/client-form-dialog";
import { ClientDocuments } from "@/components/clients/client-documents";
import { ClientCommunications } from "@/components/clients/client-communications";
import { ClientKycPanel } from "@/components/clients/client-kyc-panel";
import { useServerFn } from "@tanstack/react-start";
import { createClientPortalAccount } from "@/lib/admin-users.functions";
import { updateClientBranch, deleteClient } from "@/lib/clients.functions";
import { useMyRoles } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone } from "@/lib/phone";
import { IpenMotorQuoteWizard } from "@/components/ipen/motor-quote-wizard";
import { PortalLoginDialog } from "@/components/clients/portal-login-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/clients/$id")({ beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = useParams({ from: "/_authenticated/clients/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [creds, setCreds] = useState<PortalCreds | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [phonePrompt, setPhonePrompt] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const portalFn = useServerFn(createClientPortalAccount);
  const updateBranchFn = useServerFn(updateClientBranch);
  const deleteFn = useServerFn(deleteClient);
  const { data: roles } = useMyRoles();
  const isAdmin = (roles ?? []).includes("admin");
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSel, setBranchSel] = useState<string>("");
  const [branchBusy, setBranchBusy] = useState(false);
  const [ipenOpen, setIpenOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const isAdminOrManager = (roles ?? []).some((r) => r === "admin" || r === "manager");

  const { data: branches } = useQuery({
    queryKey: ["branches-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*, branches(name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!client) return <div className="p-8">Not found</div>;

  const generatePortal = async (phone?: string) => {
    setGenBusy(true);
    try {
      const res = await portalFn({ data: { client_id: id, ...(phone ? { phone } : {}) } });
      setCreds(res);
      setPhonePrompt(false);
      setPhoneInput("");
      qc.invalidateQueries({ queryKey: ["client", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create portal login");
    } finally { setGenBusy(false); }
  };

  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/clients"><ArrowLeft className="h-4 w-4 mr-1" /> All clients</Link></Button>
      <PageHeader
        title={client.client_type === "corporate" ? client.company_name ?? client.full_name : client.full_name}
        subtitle={`${client.client_type} • ${(client as any).branches?.name ?? "No branch"} • KYC ${client.kyc_status}`}
        actions={
          <div className="flex gap-2">
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => { setBranchSel(client.branch_id ?? ""); setBranchOpen(true); }}
              >
                Change branch
              </Button>
            )}
            <Button variant="outline" onClick={() => setIpenOpen(true)}>
              <FileText className="h-4 w-4 mr-1" /> IPEN motor quote
            </Button>
            {client.auth_user_id && isAdminOrManager && (
              <Button variant="outline" onClick={() => setPortalOpen(true)}>
                <KeyRound className="h-4 w-4 mr-1" /> View portal login
              </Button>
            )}
            {!client.auth_user_id && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!client.phone && !client.email) {
                    setPhoneInput("");
                    setPhonePrompt(true);
                    return;
                  }
                  generatePortal();
                }}
                disabled={genBusy}
                title={!client.phone && !client.email ? "Add a phone number to create a portal login" : "Create a portal account for this client"}
              >
                <KeyRound className="h-4 w-4 mr-1" /> {genBusy ? "Creating…" : "Generate portal login"}
              </Button>
            )}
            <Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
            {isAdmin && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            )}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="comms">Communications</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Item label="Full name" value={client.full_name} />
                <Item label="Company" value={client.company_name} />
                <Item label="Email" value={client.email} />
                <Item label="Phone" value={client.phone} />
                <Item label="Alt phone" value={client.alt_phone} />
                <Item label="ID / Reg. number" value={client.id_number} />
                <Item label="KRA PIN" value={client.kra_pin} />
                <Item label="City" value={client.city} />
                <Item label="Address" value={client.address} />
                <Item label="Occupation" value={client.occupation} />
                <Item label="Branch" value={(client as any).branches?.name ?? "—"} />
                <Item label="Notes" value={client.notes} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="kyc">
          <ClientKycPanel clientId={id} />
        </TabsContent>
        <TabsContent value="documents">
          <ClientDocuments clientId={id} />
        </TabsContent>
        <TabsContent value="comms">
          <ClientCommunications clientId={id} />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={edit} onOpenChange={setEdit} initial={client} onSaved={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      <IpenMotorQuoteWizard open={ipenOpen} onOpenChange={setIpenOpen} client={{ id, email: client.email, phone: client.phone, full_name: client.client_type === "corporate" ? client.company_name ?? client.full_name : client.full_name }} />
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <PortalLoginDialog open={portalOpen} onOpenChange={setPortalOpen} clientId={id} />
      <Dialog open={branchOpen} onOpenChange={(o) => { if (!o) setBranchOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign client to branch</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Move this client (and their records) under a different branch. Branch managers see only clients in their own branch.</p>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select value={branchSel} onValueChange={setBranchSel}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBranchOpen(false)}>Cancel</Button>
            <Button
              disabled={branchBusy || !branchSel || branchSel === (client.branch_id ?? "")}
              onClick={async () => {
                setBranchBusy(true);
                try {
                  await updateBranchFn({ data: { clientId: id, branchId: branchSel } });
                  toast.success("Client moved to new branch");
                  setBranchOpen(false);
                  qc.invalidateQueries({ queryKey: ["client", id] });
                  qc.invalidateQueries({ queryKey: ["clients"] });
                } catch (e: any) {
                  toast.error(e?.message ?? "Could not move client");
                } finally {
                  setBranchBusy(false);
                }
              }}
            >{branchBusy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={phonePrompt} onOpenChange={(o) => { if (!o) { setPhonePrompt(false); setPhoneInput(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a phone number</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This client has no phone number on file. Enter one to create their portal login. Kenyan numbers like 0712345678 are accepted.</p>
          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="0712 345 678" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPhonePrompt(false); setPhoneInput(""); }}>Cancel</Button>
            <Button
              disabled={genBusy || !normalizePhone(phoneInput)}
              onClick={() => {
                const p = normalizePhone(phoneInput);
                if (!p) { toast.error("Enter a valid phone number"); return; }
                generatePortal(p);
              }}
            >{genBusy ? "Creating…" : "Create login"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the client along with their vehicles, quotations, documents, communications and service requests. Policies, invoices and claims will block the delete — cancel or reassign them first. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={async (e) => {
                e.preventDefault();
                setDeleteBusy(true);
                try {
                  await deleteFn({ data: { clientId: id } });
                  toast.success("Client deleted");
                  setDeleteOpen(false);
                  qc.invalidateQueries({ queryKey: ["clients"] });
                  navigate({ to: "/clients" });
                } catch (err: any) {
                  toast.error(err?.message ?? "Could not delete client");
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >{deleteBusy ? "Deleting…" : "Delete client"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}