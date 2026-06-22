import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Upload, MessageSquarePlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog, CredentialsDialog } from "@/components/clients/client-form-dialog";
import { ClientDocuments } from "@/components/clients/client-documents";
import { ClientCommunications } from "@/components/clients/client-communications";
import { ClientKycPanel } from "@/components/clients/client-kyc-panel";
import { useServerFn } from "@tanstack/react-start";
import { createClientPortalAccount } from "@/lib/admin-users.functions";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients/$id")({ beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = useParams({ from: "/_authenticated/clients/$id" });
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string | null; linked: boolean } | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const portalFn = useServerFn(createClientPortalAccount);

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

  const generatePortal = async () => {
    setGenBusy(true);
    try {
      const res = await portalFn({ data: { client_id: id } });
      setCreds(res);
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
            {!client.auth_user_id && (
              <Button
                variant="outline"
                onClick={() => {
                  if (!client.email) {
                    toast.error("Add an email to this client first, then generate the portal login.");
                    return;
                  }
                  generatePortal();
                }}
                disabled={genBusy}
                title={!client.email ? "Add an email first" : "Create a portal account for this client"}
              >
                <KeyRound className="h-4 w-4 mr-1" /> {genBusy ? "Creating…" : "Generate portal login"}
              </Button>
            )}
            <Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
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
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
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