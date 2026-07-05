import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createTenant, getMyTenant, setTenantLogo } from "@/lib/tenants.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Set up your agency" }] }),
  component: OnboardingWizard,
});

type FormState = {
  name: string; contact_email: string; contact_phone: string; address: string; city: string; country: string;
  tagline: string; brand_primary: string; brand_secondary: string; brand_accent: string;
  logo_url: string | null;
  insurer_ids: string[];
  branch_name: string; branch_address: string; branch_phone: string;
};

const INITIAL: FormState = {
  name: "", contact_email: "", contact_phone: "", address: "", city: "", country: "Kenya",
  tagline: "", brand_primary: "#dc2626", brand_secondary: "#0f172a", brand_accent: "#f59e0b",
  logo_url: null, insurer_ids: [],
  branch_name: "Head Office", branch_address: "", branch_phone: "",
};

function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fetchMy = useServerFn(getMyTenant);
  const fetchLogo = useServerFn(setTenantLogo);
  const submitFn = useServerFn(createTenant);

  // Redirect out if already onboarded
  useEffect(() => {
    fetchMy().then((r) => {
      if (r.tenant) navigate({ to: "/dashboard", replace: true });
    }).catch(() => {});
  }, [fetchMy, navigate]);

  const { data: insurers } = useQuery({
    queryKey: ["all-insurers"],
    queryFn: async () => {
      const { data } = await supabase.from("insurers").select("id, name, logo_url").order("name");
      return data ?? [];
    },
  });

  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      // Use a temp tenant id namespace based on user id (bucket policy scopes to tenant id;
      // for onboarding we upload after tenant exists — see step 5 flow).
      // Actually: we need the tenant to exist first. So do a two-phase upload.
      toast.info("Please finish the wizard; logo will upload at the last step.");
    } finally {
      setUploading(false);
    }
    void file;
  };

  const finish = async () => {
    if (!form.name.trim() || !form.branch_name.trim()) return toast.error("Agency name and branch name are required");
    setSaving(true);
    try {
      const { tenant } = await submitFn({ data: {
        name: form.name, contact_email: form.contact_email || null, contact_phone: form.contact_phone || null,
        address: form.address || null, city: form.city || null, country: form.country || "Kenya",
        tagline: form.tagline || null,
        brand_primary: form.brand_primary, brand_secondary: form.brand_secondary, brand_accent: form.brand_accent,
        logo_url: null,
        insurer_ids: form.insurer_ids,
        branch_name: form.branch_name, branch_address: form.branch_address || null, branch_phone: form.branch_phone || null,
      } });

      // Upload logo if selected during step 2 (stored in `pendingLogo`)
      const pending = (window as any).__pendingLogo as File | undefined;
      if (pending && tenant?.id) {
        const path = `${tenant.id}/logo-${Date.now()}-${pending.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("tenant-brand").upload(path, pending, { upsert: true });
        if (!upErr) {
          await fetchLogo({ data: { storage_path: path } });
        }
        delete (window as any).__pendingLogo;
      }

      toast.success("Agency created");
      navigate({ to: "/dashboard", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleInsurer = (id: string) => {
    update({ insurer_ids: form.insurer_ids.includes(id) ? form.insurer_ids.filter((x) => x !== id) : [...form.insurer_ids, id] });
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Set up your agency</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 4</p>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4].map((s) => (
              <div key={s} className={`h-1.5 w-10 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Agency details</CardTitle>
                <CardDescription>Tell us about your agency.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Agency name *</Label><Input value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Acme Insurance Agency" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => update({ contact_email: e.target.value })} /></div>
                  <div><Label>Contact phone</Label><Input value={form.contact_phone} onChange={(e) => update({ contact_phone: e.target.value })} /></div>
                </div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e) => update({ address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>City</Label><Input value={form.city} onChange={(e) => update({ city: e.target.value })} /></div>
                  <div><Label>Country</Label><Input value={form.country} onChange={(e) => update({ country: e.target.value })} /></div>
                </div>
                <div><Label>Tagline (optional)</Label><Input value={form.tagline} onChange={(e) => update({ tagline: e.target.value })} placeholder="Your trusted insurance partner" /></div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Brand assets</CardTitle>
                <CardDescription>Your logo and brand colors appear on quotes, invoices and receipts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Logo</Label>
                  <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => {
                    const file = e.target.files?.[0]; if (file) { (window as any).__pendingLogo = file; toast.success(`Logo ready: ${file.name}`); uploadLogo(file); }
                  }} />
                  <p className="text-xs text-muted-foreground mt-1">PNG or JPG. Uploaded when you finish the wizard.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Primary</Label><Input type="color" value={form.brand_primary} onChange={(e) => update({ brand_primary: e.target.value })} /></div>
                  <div><Label>Secondary</Label><Input type="color" value={form.brand_secondary} onChange={(e) => update({ brand_secondary: e.target.value })} /></div>
                  <div><Label>Accent</Label><Input type="color" value={form.brand_accent} onChange={(e) => update({ brand_accent: e.target.value })} /></div>
                </div>
                <div className="rounded-md p-4 text-white" style={{ background: form.brand_primary }}>
                  <div className="text-lg font-semibold">{form.name || "Your agency"}</div>
                  <div className="text-sm opacity-90">{form.tagline || "Preview of your brand"}</div>
                </div>
              </CardContent>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Underwriters</CardTitle>
                <CardDescription>Which insurance companies do you work with? You can change this later.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                  {(insurers ?? []).map((i: any) => (
                    <label key={i.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50">
                      <Checkbox checked={form.insurer_ids.includes(i.id)} onCheckedChange={() => toggleInsurer(i.id)} />
                      <span className="text-sm">{i.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">{form.insurer_ids.length} selected</p>
              </CardContent>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>First branch</CardTitle>
                <CardDescription>Create your head office. You can add more branches later.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Branch name *</Label><Input value={form.branch_name} onChange={(e) => update({ branch_name: e.target.value })} /></div>
                <div><Label>Address</Label><Textarea value={form.branch_address} onChange={(e) => update({ branch_address: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.branch_phone} onChange={(e) => update({ branch_phone: e.target.value })} /></div>
                <div className="rounded-md bg-muted p-3 text-sm">
                  Ready to create <strong>{form.name || "your agency"}</strong> with {form.insurer_ids.length} underwriter{form.insurer_ids.length === 1 ? "" : "s"}.
                </div>
              </CardContent>
            </>
          )}

          <div className="flex justify-between p-6 pt-0 gap-3">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || saving}>Back</Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !form.name.trim()}>Next</Button>
            ) : (
              <Button onClick={finish} disabled={saving}>{saving ? "Creating…" : "Create agency"}</Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}