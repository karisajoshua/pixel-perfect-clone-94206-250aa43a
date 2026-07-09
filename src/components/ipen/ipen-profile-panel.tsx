import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getIpenProfile,
  updateIpenProfile,
  uploadIpenProfilePhoto,
} from "@/lib/ipen/profile.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export function IpenProfilePanel() {
  const qc = useQueryClient();
  const getFn = useServerFn(getIpenProfile);
  const updFn = useServerFn(updateIpenProfile);
  const upFn = useServerFn(uploadIpenProfilePhoto);
  const q = useQuery({ queryKey: ["ipen", "profile"], queryFn: () => getFn() });
  const [form, setForm] = useState<Record<string, any>>({});
  useEffect(() => {
    const p: any = q.data && typeof q.data === "object" ? ((q.data as any).data ?? q.data) : {};
    if (p && typeof p === "object") setForm(p);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => updFn({ data: form }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["ipen", "profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const uploadPhoto = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
      }
      await upFn({
        data: {
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          fileBase64: btoa(bin),
        },
      });
      toast.success("Photo uploaded");
      qc.invalidateQueries({ queryKey: ["ipen", "profile"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  };

  const F = (name: string, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={form[name] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>IPEN profile</CardTitle>
        <CardDescription>Update the profile stored with Ecobank/IPEN.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {q.error && (
          <div className="text-destructive text-sm">{(q.error as Error).message}</div>
        )}
        {q.data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {F("firstName", "First name")}
              {F("lastName", "Last name")}
              {F("otherName", "Other name")}
              {F("phoneNumber", "Phone")}
              {F("kraPin", "KRA PIN")}
              {F("postalAddress", "Postal address")}
              {F("postalCode", "Postal code")}
              {F("town", "Town")}
              {F("dateOfBirth", "Date of birth", "date")}
            </div>
            <div className="flex items-center gap-2">
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Save profile
              </Button>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer border border-input rounded-md px-3 py-1.5 hover:bg-accent">
                <Upload className="h-4 w-4" /> Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadPhoto(f);
                  }}
                />
              </label>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}