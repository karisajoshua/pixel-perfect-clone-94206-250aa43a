import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/roles";
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

export const Route = createFileRoute("/_authenticated/admin/import")({ beforeLoad: requireRole(["admin"]), component: ImportPage });

type Row = Record<string, any>;

const norm = (s: any) => (s ?? "").toString().trim();
const upper = (s: any) => norm(s).toUpperCase();
const nameKey = (s: any) => {
  const t = upper(s).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.split(" ").sort().join(" ");
};
const num = (s: any) => { const n = Number(norm(s).replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) && n !== 0 ? n : null; };
// S/INS column: amount in thousands; cells may contain multiple numbers
// separated by + , & / or newline (e.g. "150+50") — sum them and ×1000.
const parseSinsToKES = (raw: any): number | null => {
  const t = norm(raw);
  if (!t) return null;
  const parts = t.split(/[+,&\/\n]/).map((p: string) => Number(p.replace(/[^0-9.]/g, "")));
  const total = parts.filter((n: number) => Number.isFinite(n) && n > 0).reduce((s: number, n: number) => s + n, 0);
  return total > 0 ? total * 1000 : null;
};
const installmentPaid = (raw: any): boolean => {
  const t = upper(raw);
  return /(PAID|ANNUAL|FULL)/.test(t);
};
const normPhone = (s: any) => {
  const t = norm(s);
  if (!t) return null;
  const plus = t.startsWith("+");
  const digits = t.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return plus ? `+${digits}` : digits;
};
const normEmail = (s: any) => {
  const t = norm(s).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
};

function pick(row: Row, ...keys: string[]) {
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === k.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (hit && norm(row[hit])) return row[hit];
  }
  return "";
}

function normInsurer(raw: string): string {
  let s = raw.trim().replace(/\/.*$/, "").trim(); // strip "/MANKONE" etc.
  s = s.replace(/\s+/g, " ");
  // Title case but keep all-caps acronyms ≤4 chars
  return s.split(" ").map((w) => {
    if (w.length <= 4 && /^[A-Z0-9]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

function parseEndDate(monthRaw: string): string | null {
  const m = monthRaw.replace(/[^0-9]/g, "");
  if (!m) return null;
  let mm: number, yy: number;
  if (m.length === 1 || m.length === 2) { mm = parseInt(m, 10); yy = new Date().getFullYear(); }
  else if (m.length === 3) { mm = parseInt(m.slice(0, 1), 10); yy = 2000 + parseInt(m.slice(1), 10); }
  else if (m.length === 4) { mm = parseInt(m.slice(0, 2), 10); yy = 2000 + parseInt(m.slice(2), 10); }
  else return null;
  if (mm < 1 || mm > 12) return null;
  // end-of-month
  const d = new Date(Date.UTC(yy, mm, 0));
  return d.toISOString().slice(0, 10);
}

function addYears(iso: string, n: number): string {
  const d = new Date(iso); d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function stripPolicyNoteFragments(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const kept = notes.split("|").map((p) => p.trim()).filter((p) => p && !/^(insurer|installment|month|sum insured)\s*:/i.test(p));
  return kept.length ? kept.join(" | ") : null;
}

function ImportPage() {
  const [sheets, setSheets] = useState<{ name: string; rows: Row[] }[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [usage, setUsage] = useState<"private" | "commercial" | "psv" | "hire">("private");
  const [mode, setMode] = useState<"insert" | "backfill">("insert");
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

    // Existing clients (by kra_pin, lower(full_name), normalized-name, phone, email)
    const { data: existingClients } = await supabase.from("clients").select("id, full_name, kra_pin, phone, email, alt_phone");
    const byPin = new Map<string, string>();
    const byName = new Map<string, string>();
    const byNormName = new Map<string, string>();
    const byPhone = new Map<string, string>();
    const byEmail = new Map<string, string>();
    const existingById = new Map<string, { phone: string | null; email: string | null; alt_phone: string | null }>();
    (existingClients ?? []).forEach((c: any) => {
      if (c.kra_pin) byPin.set(c.kra_pin.toUpperCase(), c.id);
      byName.set((c.full_name ?? "").toLowerCase(), c.id);
      const nk = nameKey(c.full_name);
      if (nk) byNormName.set(nk, c.id);
      if (c.phone) byPhone.set(normPhone(c.phone) ?? c.phone, c.id);
      if (c.email) byEmail.set(String(c.email).toLowerCase(), c.id);
      existingById.set(c.id, { phone: c.phone ?? null, email: c.email ?? null, alt_phone: c.alt_phone ?? null });
    });

    const findClientId = (name: string, pin: string, phone: string | null, email: string | null): string | undefined => {
      return (
        (pin && byPin.get(pin)) ||
        byName.get(name.toLowerCase()) ||
        byNormName.get(nameKey(name)) ||
        (phone ? byPhone.get(phone) : undefined) ||
        (email ? byEmail.get(email.toLowerCase()) : undefined)
      );
    };

    const { data: existingVeh } = await supabase.from("vehicles").select("registration_no");
    const regs = new Set((existingVeh ?? []).map((v: any) => v.registration_no.toUpperCase()));

    let clientsAdded = 0, clientsUpdated = 0, vehiclesAdded = 0, skippedVeh = 0, errors = 0;
    const newClients: any[] = [];
    const nameKeyToTempIdx = new Map<string, number>();

    // First pass: collect new clients to insert
    for (const r of current.rows) {
      const name = upper(pick(r, "NAME", "CLIENT", "FULL NAME"));
      if (!name) continue;
      const pin = upper(pick(r, "KRA PIN", "PIN", "KRAPIN"));
      const id_number = norm(pick(r, "ID", "ID NUMBER", "ID NO"));
      const email = normEmail(pick(r, "EMAIL", "E-MAIL", "MAIL"));
      const phone = normPhone(pick(r, "PHONE", "TEL", "TELEPHONE", "MOBILE", "CONTACT", "CELL", "MSISDN"));
      const alt_phone = normPhone(pick(r, "ALT PHONE", "ALT TEL", "OTHER PHONE", "PHONE 2", "PHONE2"));
      const key = pin || nameKey(name) || name.toLowerCase();
      const existingId = findClientId(name, pin, phone, email);
      if (existingId) {
        // Backfill missing contact info on existing clients
        const cur = existingById.get(existingId);
        const patch: any = {};
        if (cur && !cur.phone && phone) patch.phone = phone;
        if (cur && !cur.email && email) patch.email = email;
        if (cur && !cur.alt_phone && alt_phone) patch.alt_phone = alt_phone;
        if (Object.keys(patch).length) {
          const { error } = await supabase.from("clients").update(patch).eq("id", existingId);
          if (!error) {
            clientsUpdated++;
            existingById.set(existingId, { ...cur!, ...patch });
          }
        }
        continue;
      }
      if (nameKeyToTempIdx.has(key)) continue;
      nameKeyToTempIdx.set(key, newClients.length);
      newClients.push({
        full_name: name,
        kra_pin: pin || null,
        id_number: id_number || null,
        email,
        phone,
        alt_phone,
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
        const nk = nameKey(c.full_name);
        if (nk) byNormName.set(nk, c.id);
        clientsAdded++;
      });
    }

    // Second pass: build vehicles
    const newVehicles: any[] = [];
    const skippedRows: string[] = [];
    current.rows.forEach((r, idx) => {
      const reg = upper(pick(r, "REG", "REGISTRATION", "REG NO", "REGISTRATION NO"));
      if (!reg) return;
      if (regs.has(reg)) { skippedVeh++; return; }
      const name = upper(pick(r, "NAME", "CLIENT", "FULL NAME"));
      const pin = upper(pick(r, "KRA PIN", "PIN", "KRAPIN"));
      const phone = normPhone(pick(r, "PHONE", "TEL", "TELEPHONE", "MOBILE", "CONTACT", "CELL", "MSISDN"));
      const email = normEmail(pick(r, "EMAIL", "E-MAIL", "MAIL"));
      const clientId = findClientId(name, pin, phone, email);
      if (!clientId) {
        skippedVeh++;
        skippedRows.push(`Row ${idx + 2}: vehicle ${reg} skipped — no matching client for "${name || "(blank name)"}"`);
        return;
      }
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
    });
    if (skippedRows.length) setLog((l) => [...l, ...skippedRows.slice(0, 50), ...(skippedRows.length > 50 ? [`…and ${skippedRows.length - 50} more skipped rows`] : [])]);

    for (let i = 0; i < newVehicles.length; i += 200) {
      const batch = newVehicles.slice(i, i + 200);
      const { data, error } = await supabase
        .from("vehicles")
        .upsert(batch, { onConflict: "registration_no", ignoreDuplicates: true })
        .select("registration_no");
      if (error) { errors++; setLog((l) => [...l, `Vehicle batch error: ${error.message}`]); continue; }
      vehiclesAdded += data?.length ?? 0;
      const dupCount = batch.length - (data?.length ?? 0);
      if (dupCount > 0) skippedVeh += dupCount;
    }

    // ============================================================
    // Insurers + Policies + Invoices + Payments
    // ============================================================

    // Re-load vehicles map (reg -> {id, client_id, notes}) so we cover both
    // newly inserted and previously existing rows from this sheet.
    const regsInSheet = new Set<string>();
    for (const r of current.rows) {
      const reg = upper(pick(r, "REG", "REGISTRATION", "REG NO", "REGISTRATION NO"));
      if (reg) regsInSheet.add(reg);
    }
    const vehLookup = new Map<string, { id: string; client_id: string; notes: string | null }>();
    if (regsInSheet.size) {
      const regArr = [...regsInSheet];
      for (let i = 0; i < regArr.length; i += 500) {
        const chunk = regArr.slice(i, i + 500);
        const { data } = await supabase.from("vehicles").select("id, client_id, registration_no, notes").in("registration_no", chunk);
        (data ?? []).forEach((v: any) => vehLookup.set(v.registration_no.toUpperCase(), { id: v.id, client_id: v.client_id, notes: v.notes }));
      }
    }

    // Auto-create insurers
    const { data: existingInsurers } = await supabase.from("insurers").select("id, name");
    const insurerByName = new Map<string, string>();
    (existingInsurers ?? []).forEach((i: any) => insurerByName.set(i.name.toLowerCase(), i.id));

    const needInsurers = new Set<string>();
    for (const r of current.rows) {
      const company = norm(pick(r, "COMPANY", "COMPA", "INSURER"));
      if (!company) continue;
      const n = normInsurer(company);
      if (n && !insurerByName.has(n.toLowerCase())) needInsurers.add(n);
    }
    let insurersAdded = 0;
    if (needInsurers.size) {
      const rows = [...needInsurers].map((name) => ({ name, active: true }));
      const { data, error } = await supabase.from("insurers").insert(rows).select("id, name");
      if (error) { errors++; setLog((l) => [...l, `Insurer error: ${error.message}`]); }
      else { (data ?? []).forEach((i: any) => { insurerByName.set(i.name.toLowerCase(), i.id); insurersAdded++; }); }
    }

    // Existing policies to dedupe on (client_id, vehicle_id, insurer_id, end_date)
    const { data: existingPolRows } = await supabase
      .from("policies")
      .select("client_id, vehicle_id, insurer_id, end_date");
    const polKey = (cid: string, vid: string | null, iid: string | null, end: string) => `${cid}|${vid ?? ""}|${iid ?? ""}|${end}`;
    const existingPolKeys = new Set((existingPolRows ?? []).map((p: any) => polKey(p.client_id, p.vehicle_id, p.insurer_id, p.end_date)));

    const productClass = usage === "private" ? "motor_private" : "motor_commercial";
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
    const stamp = today.replace(/-/g, "");

    type PolicyDraft = {
      payload: any;
      installment: number | null;
      vehicleId: string;
      noteFragmentsToStrip: boolean;
    };
    const drafts: PolicyDraft[] = [];
    const seenThisRun = new Set<string>();
    let polSeq = 0;

    for (const r of current.rows) {
      const reg = upper(pick(r, "REG", "REGISTRATION", "REG NO", "REGISTRATION NO"));
      if (!reg) continue;
      const veh = vehLookup.get(reg);
      if (!veh) continue;
      const company = norm(pick(r, "COMPANY", "COMPA", "INSURER"));
      if (!company) continue;
      const insurerId = insurerByName.get(normInsurer(company).toLowerCase()) ?? null;
      if (!insurerId) continue;

      const month = norm(pick(r, "MON", "MONTH"));
      const endDate = parseEndDate(month) ?? addYears(today, 1);
      const startDate = addYears(endDate, -1);
      const installment = num(pick(r, "INSTALLM", "INSTALLMENT", "INSTALMENT"));
      const sumInsured = num(pick(r, "S/INS", "SUM INSURED", "SINS"));

      const key = polKey(veh.client_id, veh.id, insurerId, endDate);
      if (existingPolKeys.has(key) || seenThisRun.has(key)) continue;
      seenThisRun.add(key);

      const now = new Date();
      const status = endDate < today ? "expired" : startDate > today ? "pending" : "active";
      polSeq += 1;
      drafts.push({
        payload: {
          policy_no: `IMP-${stamp}-${polSeq}`,
          client_id: veh.client_id,
          vehicle_id: veh.id,
          insurer_id: insurerId,
          product_class: productClass,
          cover_type: "comprehensive",
          start_date: startDate,
          end_date: endDate,
          status,
          payment_status: installment ? "paid" : "unpaid",
          sum_insured: sumInsured,
          premium_gross: installment,
          premium_net: installment,
          created_by: createdBy,
        },
        installment,
        vehicleId: veh.id,
        noteFragmentsToStrip: true,
      });
      void now;
    }

    // Insert policies and capture ids
    const insertedPolicies: { id: string; client_id: string; installment: number | null; vehicleId: string }[] = [];
    for (let i = 0; i < drafts.length; i += 200) {
      const batch = drafts.slice(i, i + 200);
      const { data, error } = await supabase.from("policies").insert(batch.map((d) => d.payload)).select("id, client_id, policy_no");
      if (error) { errors++; setLog((l) => [...l, `Policy batch error: ${error.message}`]); continue; }
      (data ?? []).forEach((p: any) => {
        const draft = batch.find((d) => d.payload.policy_no === p.policy_no);
        if (draft) insertedPolicies.push({ id: p.id, client_id: p.client_id, installment: draft.installment, vehicleId: draft.vehicleId });
      });
    }
    const policiesAdded = insertedPolicies.length;

    // Invoices for policies with an installment
    const invoiceDrafts = insertedPolicies.filter((p) => p.installment && p.installment > 0);
    const insertedInvoices: { id: string; amount: number }[] = [];
    let invSeq = 0;
    for (let i = 0; i < invoiceDrafts.length; i += 200) {
      const batch = invoiceDrafts.slice(i, i + 200).map((p) => {
        invSeq += 1;
        const amt = p.installment as number;
        return {
          invoice_no: `INV-${stamp}-${invSeq}`,
          client_id: p.client_id,
          policy_id: p.id,
          issue_date: today,
          due_date: dueDate,
          subtotal: amt,
          tax: 0,
          total: amt,
          amount_paid: amt,
          status: "paid",
          created_by: createdBy,
        };
      });
      const { data, error } = await supabase.from("invoices").insert(batch).select("id, total, invoice_no");
      if (error) { errors++; setLog((l) => [...l, `Invoice batch error: ${error.message}`]); continue; }
      (data ?? []).forEach((inv: any) => insertedInvoices.push({ id: inv.id, amount: Number(inv.total) }));
    }
    const invoicesAdded = insertedInvoices.length;

    // Payments — one per invoice (drives Total Revenue)
    let revenueAdded = 0;
    for (let i = 0; i < insertedInvoices.length; i += 200) {
      const batch = insertedInvoices.slice(i, i + 200).map((inv) => ({
        invoice_id: inv.id,
        amount: inv.amount,
        method: "import",
        reference: "Imported from sheet",
        paid_date: today,
        recorded_by: createdBy,
      }));
      const { data, error } = await supabase.from("payments").insert(batch).select("amount");
      if (error) { errors++; setLog((l) => [...l, `Payment batch error: ${error.message}`]); continue; }
      (data ?? []).forEach((p: any) => { revenueAdded += Number(p.amount); });
    }

    // Strip Insurer/Installment/Month/Sum insured from vehicle notes for vehicles that now have a policy
    const vehiclesWithPolicy = new Set(insertedPolicies.map((p) => p.vehicleId));
    const noteUpdates: { id: string; notes: string | null }[] = [];
    for (const vid of vehiclesWithPolicy) {
      const v = [...vehLookup.values()].find((x) => x.id === vid);
      if (!v) continue;
      const cleaned = stripPolicyNoteFragments(v.notes);
      if (cleaned !== v.notes) noteUpdates.push({ id: vid, notes: cleaned });
    }
    for (const u of noteUpdates) {
      await supabase.from("vehicles").update({ notes: u.notes }).eq("id", u.id);
    }

    setBusy(false);
    const fmtMoney = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
    setLog((l) => [
      ...l,
      `Done: ${clientsAdded} clients added, ${clientsUpdated} clients updated with contact info, ${vehiclesAdded} vehicles, ${insurersAdded} insurers, ${policiesAdded} policies, ${invoicesAdded} invoices, ${fmtMoney(revenueAdded)} revenue. ${skippedVeh} vehicles skipped, ${errors} errors.`,
    ]);
    toast.success(`Imported ${policiesAdded} policies · ${fmtMoney(revenueAdded)} revenue`);
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader title="Data import" subtitle="Upload an Excel/CSV of clients + vehicles. Each sheet imports separately." />
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Label>Excel or CSV file</Label>
          <Input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <p className="text-xs text-muted-foreground">Expected columns: NAME, ID, KRA PIN, PHONE, EMAIL, REG, MAKE, MODEL, BODY, CC, COLOUR, YEAR, CHASSIS NO, ENGINE NO, COMPANY, INSTALLMENT, MONTH, S/INS. Existing clients are updated with phone/email if missing.</p>
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