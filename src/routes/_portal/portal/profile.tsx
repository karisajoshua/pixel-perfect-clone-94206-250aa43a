import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getPortalOverview, updateMyProfile } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { IpenProfilePanel } from "@/components/ipen/ipen-profile-panel";

export const Route = createFileRoute("/_portal/portal/profile")({ component: Page });

const schema = z.object({
  phone: z.string().trim().max(40).optional(),
  alt_phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD"),
  id_number: z.string().trim().max(40).optional(),
  kra_pin: z.string().trim().max(40).optional(),
});

type FormValues = z.infer<typeof schema>;

function Page() {
  const fn = useServerFn(getPortalOverview);
  const updateFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portal-overview"], queryFn: () => fn(), staleTime: 60_000 });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: "", alt_phone: "", address: "", city: "", date_of_birth: "", id_number: "", kra_pin: "",
    },
  });

  const c: any = data?.client;
  const kycVerified = c?.kyc_status === "verified";
  const isIndividual = c?.client_type === "individual";

  useEffect(() => {
    if (!c) return;
    form.reset({
      phone: c.phone ?? "",
      alt_phone: c.alt_phone ?? "",
      address: c.address ?? "",
      city: c.city ?? "",
      date_of_birth: c.date_of_birth ?? "",
      id_number: c.id_number ?? "",
      kra_pin: c.kra_pin ?? "",
    });
  }, [c?.id]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateFn({ data: values as any }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update profile"),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!c) return null;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">My Profile</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="text-sm grid sm:grid-cols-2 gap-3">
          <Row k="Full name" v={c.full_name} />
          {c.company_name ? <Row k="Company" v={c.company_name} /> : null}
          <Row k="Email" v={c.email ?? "—"} />
          <Row k="Branch" v={c.branches?.name ?? "—"} />
          <Row k="KYC status" v={c.kyc_status ?? "—"} />
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="alt_phone" render={({ field }) => (
                <FormItem><FormLabel>Alternate phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Address</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2"><FormLabel>Postal / physical address</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              {isIndividual ? (
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Date of birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="id_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>ID number</FormLabel>
                  <FormControl><Input {...field} disabled={kycVerified} /></FormControl>
                  {kycVerified ? <FormDescription>Locked after KYC verification. Contact your agent to change.</FormDescription> : <FormMessage />}
                </FormItem>
              )} />
              <FormField control={form.control} name="kra_pin" render={({ field }) => (
                <FormItem>
                  <FormLabel>KRA PIN</FormLabel>
                  <FormControl><Input {...field} disabled={kycVerified} /></FormControl>
                  {kycVerified ? <FormDescription>Locked after KYC verification.</FormDescription> : <FormMessage />}
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => c && form.reset({
              phone: c.phone ?? "", alt_phone: c.alt_phone ?? "", address: c.address ?? "",
              city: c.city ?? "", date_of_birth: c.date_of_birth ?? "", id_number: c.id_number ?? "", kra_pin: c.kra_pin ?? "",
            })} disabled={!form.formState.isDirty}>Cancel</Button>
          </div>

          <p className="text-xs text-muted-foreground">To change your full name, email, or branch, contact your agent.</p>
        </form>
      </Form>
      <IpenProfilePanel />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
}