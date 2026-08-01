import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMyTenant, getMyTenantInsurers, setMyTenantInsurers, setTenantLogo, setTenantStamp, updateMyTenant } from "@/lib/tenants.functions";
import { resetBrandCache } from "@/lib/tenant-brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

export const Route = createFileRoute("/_authenticated/admin/tenant")({
  head: () => ({ meta: [{ title: "Agency settings" }] }),
  component: TenantSettings,
});

function TenantSettings() {
  const fetchTenant = useServerFn(getMyTenant);
  const updateFn = useServerFn(updateMyTenant);
  const fetchInsurers = useServerFn(getMyTenantInsurers);
  const saveInsurers = useServerFn(setMyTenantInsurers);
  const setLogoFn = useServerFn(setTenantLogo);
  const setStampFn = useServerFn(setTenantStamp);
  const qc = useQueryClient();

  const { data: my } = useQuery({ queryKey: ["my-tenant"], queryFn: () => fetchTenant() });
  const { data: insurers } = useQuery({ queryKey: ["my-tenant-insurers"], queryFn: () => fetchInsurers() });

  const [form, setForm] = useState<any>({});
  useEffect(() => { if (my?.tenant) setForm(my.tenant); }, [my]);

  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (insurers) setSelected(new Set(insurers.filter((i: any) => i.enabled).map((i: any) => i.id)));
  }, [insurers]);

  if (!my?.tenant) return <div className="p-8">Loading…</div>;

  const save = async () => {
    setSaving(true);
    try {
      await updateFn({ data: {
        name: form.name, contact_email: form.contact_email, contact_phone: form.contact_phone,
        address: form.address, city: form.city, country: form.country, tagline: form.tagline,
        brand_primary: form.brand_primary, brand_secondary: form.brand_secondary, brand_accent: form.brand_accent,
        website: form.website ?? null,
        mpesa_till: form.mpesa_till ?? null, mpesa_paybill: form.mpesa_paybill ?? null, paybill_account: form.paybill_account ?? null,
        bank_name: form.bank_name ?? null, bank_branch: form.bank_branch ?? null,
        bank_account_name: form.bank_account_name ?? null, bank_account_no: form.bank_account_no ?? null,
        doc_footer_note: form.doc_footer_note ?? null,
      }});
      resetBrandCache();
      toast.success("Agency updated");
      qc.invalidateQueries({ queryKey: ["my-tenant"] });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    const tid = my.tenant!.id;
    const path = `${tid}/logo-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("tenant-brand").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    try {
      const { url } = await setLogoFn({ data: { storage_path: path } });
      setForm((f: any) => ({ ...f, logo_url: url }));
      resetBrandCache();
      toast.success("Logo updated");
      qc.invalidateQueries({ queryKey: ["my-tenant"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const uploadStamp = async (file: File) => {
    const tid = my.tenant!.id;
    const path = `${tid}/stamp-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("tenant-brand").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    try {
      const { url } = await setStampFn({ data: { storage_path: path } });
      setForm((f: any) => ({ ...f, stamp_url: url }));
      resetBrandCache();
      toast.success("Company stamp updated");
      qc.invalidateQueries({ queryKey: ["my-tenant"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const saveInsurerPicks = async () => {
    try {
      await saveInsurers({ data: { insurer_ids: [...selected] } });
      toast.success("Underwriters saved");
      qc.invalidateQueries({ queryKey: ["my-tenant-insurers"] });
      qc.invalidateQueries({ queryKey: ["my-insurers"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const paymentLines: string[] = [
    form.mpesa_till ? `Safaricom Till: ${form.mpesa_till}` : null,
    form.mpesa_paybill ? `Paybill: ${form.mpesa_paybill}` : null,
    form.paybill_account ? `Account: ${form.paybill_account}` : null,
    form.bank_name ? `Bank: ${form.bank_name}${form.bank_branch ? ` — ${form.bank_branch}` : ""}` : null,
    form.bank_account_name ? `Account name: ${form.bank_account_name}` : null,
    form.bank_account_no ? `Account no: ${form.bank_account_no}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <PageHeader
        title="Agency settings"
        subtitle="Everything here belongs to your agency only — it never affects any other agency."
      />

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="documents">Documents &amp; payments</TabsTrigger>
          <TabsTrigger value="underwriters">Underwriters</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Agency identity</CardTitle>
              <CardDescription>Used in the header and footer of every quotation, invoice and receipt, and on your client portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Agency name</Label>
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Hint>Printed at the top of every document and shown in the sidebar.</Hint>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Contact email</Label>
                  <Input value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                  <Hint>Document footer and client correspondence.</Hint>
                </div>
                <div>
                  <Label>Contact phone</Label>
                  <Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                  <Hint>Document footer.</Hint>
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                <Hint>Combined with city and country in the document footer.</Hint>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              </div>
              <div>
                <Label>Tagline</Label>
                <Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
                <Hint>Shown under your agency name on quotations.</Hint>
              </div>
              <div>
                <Label>Website</Label>
                <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.youragency.co.ke" />
                <Hint>Document footer. Left out if blank.</Hint>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save identity"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Logo &amp; colours</CardTitle>
              <CardDescription>Your logo prints on documents; your colours theme your own workspace only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Logo</Label>
                {form.logo_url && <div className="my-2"><img src={form.logo_url} alt="Agency logo" className="h-16 object-contain" /></div>}
                <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <Hint>Header of quotations, invoices and receipts, plus the client portal. If no logo is uploaded, your agency name is printed instead.</Hint>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Primary</Label><Input type="color" value={form.brand_primary ?? "#dc2626"} onChange={(e) => setForm({ ...form, brand_primary: e.target.value })} /></div>
                <div><Label>Secondary</Label><Input type="color" value={form.brand_secondary ?? "#0f172a"} onChange={(e) => setForm({ ...form, brand_secondary: e.target.value })} /></div>
                <div><Label>Accent</Label><Input type="color" value={form.brand_accent ?? "#f59e0b"} onChange={(e) => setForm({ ...form, brand_accent: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-8 w-16 rounded border" style={{ background: form.brand_primary ?? "#dc2626" }} />
                <span className="h-8 w-16 rounded border" style={{ background: form.brand_secondary ?? "#0f172a" }} />
                <span className="h-8 w-16 rounded border" style={{ background: form.brand_accent ?? "#f59e0b" }} />
                <Hint>Primary = buttons and links, Secondary = sidebar, Accent = highlights.</Hint>
              </div>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save branding"}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment details</CardTitle>
              <CardDescription>These print inside the "Payment details" box on your quotations and invoices. Any field left blank is simply not printed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>M-Pesa till number</Label>
                  <Input value={form.mpesa_till ?? ""} onChange={(e) => setForm({ ...form, mpesa_till: e.target.value })} />
                  <Hint>Prints as "Safaricom Till: …".</Hint>
                </div>
                <div>
                  <Label>Paybill number</Label>
                  <Input value={form.mpesa_paybill ?? ""} onChange={(e) => setForm({ ...form, mpesa_paybill: e.target.value })} />
                  <Hint>Prints as "Paybill: …".</Hint>
                </div>
              </div>
              <div>
                <Label>Paybill account number</Label>
                <Input value={form.paybill_account ?? ""} onChange={(e) => setForm({ ...form, paybill_account: e.target.value })} />
                <Hint>The account clients enter when paying to your paybill.</Hint>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Bank name</Label><Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
                <div><Label>Bank branch</Label><Input value={form.bank_branch ?? ""} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>Account name</Label><Input value={form.bank_account_name ?? ""} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} /></div>
                <div><Label>Account number</Label><Input value={form.bank_account_no ?? ""} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} /></div>
              </div>
              <div>
                <Label>Document footer note (optional)</Label>
                <Textarea value={form.doc_footer_note ?? ""} onChange={(e) => setForm({ ...form, doc_footer_note: e.target.value })} />
                <Hint>Small print at the bottom of quotations and invoices, e.g. payment terms.</Hint>
              </div>

              <div className="rounded-md border bg-muted/40 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview — how this prints</div>
                {paymentLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment details yet — the payment box will be left off your documents entirely.</p>
                ) : (
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">Payment details</div>
                    {paymentLines.map((l) => <div key={l}>{l}</div>)}
                  </div>
                )}
                {form.doc_footer_note ? (
                  <p className="mt-3 text-xs text-muted-foreground italic">{form.doc_footer_note}</p>
                ) : null}
              </div>

              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save payment details"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company stamp</CardTitle>
              <CardDescription>Stamped on your quotations and receipts. Only your agency's stamp is used on your documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.stamp_url && <img src={form.stamp_url} alt="Company stamp" className="h-24 object-contain" />}
              <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStamp(f); }} />
              <Hint>Transparent PNG works best. Saved as soon as you pick a file. If no stamp is uploaded, the stamp area is left blank.</Hint>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="underwriters" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Underwriters</CardTitle>
              <CardDescription>Which insurance companies your agency works with. These are the options staff can pick on quotations and policies.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(insurers ?? []).map((i: any) => (
                  <label key={i.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(i.id)}
                      onCheckedChange={(v) => {
                        const n = new Set(selected);
                        v ? n.add(i.id) : n.delete(i.id);
                        setSelected(n);
                      }}
                    />
                    <span className="text-sm">{i.name}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{selected.size} selected</p>
                <Button onClick={saveInsurerPicks}>Save underwriters</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}