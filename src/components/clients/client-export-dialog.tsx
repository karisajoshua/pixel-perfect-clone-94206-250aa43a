import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function ClientExportDialog({ open, onOpenChange }: Props) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [company, setCompany] = useState("");
  const [clientType, setClientType] = useState<string>("any");
  const [branchId, setBranchId] = useState<string>("any");
  const [kyc, setKyc] = useState<string>("any");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data ?? []));
    }
  }, [open]);

  const fetchRows = async () => {
    let q = supabase
      .from("clients")
      .select("full_name, company_name, client_type, email, phone, alt_phone, id_number, kra_pin, city, kyc_status, created_at, branches(name)")
      .order("created_at", { ascending: false });
    if (company.trim()) q = q.ilike("company_name", `%${company.trim()}%`);
    if (clientType !== "any") q = q.eq("client_type", clientType as "individual" | "corporate");
    if (branchId !== "any") q = q.eq("branch_id", branchId);
    if (kyc !== "any") q = q.eq("kyc_status", kyc as "pending" | "verified" | "rejected" | "expired");
    if (dateFrom) q = q.gte("created_at", `${dateFrom}T00:00:00Z`);
    if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59Z`);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  };

  const filterSummary = () => {
    const parts: string[] = [];
    if (company) parts.push(`Company: "${company}"`);
    if (clientType !== "any") parts.push(`Type: ${clientType}`);
    if (branchId !== "any") parts.push(`Branch: ${branches.find((b) => b.id === branchId)?.name ?? branchId}`);
    if (kyc !== "any") parts.push(`KYC: ${kyc}`);
    if (dateFrom || dateTo) parts.push(`Created: ${dateFrom || "…"} → ${dateTo || "…"}`);
    return parts.length ? parts.join("  •  ") : "All clients";
  };

  const toTable = (rows: any[]) => {
    const headers = ["Name", "Company", "Type", "Email", "Phone", "Alt Phone", "ID/Reg", "KRA PIN", "City", "KYC", "Branch", "Created"];
    const body = rows.map((c) => [
      c.full_name ?? "",
      c.company_name ?? "",
      c.client_type ?? "",
      c.email ?? "",
      c.phone ?? "",
      c.alt_phone ?? "",
      c.id_number ?? "",
      c.kra_pin ?? "",
      c.city ?? "",
      c.kyc_status ?? "",
      c.branches?.name ?? "",
      c.created_at ? new Date(c.created_at).toISOString().slice(0, 10) : "",
    ]);
    return { headers, body };
  };

  const exportExcel = async () => {
    setBusy(true);
    try {
      const rows = await fetchRows();
      const { headers, body } = toTable(rows);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clients");
      XLSX.writeFile(wb, `clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`Exported ${rows.length} clients`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally { setBusy(false); }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const rows = await fetchRows();
      const { headers, body } = toTable(rows);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text("Clients export", 40, 36);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`${rows.length} rows  •  ${filterSummary()}`, 40, 52);
      doc.text(`Generated ${new Date().toLocaleString()}`, 40, 64);
      autoTable(doc, {
        head: [headers],
        body,
        startY: 78,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
      });
      doc.save(`clients-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported ${rows.length} clients`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Export clients</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Company name contains</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme" />
          </div>
          <div className="space-y-1.5">
            <Label>Client type</Label>
            <Select value={clientType} onValueChange={setClientType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="corporate">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any branch</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>KYC status</Label>
            <Select value={kyc} onValueChange={setKyc}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Created from</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Created to</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="outline" onClick={exportPdf} disabled={busy}>
            <FileText className="h-4 w-4 mr-1" /> {busy ? "Working…" : "Download PDF"}
          </Button>
          <Button onClick={exportExcel} disabled={busy}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> {busy ? "Working…" : "Download Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}