import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: UsersAdmin });

const ROLES = ["admin", "manager", "agent", "viewer", "client"] as const;

function UsersAdmin() {
  const qc = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*, branches(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await supabase.from("branches").select("id, name").order("name")).data ?? [],
  });

  const setRole = async (userId: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const setBranch = async (userId: string, branchId: string) => {
    const { error } = await supabase.from("profiles").update({ branch_id: branchId || null }).eq("id", userId);
    if (error) return toast.error(error.message);
    toast.success("Branch updated");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Users & Roles" subtitle="Assign roles and branches to staff. Invite new users from the auth sign-up flow." />
      <Card>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th></tr>
          </thead>
          <tbody>
            {profiles?.map((p) => {
              const userRoles = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
              const current = userRoles[0] ?? "agent";
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{p.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{p.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Select value={current} onValueChange={(v) => setRole(p.id, v)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={p.branch_id ?? ""} onValueChange={(v) => setBranch(p.id, v)}>
                      <SelectTrigger className="w-48"><SelectValue placeholder="No branch" /></SelectTrigger>
                      <SelectContent>{(branches ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}