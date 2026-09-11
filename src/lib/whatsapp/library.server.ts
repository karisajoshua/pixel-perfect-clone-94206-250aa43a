/**
 * Keeps the shared (platform) WhatsApp template library in the database in
 * sync with the definitions in `template-library.ts`. Agency copies are never
 * touched.
 */
import { LIBRARY_TEMPLATES, extractVariables } from "./template-library";

type Admin = any;

export async function syncPlatformTemplates(admin: Admin) {
  const { data: existing, error } = await admin
    .from("whatsapp_templates")
    .select("id, name, language, body, display_name, library_group, description, category")
    .is("tenant_id", null);
  if (error) throw new Error(error.message);

  const byName = new Map((existing ?? []).map((r: any) => [`${r.name}:${r.language}`, r]));
  const rows = LIBRARY_TEMPLATES.map((t) => ({
    tenant_id: null,
    owner_scope: "platform",
    name: t.name,
    language: "en",
    category: t.category,
    body: t.body,
    variables: extractVariables(t.body),
    display_name: t.display_name,
    library_group: t.group,
    description: t.description,
    status: "approved",
    meta_status: "approved",
    is_active: true,
  }));

  const stale = rows.filter((r) => {
    const cur: any = byName.get(`${r.name}:en`);
    return (
      !cur ||
      cur.body !== r.body ||
      cur.display_name !== r.display_name ||
      cur.library_group !== r.library_group ||
      cur.description !== r.description ||
      cur.category !== r.category
    );
  });
  if (!stale.length) return { synced: 0 };

  for (const row of stale) {
    const cur: any = byName.get(`${row.name}:en`);
    if (cur) {
      const { id, ...rest } = row as any;
      await admin.from("whatsapp_templates").update(rest).eq("id", cur.id);
    } else {
      await admin.from("whatsapp_templates").insert(row);
    }
  }
  return { synced: stale.length };
}

/**
 * Counts how many published/draft automations reference each template name,
 * so the library can show usage and block unsafe deletions.
 */
export async function templateUsage(admin: Admin, tenantId: string) {
  const { data, error } = await admin
    .from("workflows")
    .select("id, name, status, current_version_id, workflow_versions!workflows_current_version_fk(graph)")
    .eq("tenant_id", tenantId);
  if (error) return {} as Record<string, { total: number; active: number; names: string[] }>;

  const usage: Record<string, { total: number; active: number; names: string[] }> = {};
  for (const wf of data ?? []) {
    const version: any = Array.isArray(wf.workflow_versions) ? wf.workflow_versions[0] : wf.workflow_versions;
    const nodes = (version?.graph as any)?.nodes ?? [];
    const used = new Set<string>();
    for (const n of nodes) {
      if (n?.type === "send-whatsapp" && n?.config?.template) used.add(String(n.config.template));
    }
    for (const name of used) {
      const entry = (usage[name] ??= { total: 0, active: 0, names: [] });
      entry.total += 1;
      if (wf.status === "active") entry.active += 1;
      entry.names.push(wf.name);
    }
  }
  return usage;
}
