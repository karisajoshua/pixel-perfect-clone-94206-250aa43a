import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/zia-logo-red.png.asset.json";

type Branch = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null | undefined;
type Client = { full_name?: string | null; company_name?: string | null; client_type?: string | null; email?: string | null; phone?: string | null } | null | undefined;

export type InvoicePdfInput = {
  invoice: any;
  client?: Client;
  branch?: Branch;
  policyNo?: string | null;
  items?: any[];
  payments?: any[];
};

const BRAND = "#b91c1c"; // zest red
const BRAND_DARK = "#7f1d1d";
const MUTED = "#6b7280";

let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoAsset.url);
    const blob = await res.blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return null;
  }
}

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function downloadInvoicePdf({ invoice, client, branch, policyNo, items, payments }: InvoicePdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 90, "F");

  const logo = await loadLogo();
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 18, 54, 54); } catch { /* ignore */ }
  }
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Zest Insurance Agency", margin + (logo ? 66 : 0), 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Insurance brokerage & advisory", margin + (logo ? 66 : 0), 60);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageW - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.invoice_no ?? "", pageW - margin, 60, { align: "right" });

  // Meta + branch row
  let y = 120;
  doc.setTextColor("#111827");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FROM", margin, y);
  doc.text("BILL TO", pageW / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED);

  const fromLines = [
    branch?.name ?? "Zest Insurance Agency",
    branch?.address ?? "",
    [branch?.phone, branch?.email].filter(Boolean).join(" • "),
  ].filter(Boolean);
  fromLines.forEach((l, i) => doc.text(String(l), margin, y + i * 12));

  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  const toLines = [
    clientName || "—",
    client?.email ?? "",
    client?.phone ?? "",
    policyNo ? `Policy: ${policyNo}` : "",
  ].filter(Boolean);
  toLines.forEach((l, i) => doc.text(String(l), pageW / 2, y + i * 12));

  y += Math.max(fromLines.length, toLines.length) * 12 + 16;

  // Meta box
  doc.setDrawColor("#e5e7eb");
  doc.setFillColor("#f9fafb");
  doc.roundedRect(margin, y, pageW - margin * 2, 46, 4, 4, "FD");
  doc.setTextColor(MUTED); doc.setFontSize(8);
  const cols = [
    ["ISSUE DATE", invoice.issue_date ?? "—"],
    ["DUE DATE", invoice.due_date ?? "—"],
    ["STATUS", String(invoice.status ?? "—").toUpperCase()],
    ["BALANCE", money(Number(invoice.total) - Number(invoice.amount_paid || 0))],
  ];
  const colW = (pageW - margin * 2) / cols.length;
  cols.forEach(([label, val], i) => {
    const cx = margin + i * colW + 12;
    doc.setTextColor(MUTED); doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(label, cx, y + 16);
    doc.setTextColor("#111827"); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(String(val), cx, y + 34);
  });
  y += 60;

  // Line items
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Total"]],
    body: (items ?? []).map((it: any) => [
      it.description ?? "",
      String(it.quantity ?? ""),
      money(it.unit_price),
      money(it.total),
    ]),
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#fafafa" },
    columnStyles: { 1: { halign: "right", cellWidth: 50 }, 2: { halign: "right", cellWidth: 100 }, 3: { halign: "right", cellWidth: 110 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  // Totals
  const totalsX = pageW - margin - 220;
  const row = (label: string, val: string, opts: { bold?: boolean; color?: string } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.color ?? "#111827");
    doc.setFontSize(10);
    doc.text(label, totalsX, y);
    doc.text(val, pageW - margin, y, { align: "right" });
    y += 16;
  };
  row("Subtotal", money(invoice.subtotal));
  row("Tax", money(invoice.tax));
  doc.setDrawColor("#e5e7eb"); doc.line(totalsX, y - 8, pageW - margin, y - 8);
  row("Total", money(invoice.total), { bold: true });
  row("Amount paid", money(invoice.amount_paid));
  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);
  row("Balance due", money(balance), { bold: true, color: balance > 0 ? BRAND_DARK : "#047857" });

  // Payments
  if (payments && payments.length) {
    y += 8;
    doc.setFont("helvetica", "bold"); doc.setTextColor("#111827"); doc.setFontSize(11);
    doc.text("Payments received", margin, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Method", "Reference", "Amount"]],
      body: payments.map((p: any) => [p.paid_date ?? "", p.method ?? "—", p.reference ?? "", money(p.amount)]),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: "#f3f4f6", textColor: "#111827" },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BRAND); doc.setLineWidth(2);
  doc.line(margin, pageH - 50, pageW - margin, pageH - 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("Thank you for choosing Zest Insurance Agency.", margin, pageH - 32);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW - margin, pageH - 32, { align: "right" });

  doc.save(`Invoice-${invoice.invoice_no ?? invoice.id}.pdf`);
}