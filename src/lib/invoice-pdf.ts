import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { getCurrentBrand } from "./tenant-brand";

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

const MUTED = "#6b7280";

const logoCache = new Map<string, string>();
async function loadLogo(url: string): Promise<string | null> {
  if (logoCache.has(url)) return logoCache.get(url)!;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    logoCache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

const money = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d: any) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const statusColors = (status: string, brand: string) => {
  const s = (status || "").toLowerCase();
  if (s === "paid") return { text: "#047857", bg: "#ecfdf5", border: "#a7f3d0" };
  if (s === "partial") return { text: "#b45309", bg: "#fffbeb", border: "#fde68a" };
  if (s === "cancelled" || s === "void") return { text: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" };
  return { text: "#b91c1c", bg: "#fef2f2", border: "#fecaca" };
};

export async function downloadInvoicePdf({ invoice, client, branch, policyNo, items, payments }: InvoicePdfInput) {
  const brand = await getCurrentBrand();
  const BRAND = brand.primary;
  const BRAND_DARK = brand.secondary;
  const AGENCY_CONTACT = { name: brand.name, address: brand.address, phone: brand.phone, email: brand.email };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  const status = String(invoice.status ?? "").toUpperCase() || "UNPAID";
  const balance = Number(invoice.total) - Number(invoice.amount_paid || 0);

  // ---------- Header band ----------
  const bandH = 190;
  doc.setFillColor(BRAND);
  doc.roundedRect(0, -20, pageW, bandH + 20, 18, 18, "F");

  const logo = brand.logo_url ? await loadLogo(brand.logo_url) : null;
  const leftX = margin;
  if (logo) {
    try { doc.addImage(logo, "PNG", leftX, 46, 66, 66); } catch { /* ignore */ }
  }
  const nameX = leftX + (logo ? 82 : 0);
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(brand.name, nameX, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(brand.tagline, nameX, 98);

  // Vertical divider
  const rightX = pageW * 0.62;
  doc.setDrawColor("#ffffff");
  doc.setLineWidth(1);
  doc.line(rightX - 22, 34, rightX - 22, bandH - 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("INVOICE", pageW - margin, 56, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("INVOICE NUMBER", rightX, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(String(invoice.invoice_no ?? ""), rightX, 93);

  // Status pill (white chip on the band)
  const pillW = doc.getTextWidth(status) + 44;
  doc.setFillColor("#ffffff");
  doc.roundedRect(rightX, 104, pillW, 24, 12, 12, "F");
  doc.setFillColor(BRAND);
  doc.circle(rightX + 16, 116, 6, "F");
  doc.setTextColor(BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(status, rightX + 30, 120);

  // QR code — public verification link
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.zestinsurance.co.ke";
  const verifyUrl = `${origin}/verify/invoice/${invoice.id}`;
  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 320, color: { dark: "#111827", light: "#ffffff" } });
    doc.setFillColor("#ffffff");
    doc.roundedRect(rightX, 138, 76, 76, 6, 6, "F");
    doc.addImage(qr, "PNG", rightX + 6, 144, 64, 64);
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Scan to verify", rightX + 88, 170);
    doc.text("invoice authenticity", rightX + 88, 183);
  } catch { /* ignore */ }

  // ---------- FROM / BILL TO ----------
  let y = bandH + 50;
  doc.setTextColor("#111827");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND);
  doc.text("FROM", margin, y);
  doc.text("BILL TO", pageW / 2, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#111827");
  doc.setFontSize(10);

  const fromLines = [
    branch?.name ?? AGENCY_CONTACT.name,
    branch?.address ?? AGENCY_CONTACT.address,
    branch?.phone ?? AGENCY_CONTACT.phone,
    branch?.email ?? AGENCY_CONTACT.email,
  ].filter(Boolean);
  fromLines.forEach((l, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(i === 0 ? "#111827" : MUTED);
    doc.text(String(l), margin, y + i * 18);
  });

  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  const toLines = [
    clientName || "—",
    client?.email ?? "",
    client?.phone ?? "",
    policyNo ? `Policy: ${policyNo}` : "",
  ].filter(Boolean);
  toLines.forEach((l, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.setTextColor(i === 0 ? "#111827" : MUTED);
    doc.text(String(l), pageW / 2, y + i * 18);
  });

  const blockRows = Math.max(fromLines.length, toLines.length);
  // vertical rule between the two columns
  doc.setDrawColor("#e5e7eb");
  doc.setLineWidth(1);
  doc.line(pageW / 2 - 24, y - 34, pageW / 2 - 24, y + blockRows * 18 - 8);

  y += blockRows * 18 + 18;

  // ---------- Stats strip ----------
  const stripH = 70;
  doc.setDrawColor("#e5e7eb");
  doc.setFillColor("#f8fafc");
  doc.roundedRect(margin, y, pageW - margin * 2, stripH, 8, 8, "FD");
  const sc = statusColors(invoice.status, BRAND);
  const cols = [
    ["ISSUE DATE", fmtDate(invoice.issue_date), "#111827"],
    ["DUE DATE", fmtDate(invoice.due_date), "#111827"],
    ["STATUS", status, sc.text],
    ["BALANCE", money(balance), balance > 0 ? "#b91c1c" : "#047857"],
  ];
  const colW = (pageW - margin * 2) / cols.length;
  cols.forEach(([label, val, color], i) => {
    const cx = margin + i * colW + colW / 2;
    if (i > 0) {
      doc.setDrawColor("#e5e7eb");
      doc.line(margin + i * colW, y + 14, margin + i * colW, y + stripH - 14);
    }
    doc.setTextColor(BRAND); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(String(label), cx, y + 28, { align: "center" });
    doc.setTextColor(String(color)); doc.setFontSize(11.5); doc.setFont("helvetica", "bold");
    doc.text(String(val), cx, y + 50, { align: "center" });
  });
  y += stripH + 24;

  // ---------- Line items ----------
  autoTable(doc, {
    startY: y,
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]],
    body: (items ?? []).map((it: any) => [
      it.description ?? "",
      String(it.quantity ?? ""),
      money(it.unit_price),
      money(it.total),
    ]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 10, textColor: "#111827", lineColor: "#e5e7eb", lineWidth: { bottom: 0.5 } as any },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold", fontSize: 9, cellPadding: 10 },
    columnStyles: { 1: { halign: "center", cellWidth: 60 }, 2: { halign: "right", cellWidth: 110 }, 3: { halign: "right", cellWidth: 120 } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Totals ----------
  const totalsX = pageW / 2 + 20;
  const row = (label: string, val: string, opts: { bold?: boolean; color?: string; size?: number; labelColor?: string } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(opts.labelColor ?? "#374151");
    doc.text(label, totalsX, y);
    doc.setTextColor(opts.color ?? "#111827");
    doc.text(val, pageW - margin, y, { align: "right" });
    y += 20;
  };
  row("Subtotal", money(invoice.subtotal));
  row("Tax", money(invoice.tax));
  doc.setDrawColor("#e5e7eb"); doc.setLineWidth(1); doc.line(totalsX, y - 10, pageW - margin, y - 10);
  y += 4;
  row("TOTAL", money(invoice.total), { bold: true, size: 14, labelColor: BRAND, color: BRAND });
  row("Amount paid", money(invoice.amount_paid));
  // highlighted balance row
  doc.setFillColor("#eff6ff");
  doc.rect(totalsX - 12, y - 14, pageW - margin - totalsX + 12, 28, "F");
  row("BALANCE DUE", money(balance), { bold: true, size: 12, labelColor: BRAND, color: balance > 0 ? "#b91c1c" : "#047857" });
  y += 10;

  // ---------- Payments ----------
  if (payments && payments.length) {
    doc.setFont("helvetica", "bold"); doc.setTextColor(BRAND); doc.setFontSize(10);
    doc.text("PAYMENTS RECEIVED", margin, y); y += 8;
    autoTable(doc, {
      startY: y,
      head: [["DATE", "METHOD", "REFERENCE", "AMOUNT"]],
      body: payments.map((p: any) => [fmtDate(p.paid_date), p.method ?? "—", p.reference ?? "", money(p.amount)]),
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 8, textColor: "#374151", lineColor: "#e5e7eb", lineWidth: { bottom: 0.5 } as any },
      headStyles: { fillColor: "#f8fafc", textColor: "#6b7280", fontStyle: "bold", fontSize: 8 },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ---------- Notes ----------
  const notesText = String(invoice.notes ?? "").trim();
  if (notesText) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const boxW = pageW - margin * 2;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const lines: string[] = doc.splitTextToSize(notesText, boxW - 24);
    const boxH = lines.length * 13 + 20;
    const needed = 14 + boxH; // heading + panel
    if (y + needed > pageHeight - 100) { doc.addPage(); y = 60; }

    doc.setFont("helvetica", "bold"); doc.setTextColor(BRAND); doc.setFontSize(10);
    doc.text("NOTES", margin, y);
    y += 10;

    doc.setDrawColor("#e5e7eb"); doc.setFillColor("#f8fafc"); doc.setLineWidth(1);
    doc.roundedRect(margin, y, boxW, boxH, 8, 8, "FD");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(MUTED);
    lines.forEach((l, i) => doc.text(l, margin + 12, y + 20 + i * 13));
    y += boxH + 14;
  }

  // ---------- Footer ----------
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text(`Thank you for choosing ${brand.name}.`, margin, pageH - 74);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-GB")}`, margin, pageH - 60);

  doc.setDrawColor("#e5e7eb"); doc.setLineWidth(1);
  doc.line(margin, pageH - 44, pageW - margin, pageH - 44);

  doc.setFontSize(8.5); doc.setTextColor(MUTED);
  const footItems = [AGENCY_CONTACT.address, AGENCY_CONTACT.phone, AGENCY_CONTACT.email];
  let fx = margin;
  footItems.forEach((t, i) => {
    doc.text(String(t), fx, pageH - 26);
    fx += doc.getTextWidth(String(t)) + 18;
    if (i < footItems.length - 1) {
      doc.setDrawColor("#e5e7eb");
      doc.line(fx - 9, pageH - 34, fx - 9, pageH - 20);
    }
  });
  doc.setTextColor(MUTED);
  doc.text("Powered by", pageW - margin, pageH - 32, { align: "right" });
  doc.setTextColor(BRAND); doc.setFont("helvetica", "bold");
  doc.text("Texcortech Systems", pageW - margin, pageH - 20, { align: "right" });

  const filename = `Invoice-${invoice.invoice_no ?? invoice.id}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}