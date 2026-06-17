import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/import")({ component: ImportPage });

type Row = Record<string, any>;

const norm = (s: any) => (s ?? "").toString().trim();
const upper = (s: any) => norm(s).toUpperCase();
const num = (s: any) => { const n = Number(norm(s).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) && n !== 0 ? n : null; };

function pick(row: Row, ...keys: string[]) {
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (hit && norm(row[hit])) return row[hit];
  }
  return "";
}

function ImportPage() {
  const [sheets, setSheets] = useState<{ name: string; rows: Row[] }[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [usage, setUsage] = useState<"private" | "commercial" | "psv" | "hire">("private");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const parsed = wb.SheetNames.map((n) => ({
      name: n,
      rows: XLSX.utils.sheet_to_json<Row>(wb.Sheets[n], { defval: "", raw: false }),
    })).filter((s) => s.rows.length);
    setSheets(parsed);
    setActiveSheet(parsed[0]?.name ?? "");
    const guess = parsed[0]?.name?.toLowerCase().includes("comm") ? "commercial" : "private";
    setUsage(guess as any);
  };

  const current = sheets.find((s) => s.name === activeSheet);
  const preview = current?.rows.slice(0, 20) ?? [];
  const cols = preview[0] ? Object.keys(preview[0]) : [];

  const runImport = async () => {
    if (!current) return;
    setBusy(true);
    setLog([]);
    const { data: u } = await supabase.auth.getUser();
    const createdBy = u.user?.id;

    // Existing clients (by kra_pin and lower(full_name))
    const { data: existingClients } = await supabase.from("clients").select("id, full_name, kra_pin");
    const byPin = new Map<string, string>();
    const byName = new Map<string, string>();
    (existingClients ?? []).forEach((c: any) => {
      if (c.kra_pin) byPin.set(c.kra_pin.toUpperCase(), c.id);
      byName.set((c.full_name ?? "").toLowerCase(), c.id);
    });

    const { data: existingVeh } = await supabase.from("vehicles").select("registration_no");
    const regs = new Set((existingVeh ?? []).map((v: any) => v.registration_no.toUpperCase()));

    let clientsAdded = 0, vehiclesAdded = 0, skippedVeh = 0, errors = 0;
    const newClients: any[] = [];
    const nameKeyToTempIdx = new Map<string, number>();

    // First pass: collect new clients to insert
    for (const r of current.rows) {
      const name = upper(pick(r, "NAME", "CLIENT", "FULL NAME"));
      if (!name) continue;
      const pin = upper(pick(r, "KRA PIN", "PIN", "KRAPIN"));
      const id_number = norm(pick(r, "ID", "ID NUMBER", "ID NO"));
      const key = pin || name.toLowerCase();
      if (pin && byPin.has(pin)) continue;
      if (!pin && byName.has(name.toLowerCase())) continue;
      if (nameKeyToTempIdx.has(key)) continue;
      nameKeyToTempIdx.set(key, newClients.length);
      newClients.push({
        full_name: name,
        kra_pin: pin || null,
        id_number: id_number || null,
        client_type: "individual",
        created_by: createdBy,
      });
    }

    // Insert clients in batches of 200
    for (let i = 0; i < newClients.length; i += 200) {
      const batch = newClients.slice(i, i + 200);
      const { data, error } = await supabase.from("clients").insert(batch).select("id, full_name, kra_pin");
      if (error) { errors++; setLog((l) => [...l, `Client batch error: ${error.message}`]); continue; }
      (data ?? []).forEach((c: any) => {
        if (c.kra_pin) byPin.set(c.kra_pin.toUpperCase(), c.id);
        byName.set((c.full_name ?? "").toLowerCase(), c.id);
        clientsAdded++;
      });
    }

    // Second pass: build vehicles
    const newVehicles: any[] = [];
    for (const r of current.rows) {
      const reg = upper(pick(r, "REG", "REGISTRATION", "REG NO", "REGISTRATION NO"));
      if (!reg) continue;
      if (regs.has(reg)) { skippedVeh++; continue; }
      const name = upper(pick(r, "NAME", "CLIENT", "FULL NAME"));
      const pin = upper(pick(r, "KRA PIN", "PIN", "KRAPIN"));
      const clientId = (pin && byPin.get(pin)) || byName.get(name.toLowerCase());
      if (!clientId) { skippedVeh++; continue; }
      const company = norm(pick(r, "COMPANY", "COMPA", "INSURER"));
      const installment = norm(pick(r, "INSTALLM", "INSTALLMENT", "INSTALMENT"));
      const month = norm(pick(r, "MON", "MONTH"));
      const sins = norm(pick(r, "S/INS", "SUM INSURED", "SINS"));
      const noteParts = [
        company && `Insurer: ${company}`,
        installment && `Installment: ${installment}`,
        month && `Month: ${month}`,
        sins && `Sum insured: ${sins}`,
      ].filter(Boolean);
      newVehicles.push({
        client_id: clientId,
        registration_no: reg,
        make: norm(pick(r, "MAKE")) || null,
        model: norm(pick(r, "MODEL")) || null,
        body_type: norm(pick(r, "BODY")) || null,
        cubic_capacity: num(pick(r, "CC")),
        color: norm(pick(r, "COLOUR", "COLOR")) || null,
        year: (() => { const y = num(pick(r, "YEAR")); return y && y > 1900 && y < 2100 ? y : null; })(),
        chassis_no: norm(pick(r, "CHASSIS NO", "CHASSIS")) || null,
        engine_no: norm(pick(r, "ENGINE NO", "ENGINE")) || null,
        usage_type: usage,
        notes: noteParts.length ? noteParts.join(" | ") : null,
        created_by: createdBy,
      });
      regs.add(reg);
    }

    for (let i = 0; i < newVehicles.length; i += 200) {
      const batch = newVehicles.slice(i, i + 200);
      const { error, count } = await supabase.from("vehicles").insert(batch, { count: "exact" });
      if (error) { errors++; setLog((l) => [...l, `Vehicle batch error: ${error.message}`]); continue; }
      vehiclesAdded += count ?? batch.length;
    }

    setBusy(false);
    setLog((l) => [...l, `Done: ${clientsAdded} clients, ${vehiclesAdded} vehicles, ${skippedVeh} vehicles skipped, ${errors} errors.`]);
    toast.success(`Imported ${clientsAdded} clients and ${vehiclesAdded} vehicles`);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Data import" subtitle="Upload an Excel/CSV of clients + vehicles. Each sheet imports separately." />
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Excel or CSV file</Label>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <p className="text-xs text-muted-foreground">Expected columns: NAME, ID, KRA PIN, REG, MAKE, MODEL, BODY, CC, COLOUR, YEAR, CHASSIS NO, ENGINE NO, COMPANY, INSTALLMENT, MONTH, S/INS.</p>
        </div>

        {sheets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sheet</Label>
              <Select value={activeSheet} onValueChange={(v) => { setActiveSheet(v); setUsage(v.toLowerCase().includes("comm") ? "commercial" : "private"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sheets.map((s) => <SelectItem key={s.name} value={s.name}>{s.name} ({s.rows.length})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usage type for this sheet</Label>
              <Select value={usage} onValueChange={(v) => setUsage(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="psv">PSV</SelectItem>
                  <SelectItem value="hire">Hire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {current && (
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Preview · first 20 of {current.rows.length} rows</div>
            <Button onClick={runImport} disabled={busy}>
              <Upload className="h-4 w-4 mr-1" /> {busy ? "Importing…" : `Import ${current.rows.length} rows`}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t">{cols.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{norm(r[c])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {log.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Import log</div>
          <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{log.join("\n")}</pre>
        </Card>
      )}
    </div>
  );
}