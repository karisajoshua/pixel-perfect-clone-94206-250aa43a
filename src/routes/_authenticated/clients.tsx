import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Plus, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientExportDialog } from "@/components/clients/client-export-dialog";
import { useMyRoles } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/clients")({ beforeLoad: requireRole(["admin", "manager", "agent"]),
  component: ClientsLayout,
});

function ClientsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // When a child route is active, render only the child (detail view)
  if (pathname !== "/clients") return <Outlet />;
  return <ClientsList />;
}

function ClientsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const { data: roles } = useMyRoles();
  const canExport = (roles ?? []).some((r) => r === "admin" || r === "manager");

  useEffect(() => { setPage(1); }, [search]);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search, page],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("clients")
        .select("id, full_name, company_name, client_type, email, phone, kyc_status, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (search) q = q.or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const rows = clients?.rows ?? [];
  const total = clients?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Clients"
        subtitle="All policyholders managed by the agency."
        actions={
          <div className="flex gap-2">
            {canExport && (
              <Button variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            )}
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New client</Button>
          </div>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">KYC</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">No clients yet. Add the first one.</td></tr>}
              {rows.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.client_type === "corporate" ? c.company_name ?? c.full_name : c.full_name}</div>
                    {c.client_type === "corporate" && c.full_name && <div className="text-xs text-muted-foreground">Contact: {c.full_name}</div>}
                  </td>
                  <td className="px-4 py-3"><Badge variant="secondary">{c.client_type}</Badge></td>
                  <td className="px-4 py-3">
                    <div>{c.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3"><KycBadge status={c.kyc_status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm"><Link to="/clients/$id" params={{ id: c.id }}>Open</Link></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <div className="text-muted-foreground">Showing {showingFrom}–{showingTo} of {total}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ClientFormDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["clients"] })} />
      <ClientExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}

function KycBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-900 border-yellow-200",
    verified: "bg-green-100 text-green-900 border-green-200",
    rejected: "bg-red-100 text-red-900 border-red-200",
    expired: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${map[status] ?? ""}`}>{status}</span>;
}