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
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

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

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <PageHeader title="Agency settings" subtitle="Your brand, contact details, and underwriter list." />

      <Card>
        <CardHeader>
          <CardTitle>Brand & details</CardTitle>
          <CardDescription>These appear on quotes, invoices, receipts, and the client portal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Agency name</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact email</Label><Input value={form.contact_email ?? ""} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Contact phone</Label><Input value={form.contact_phone ?? ""} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Textarea value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Country</Label><Input value={form.country ?? ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          </div>
          <div><Label>Tagline</Label><Input value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="www.youragency.co.ke" /></div>
          <div>
            <Label>Logo</Label>
            {form.logo_url && <div className="mb-2"><img src={form.logo_url} alt="Logo" className="h-16 object-contain" /></div>}
            <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Primary</Label><Input type="color" value={form.brand_primary ?? "#dc2626"} onChange={(e) => setForm({ ...form, brand_primary: e.target.value })} /></div>
            <div><Label>Secondary</Label><Input type="color" value={form.brand_secondary ?? "#0f172a"} onChange={(e) => setForm({ ...form, brand_secondary: e.target.value })} /></div>
            <div><Label>Accent</Label><Input type="color" value={form.brand_accent ?? "#f59e0b"} onChange={(e) => setForm({ ...form, brand_accent: e.target.value })} /></div>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Underwriters</CardTitle>
        </CardHeader>
        <CardContent />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment details</CardTitle>
          <CardDescription>Printed on your quotations and invoices. Leave a field blank to hide that line.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>M-Pesa till number</Label><Input value={form.mpesa_till ?? ""} onChange={(e) => setForm({ ...form, mpesa_till: e.target.value })} /></div>
            <div><Label>Paybill number</Label><Input value={form.mpesa_paybill ?? ""} onChange={(e) => setForm({ ...form, mpesa_paybill: e.target.value })} /></div>
          </div>
          <div><Label>Paybill account number</Label><Input value={form.paybill_account ?? ""} onChange={(e) => setForm({ ...form, paybill_account: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bank name</Label><Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div><Label>Bank branch</Label><Input value={form.bank_branch ?? ""} onChange={(e) => setForm({ ...form, bank_branch: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Account name</Label><Input value={form.bank_account_name ?? ""} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} /></div>
            <div><Label>Account number</Label><Input value={form.bank_account_no ?? ""} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} /></div>
          </div>
          <div><Label>Document footer note (optional)</Label><Textarea value={form.doc_footer_note ?? ""} onChange={(e) => setForm({ ...form, doc_footer_note: e.target.value })} /></div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save payment details"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company stamp</CardTitle>
          <CardDescription>Used on quotations and receipts. Only your agency's stamp is applied to your documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.stamp_url && <img src={form.stamp_url} alt="Company stamp" className="h-24 object-contain" />}
          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadStamp(f); }} />
          <p className="text-xs text-muted-foreground">Transparent PNG works best.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Underwriters</CardTitle>
          <CardDescription>Which insurance companies your agency works with.</CardDescription>
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
    </div>
  );
}