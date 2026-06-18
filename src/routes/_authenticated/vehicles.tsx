import { createFileRoute, Link } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Plus, Search, Pencil } from "lucide-react";
import { VehicleFormDialog } from "@/components/vehicles/vehicle-form-dialog";

export const Route = createFileRoute("/_authenticated/vehicles")({ beforeLoad: requireRole(["admin", "manager", "agent"]), component: VehiclesList });

function VehiclesList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles", search],
    queryFn: async () => {
      let q = supabase
        .from("vehicles")
        .select("id, registration_no, make, model, year, usage_type, inspection_due, active, client_id, clients(full_name, company_name, client_type)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (search) q = q.or(`registration_no.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Vehicles" subtitle="Registered vehicles across all clients."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> New vehicle</Button>} />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search registration, make, model…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Registration</th>
                <th className="px-4 py-3 font-medium">Vehicle</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Inspection</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && vehicles?.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No vehicles yet.</td></tr>}
              {vehicles?.map((v: any) => {
                const cl = v.clients;
                const clientName = cl ? (cl.client_type === "corporate" ? cl.company_name ?? cl.full_name : cl.full_name) : "—";
                const overdue = v.inspection_due && new Date(v.inspection_due) < new Date();
                return (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono font-medium">{v.registration_no}</td>
                    <td className="px-4 py-3">{[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-4 py-3">
                      <Link to="/clients/$id" params={{ id: v.client_id }} className="hover:underline">{clientName}</Link>
                    </td>
                    <td className="px-4 py-3"><Badge variant="secondary">{v.usage_type}</Badge></td>
                    <td className="px-4 py-3">
                      {v.inspection_due
                        ? <span className={overdue ? "text-destructive font-medium" : ""}>{v.inspection_due}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEdit(v); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <VehicleFormDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={() => qc.invalidateQueries({ queryKey: ["vehicles"] })} />
    </div>
  );
}