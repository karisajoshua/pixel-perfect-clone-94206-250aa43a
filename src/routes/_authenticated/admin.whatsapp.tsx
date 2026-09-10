import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { requireRole } from "@/lib/roles";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  getWhatsAppOverview, saveWhatsAppChannel, testWhatsAppConnection,
  saveWhatsAppTemplate, cloneWhatsAppTemplate, setWhatsAppTemplateStatus, deleteWhatsAppTemplate,
  sendWhatsAppTest, setWhatsAppConsent,
} from "@/lib/whatsapp/whatsapp.functions";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  beforeLoad: requireRole(["admin", "manager"]),
  head: () => ({
    meta: [
      { title: "WhatsApp messaging — Admin" },
      { name: "description", content: "Connect your WhatsApp business number, manage message templates, consent and test sends." },
      { property: "og:title", content: "WhatsApp messaging — Admin" },
      { property: "og:description", content: "Connect your WhatsApp business number, manage message templates, consent and test sends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsAppAdmin,
});

const statusTone = (s?: string | null) =>
  s === "connected" || s === "approved" || s === "delivered" || s === "read"
    ? "default"
    : s === "error" || s === "failed" || s === "rejected"
      ? "destructive"
      : "secondary";

function WhatsAppAdmin() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getWhatsAppOverview);
  const overview = useQuery({ queryKey: ["whatsapp", "overview"], queryFn: () => overviewFn(), refetchInterval: 20_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["whatsapp"] });

  const data = overview.data;
  const channel = data?.channel as any;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="WhatsApp messaging"
        subtitle="Connect your business number, manage approved templates, consent and controlled test sends."
        actions={
          <Badge variant={statusTone(channel?.status)} className="text-sm">
            {channel ? `${channel.status}${channel.mode === "test" ? " · test mode" : ""}` : "not configured"}
          </Badge>
        }
      />

      <ChannelCard channel={channel} webhookUrl={data?.webhook_url ?? ""} onSaved={invalidate} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TestSendCard channel={channel} templates={(data?.templates ?? []) as any[]} onSent={invalidate} />
        <ConsentCard consent={data?.consent} usage={data?.usage} onSaved={invalidate} />
      </div>

      <TemplatesCard templates={(data?.templates ?? []) as any[]} onChanged={invalidate} />
      <ActivityCard messages={(data?.messages ?? []) as any[]} conversations={(data?.conversations ?? []) as any[]} />
    </div>
  );
}

/* ------------------------------- channel ------------------------------- */

function ChannelCard({ channel, webhookUrl, onSaved }: { channel: any; webhookUrl: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    waba_id: "", phone_number_id: "", display_phone_number: "", display_name: "",
    credentials_ref: "WHATSAPP_ACCESS_TOKEN", mode: "test" as "test" | "production",
    test_recipients: "", daily_message_limit: 1000, is_active: false,
  });

  useEffect(() => {
    if (!channel) return;
    setForm({
      waba_id: channel.waba_id ?? "",
      phone_number_id: channel.phone_number_id ?? "",
      display_phone_number: channel.display_phone_number ?? "",
      display_name: channel.display_name ?? "",
      credentials_ref: channel.credentials_ref ?? "WHATSAPP_ACCESS_TOKEN",
      mode: channel.mode ?? "test",
      test_recipients: (channel.test_recipients ?? []).join(", "),
      daily_message_limit: channel.daily_message_limit ?? 1000,
      is_active: !!channel.is_active,
    });
  }, [channel?.id, channel?.updated_at]);

  const saveFn = useServerFn(saveWhatsAppChannel);
  const testFn = useServerFn(testWhatsAppConnection);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          waba_id: form.waba_id || null,
          phone_number_id: form.phone_number_id || null,
          display_phone_number: form.display_phone_number || null,
          display_name: form.display_name || null,
          credentials_ref: form.credentials_ref || null,
          mode: form.mode,
          test_recipients: form.test_recipients.split(",").map((s) => s.trim()).filter(Boolean),
          daily_message_limit: Number(form.daily_message_limit) || 1000,
          is_active: form.is_active,
        },
      }),
    onSuccess: () => { toast.success("WhatsApp sender saved"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) => { r.ok ? toast.success("Connection working") : toast.error(r.detail ?? "Connection failed"); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Connection check failed"),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-medium">Business number</h2>
          <p className="text-sm text-muted-foreground">Details come from your WhatsApp Business account. The access token is kept in the secure store, never here.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !channel}>Check connection</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Business account ID" value={form.waba_id} onChange={(v) => setForm({ ...form, waba_id: v })} />
        <Field label="Phone number ID" value={form.phone_number_id} onChange={(v) => setForm({ ...form, phone_number_id: v })} />
        <Field label="Number shown to customers" value={form.display_phone_number} onChange={(v) => setForm({ ...form, display_phone_number: v })} placeholder="+254700000000" />
        <Field label="Display name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} />
        <Field label="Secret name holding the token" value={form.credentials_ref} onChange={(v) => setForm({ ...form, credentials_ref: v })} placeholder="WHATSAPP_ACCESS_TOKEN" />
        <Field label="Daily send limit" value={String(form.daily_message_limit)} onChange={(v) => setForm({ ...form, daily_message_limit: Number(v) || 0 })} />
        <Field
          label="Test recipients (comma separated)"
          value={form.test_recipients}
          onChange={(v) => setForm({ ...form, test_recipients: v })}
          placeholder="0712345678, 0798765432"
        />
        <div className="space-y-2">
          <Label>Mode</Label>
          <div className="flex items-center gap-3 h-9">
            <Switch checked={form.mode === "production"} onCheckedChange={(c) => setForm({ ...form, mode: c ? "production" : "test" })} />
            <span className="text-sm">{form.mode === "production" ? "Live — real customers" : "Test — only listed recipients"}</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Sending enabled</Label>
          <div className="flex items-center gap-3 h-9">
            <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <span className="text-sm">{form.is_active ? "On" : "Off"}</span>
          </div>
        </div>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
        <div className="font-medium">Webhook address for Meta</div>
        <code className="break-all text-xs">{origin}{webhookUrl}</code>
        <div className="text-muted-foreground text-xs">
          Verify token and app secret are stored securely as WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET.
        </div>
        {channel?.last_error && <div className="text-destructive text-xs">Last error: {channel.last_error}</div>}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ------------------------------ test send ------------------------------ */

function TestSendCard({ channel, templates, onSent }: { channel: any; templates: any[]; onSent: () => void }) {
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("");
  const [message, setMessage] = useState("Hello from your agency — this is a test message.");
  const [variables, setVariables] = useState("");
  const sendFn = useServerFn(sendWhatsAppTest);
  const [result, setResult] = useState<any>(null);

  const run = (mode: "dry_run" | "live_test") =>
    sendFn({
      data: {
        to, mode,
        template: template || undefined,
        language: "en",
        variables: Object.fromEntries(
          variables.split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]),
        ),
        message: template ? undefined : message,
      },
    });

  const send = useMutation({
    mutationFn: (mode: "dry_run" | "live_test") => run(mode),
    onSuccess: (r: any) => {
      setResult(r);
      r.ok ? toast.success(r.dry_run ? "Dry run recorded — nothing sent" : `Send ${r.status}`) : toast.error(r.error ?? "Send blocked");
      onSent();
    },
    onError: (e: any) => toast.error(e?.message ?? "Send failed"),
  });

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="font-medium">Controlled test send</h2>
        <p className="text-sm text-muted-foreground">Dry run writes a record without contacting WhatsApp. Live test only reaches listed test recipients.</p>
      </div>
      <Field label="Send to" value={to} onChange={setTo} placeholder="0712345678" />
      <div className="space-y-2">
        <Label>Template (leave blank for a plain session message)</Label>
        <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">— none —</option>
          {templates.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.owner_scope}, {t.status})</option>)}
        </select>
      </div>
      {template
        ? <Field label="Variables (name=value, comma separated)" value={variables} onChange={setVariables} placeholder="client_name=Jane, days=14" />
        : <div className="space-y-2"><Label>Message</Label><Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></div>}
      <div className="flex gap-2">
        <Button variant="outline" disabled={!to || send.isPending} onClick={() => send.mutate("dry_run")}>Dry run</Button>
        <Button disabled={!to || send.isPending || !channel?.is_active} onClick={() => send.mutate("live_test")}>Live test</Button>
      </div>
      {result && (
        <pre className="rounded-md bg-muted/50 p-3 text-xs overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
      )}
    </Card>
  );
}

/* -------------------------------- consent ------------------------------- */

function ConsentCard({ consent, usage, onSaved }: { consent: any; usage: any; onSaved: () => void }) {
  const [phone, setPhone] = useState("");
  const setFn = useServerFn(setWhatsAppConsent);
  const save = useMutation({
    mutationFn: (status: "opted_in" | "opted_out") => setFn({ data: { phone, status, source: "admin" } }),
    onSuccess: () => { toast.success("Consent updated"); setPhone(""); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update consent"),
  });

  return (
    <Card className="p-4 md:p-6 space-y-4">
      <div>
        <h2 className="font-medium">Consent &amp; usage</h2>
        <p className="text-sm text-muted-foreground">Customers who reply STOP are opted out automatically.</p>
      </div>
      <div className="flex gap-6 text-sm">
        <div><div className="text-2xl font-semibold">{consent?.opted_in ?? 0}</div><div className="text-muted-foreground">opted in</div></div>
        <div><div className="text-2xl font-semibold">{consent?.opted_out ?? 0}</div><div className="text-muted-foreground">opted out</div></div>
        <div><div className="text-2xl font-semibold">{usage?.sent ?? 0}</div><div className="text-muted-foreground">sent today{usage?.limit ? ` / ${usage.limit}` : ""}</div></div>
      </div>
      <Field label="Phone number" value={phone} onChange={setPhone} placeholder="0712345678" />
      <div className="flex gap-2">
        <Button variant="outline" disabled={!phone || save.isPending} onClick={() => save.mutate("opted_in")}>Opt in</Button>
        <Button variant="outline" disabled={!phone || save.isPending} onClick={() => save.mutate("opted_out")}>Opt out</Button>
      </div>
    </Card>
  );
}

/* ------------------------------- templates ------------------------------ */

const blankTemplate = {
  id: undefined as string | undefined,
  name: "", language: "en", category: "UTILITY" as const,
  header: "", body: "", footer: "", variables: "", provider_template_name: "",
};

function TemplatesCard({ templates, onChanged }: { templates: any[]; onChanged: () => void }) {
  const [draft, setDraft] = useState<any>(blankTemplate);
  const saveFn = useServerFn(saveWhatsAppTemplate);
  const cloneFn = useServerFn(cloneWhatsAppTemplate);
  const statusFn = useServerFn(setWhatsAppTemplateStatus);
  const delFn = useServerFn(deleteWhatsAppTemplate);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: draft.id,
          name: draft.name, language: draft.language, category: draft.category,
          header: draft.header || null, body: draft.body, footer: draft.footer || null,
          provider_template_name: draft.provider_template_name || null,
          variables: String(draft.variables).split(",").map((s: string) => s.trim()).filter(Boolean),
        },
      }),
    onSuccess: () => { toast.success("Template saved"); setDraft(blankTemplate); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Could not save template"),
  });
  const mut = (fn: any, label: string) =>
    useMutation({
      mutationFn: (vars: any) => fn({ data: vars }),
      onSuccess: () => { toast.success(label); onChanged(); },
      onError: (e: any) => toast.error(e?.message ?? `${label} failed`),
    });
  const clone = mut(cloneFn, "Copied to your agency");
  const status = mut(statusFn, "Status updated");
  const remove = mut(delFn, "Template removed");

  return (
    <Card className="p-4 md:p-6 space-y-5">
      <div>
        <h2 className="font-medium">Message templates</h2>
        <p className="text-sm text-muted-foreground">Ready-made templates are shared with every agency; copy one to edit it. WhatsApp must approve a template before it can reach customers outside a live chat.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Scope</th><th className="px-3 py-2">Language</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {templates.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No templates yet.</td></tr>}
            {templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2">{t.owner_scope}</td>
                <td className="px-3 py-2">{t.language}</td>
                <td className="px-3 py-2"><Badge variant={statusTone(t.status)}>{t.status}</Badge></td>
                <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                  {t.owner_scope === "platform" ? (
                    <Button size="sm" variant="outline" onClick={() => clone.mutate({ id: t.id })}>Copy</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setDraft({
                        id: t.id, name: t.name, language: t.language, category: t.category,
                        header: t.header ?? "", body: t.body, footer: t.footer ?? "",
                        variables: (t.variables ?? []).join(", "), provider_template_name: t.provider_template_name ?? "",
                      })}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => status.mutate({ id: t.id, status: t.status === "approved" ? "disabled" : "approved" })}>
                        {t.status === "approved" ? "Disable" : "Mark approved"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate({ id: t.id })}>Delete</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-3 border-t pt-4">
        <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="renewal_reminder" />
        <Field label="Language" value={draft.language} onChange={(v) => setDraft({ ...draft, language: v })} />
        <Field label="Name at WhatsApp (if different)" value={draft.provider_template_name} onChange={(v) => setDraft({ ...draft, provider_template_name: v })} />
        <Field label="Header" value={draft.header} onChange={(v) => setDraft({ ...draft, header: v })} />
        <Field label="Footer" value={draft.footer} onChange={(v) => setDraft({ ...draft, footer: v })} />
        <Field label="Placeholders (comma separated)" value={draft.variables} onChange={(v) => setDraft({ ...draft, variables: v })} placeholder="client_name, days" />
        <div className="md:col-span-3 space-y-2">
          <Label>Message body — use {"{{client_name}}"} style placeholders</Label>
          <Textarea rows={3} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </div>
        <div className="md:col-span-3 flex gap-2">
          <Button onClick={() => save.mutate()} disabled={!draft.name || !draft.body || save.isPending}>{draft.id ? "Update template" : "Add template"}</Button>
          {draft.id && <Button variant="ghost" onClick={() => setDraft(blankTemplate)}>Cancel</Button>}
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------- activity ------------------------------- */

function ActivityCard({ messages, conversations }: { messages: any[]; conversations: any[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Recent messages</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Direction</th><th className="px-3 py-2">To / From</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>
            {messages.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nothing yet.</td></tr>}
            {messages.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">{format(new Date(m.created_at), "dd MMM HH:mm")}</td>
                <td className="px-3 py-2">{m.direction}</td>
                <td className="px-3 py-2">{m.to_phone ?? m.from_phone ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={statusTone(m.status)}>{m.status}{m.dry_run ? " (dry run)" : ""}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">Conversations</div>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Last message</th></tr></thead>
          <tbody>
            {conversations.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No conversations yet.</td></tr>}
            {conversations.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-3 py-2">{c.contact_name ?? c.contact_phone}</td>
                <td className="px-3 py-2"><Badge variant={statusTone(c.status)}>{c.status}</Badge></td>
                <td className="px-3 py-2 whitespace-nowrap">{c.last_message_at ? format(new Date(c.last_message_at), "dd MMM HH:mm") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
