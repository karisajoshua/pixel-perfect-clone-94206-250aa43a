import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getCurrentBrand } from "./tenant-brand";
import { parseLocalDate } from "./date-only";

type Branch = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null | undefined;
type Client = { full_name?: string | null; company_name?: string | null; client_type?: string | null; email?: string | null; phone?: string | null } | null | undefined;

export type ReceiptPdfInput = {
  payment: any;
  invoice: any;
  client?: Client;
  branch?: Branch;
  policyNo?: string | null;
  receivedBy?: string | null;
  receiptNo?: string | null;
  allPayments?: any[];
};

const INK = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const PAID = "#047857";
const PARTIAL = "#b45309";

const imageCache = new Map<string, string>();
async function loadImage(url: string): Promise<string | null> {
  if (imageCache.has(url)) return imageCache.get(url)!;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    imageCache.set(url, data);
    return data;
  } catch {
    return null;
  }
}

const money = (n: any) => `KSH ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// --- number to words (English, KES) ---
const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function under1000(n: number): string {
  let s = "";
  if (n >= 100) { s += ones[Math.floor(n / 100)] + " Hundred"; n %= 100; if (n) s += " "; }
  if (n >= 20) { s += tens[Math.floor(n / 10)]; n %= 10; if (n) s += "-" + ones[n]; }
  else if (n > 0) s += ones[n];
  return s;
}
function numberToWords(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const units: [number, string][] = [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1_000, "Thousand"]];
  for (const [v, name] of units) {
    if (n >= v) { parts.push(under1000(Math.floor(n / v)) + " " + name); n %= v; }
  }
  if (n > 0) parts.push(under1000(n));
  return parts.join(" ");
}
function kesInWords(n: number): string {
  const whole = Math.floor(n);
  const cents = Math.round((n - whole) * 100);
  let s = `Kenya Shillings ${numberToWords(whole)}`;
  if (cents > 0) s += ` and ${numberToWords(cents)} Cents`;
  return s + " Only";
}

export function deriveReceiptNo(payment: { id?: string; paid_date?: string }): string {
  const year = (parseLocalDate(payment?.paid_date) ?? new Date()).getFullYear();
  const tail = String(payment?.id ?? "").replace(/-/g, "").slice(-6).toUpperCase();
  return `RCP-${year}-${tail || "000001"}`;
}

export async function downloadReceiptPdf(input: ReceiptPdfInput) {
  const { payment, invoice, client, branch, policyNo, receivedBy } = input;
  const receiptNo = input.receiptNo ?? deriveReceiptNo(payment);

  const brand = await getCurrentBrand();
  const BRAND = brand.primary;
  const BRAND_DARK = brand.secondary;
  const BRAND_SOFT = "#eaf2ff";
  const AGENCY = { name: brand.name, tagline: brand.tagline, address: brand.address, phone: brand.phone, email: brand.email, website: brand.website };

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;

  const total = Number(invoice?.total ?? 0);
  const newPaid = Number(invoice?.amount_paid ?? 0);
  const balance = Math.max(0, total - newPaid);
  const amount = Number(payment?.amount ?? 0);
  const priorPaid = Math.max(0, newPaid - amount);
  const isFull = balance <= 0.01;
  const dateStr = (parseLocalDate(payment?.paid_date) ?? new Date())
    .toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  // ===== Top brand rule =====
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 6, "F");

  // ===== Header =====
  const headerY = 26;
  const rightBlockW = 200; // reserved width on the right for OFFICIAL RECEIPT + meta
  const leftTextX = margin + 70;
  const leftTextMaxW = pageW - margin - rightBlockW - leftTextX - 12;
  const logo = brand.logo_url ? await loadImage(brand.logo_url) : null;
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, headerY, 56, 56); } catch {}
  }
  // Agency block (left)
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(AGENCY.name, leftTextX, headerY + 18);
  doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(AGENCY.tagline, leftTextX, headerY + 32);
  doc.setTextColor(INK);
  const addrLines = doc.splitTextToSize(AGENCY.address, leftTextMaxW);
  doc.text(addrLines, leftTextX, headerY + 46);
  const contactLines = doc.splitTextToSize(
    [AGENCY.phone, AGENCY.email, AGENCY.website].filter(Boolean).join("  ·  "),
    leftTextMaxW,
  );
  doc.text(contactLines, leftTextX, headerY + 46 + addrLines.length * 12);

  // Right block: title + meta
  const rx = pageW - margin;
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text("OFFICIAL RECEIPT", rx, headerY + 16, { align: "right" });
  const metaLabelX = rx - rightBlockW + 8;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("Receipt No.", metaLabelX, headerY + 36);
  doc.setFont("helvetica", "bold"); doc.setTextColor(BRAND); doc.setFontSize(10);
  doc.text(receiptNo, rx, headerY + 36, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("Date", metaLabelX, headerY + 52);
  doc.setFont("helvetica", "bold"); doc.setTextColor(INK); doc.setFontSize(10);
  doc.text(dateStr, rx, headerY + 52, { align: "right" });

  // Divider
  let y = headerY + 76;
  doc.setDrawColor(BORDER); doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // ===== Info cards: RECEIVED FROM | PAYMENT FOR =====
  const colGap = 14;
  const colW = (contentW - colGap) / 2;
  const cardH = 96;

  const drawCard = (x: number, title: string, rows: { label: string; value: string }[]) => {
    doc.setFillColor(BRAND_SOFT);
    doc.setDrawColor(BORDER);
    doc.roundedRect(x, y, colW, cardH, 6, 6, "FD");
    doc.setFillColor(BRAND);
    doc.rect(x, y, 4, cardH, "F");
    doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(title, x + 14, y + 16);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(INK);
    rows.forEach((r, i) => {
      const ry = y + 34 + i * 15;
      doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text(r.label, x + 14, ry);
      doc.setTextColor(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      const v = doc.splitTextToSize(r.value || "—", colW - 90);
      doc.text(v, x + 84, ry);
    });
  };

  const clientName = client?.client_type === "corporate"
    ? (client?.company_name ?? client?.full_name ?? "")
    : (client?.full_name ?? "");

  drawCard(margin, "RECEIVED FROM", [
    { label: "Name", value: clientName || "—" },
    { label: "Phone", value: client?.phone ?? "—" },
    { label: "Email", value: client?.email ?? "—" },
    { label: "Branch", value: branch?.name ?? "—" },
  ]);

  drawCard(margin + colW + colGap, "PAYMENT FOR", [
    { label: "Invoice", value: invoice?.invoice_no ?? "—" },
    { label: "Policy", value: policyNo ?? "—" },
    { label: "Issued", value: invoice?.issue_date ?? "—" },
    { label: "Due", value: invoice?.due_date ?? "—" },
  ]);

  y += cardH + 18;

  // ===== AMOUNT RECEIVED band =====
  const bandH = 70;
  doc.setFillColor(BRAND);
  doc.roundedRect(margin, y, contentW, bandH, 8, 8, "F");
  // Status pill on the right
  const pillW = 130, pillH = 26;
  const pillX = margin + contentW - pillW - 16;
  const pillY = y + (bandH - pillH) / 2;
  doc.setFillColor(isFull ? PAID : PARTIAL);
  doc.roundedRect(pillX, pillY, pillW, pillH, 13, 13, "F");
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(isFull ? "PAID IN FULL" : "PARTIAL PAYMENT", pillX + pillW / 2, pillY + 17, { align: "center" });

  // Amount text
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("AMOUNT RECEIVED", margin + 18, y + 22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text(money(amount), margin + 18, y + 48);
  doc.setFont("helvetica", "italic"); doc.setFontSize(9);
  const words = kesInWords(amount);
  const wordLines = doc.splitTextToSize(words, contentW - pillW - 60);
  doc.text(wordLines, margin + 18, y + 62);

  y += bandH + 18;

  // ===== Payment details table =====
  autoTable(doc, {
    startY: y,
    head: [["Date", "Method", "Reference", "Invoice", "Policy", "Amount"]],
    body: [[
      dateStr,
      String(payment?.method ?? "—"),
      String(payment?.reference ?? "—"),
      String(invoice?.invoice_no ?? "—"),
      String(policyNo ?? "—"),
      money(amount),
    ]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 8, lineColor: BORDER, lineWidth: 0.5, textColor: INK },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#fafafa" },
    columnStyles: { 5: { halign: "right", fontStyle: "bold" } },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ===== Summary (right) + Authorized by (left) =====
  const sumW = contentW * 0.55;
  const authX = margin;
  const authW = contentW - sumW - colGap;
  const sumX = margin + authW + colGap;

  const sumStartY = y;
  autoTable(doc, {
    startY: sumStartY,
    body: [
      ["Invoice total", money(total)],
      ["Previously paid", money(priorPaid)],
      ["This payment", money(amount)],
      ["Total paid", money(newPaid)],
      ["Balance due", money(balance)],
    ],
    margin: { left: sumX },
    tableWidth: sumW,
    styles: { fontSize: 10, cellPadding: 7, lineColor: BORDER, lineWidth: 0.5, textColor: INK },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.row.index === 2) {
          data.cell.styles.fillColor = BRAND_SOFT;
          data.cell.styles.textColor = BRAND_DARK;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.row.index === 4) {
          data.cell.styles.fillColor = BRAND_DARK;
          data.cell.styles.textColor = "#ffffff";
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  const sumEnd = (doc as any).lastAutoTable.finalY;

  // Authorized panel matching summary height — stamp ABOVE signatory
  const authH = Math.max(sumEnd - sumStartY, 140);
  doc.setDrawColor(BORDER);
  doc.setFillColor("#ffffff");
  doc.roundedRect(authX, sumStartY, authW, authH, 6, 6, "FD");
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("AUTHORIZED BY", authX + 12, sumStartY + 16);

  const stamp = brand.stamp_url ? await loadImage(brand.stamp_url) : null;
  const stampSize = 70;
  const stampY = sumStartY + 22;
  if (stamp) {
    try {
      doc.addImage(stamp, "PNG", authX + (authW - stampSize) / 2, stampY, stampSize, stampSize);
    } catch {}
  } else {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(MUTED);
    doc.text("No company stamp uploaded", authX + authW / 2, stampY + stampSize / 2, { align: "center" });
    doc.text("(Admin → Agency → Company stamp)", authX + authW / 2, stampY + stampSize / 2 + 11, { align: "center" });
  }

  const lineY = sumStartY + authH - 30;
  doc.setDrawColor("#9ca3af"); doc.setLineWidth(0.6);
  doc.line(authX + 20, lineY, authX + authW - 20, lineY);
  doc.setTextColor(INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  const signatory = brand.signatory_name || receivedBy || "";
  doc.text(signatory, authX + authW / 2, sumStartY + authH - 16, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(MUTED);
  doc.text(brand.signatory_title || "Authorized Signatory", authX + authW / 2, sumStartY + authH - 6, { align: "center" });

  y = Math.max(sumEnd, sumStartY + authH) + 18;

  // ===== Notes =====
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("NOTES", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(MUTED);
  const notes = [
    "This receipt acknowledges the amount stated above against the referenced invoice.",
    "Retain this document as proof of payment. Refunds are subject to the policy terms.",
    "For any queries, contact us on " + AGENCY.phone + " or " + AGENCY.email + ".",
  ];
  notes.forEach((t, i) => doc.text(`•  ${t}`, margin, y + 14 + i * 11));

  // ===== Footer =====
  const fY = pageH - 32;
  doc.setDrawColor(BRAND); doc.setLineWidth(1.2);
  doc.line(margin, fY, pageW - margin, fY);
  doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text([AGENCY.name, AGENCY.website].filter(Boolean).join("  ·  "), margin, fY + 14);
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "italic");
  doc.text(`Thank you for choosing ${brand.name}.`, pageW - margin, fY + 14, { align: "right" });

  const filename = `Receipt-${receiptNo}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}