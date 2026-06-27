import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/zia-logo-white.png.asset.json";
import stampAsset from "@/assets/zest-stamp.png.asset.json";

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

const BRAND = "#2563eb";
const BRAND_DARK = "#1e3a8a";
const MUTED = "#6b7280";

const AGENCY = {
  name: "Zest Insurance Agency",
  address: "Ruai, Miranje Hse, Nairobi, Kenya",
  phone: "+254 713 985 230",
  email: "info@zestinsurance.co.ke",
  website: "www.zestinsurance.co.ke",
};

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
const moneyPlain = (n: any) => `KSH ${Number(n || 0).toLocaleString()}`;

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
  const year = (payment?.paid_date ? new Date(payment.paid_date) : new Date()).getFullYear();
  const tail = String(payment?.id ?? "").replace(/-/g, "").slice(-6).toUpperCase();
  return `RCP-${year}-${tail || "000001"}`;
}

export async function downloadReceiptPdf(input: ReceiptPdfInput) {
  const { payment, invoice, client, branch, policyNo, receivedBy, allPayments } = input;
  const receiptNo = input.receiptNo ?? deriveReceiptNo(payment);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  // ===== Header band =====
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 110, "F");
  const logo = await loadImage(logoAsset.url);
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 22, 66, 66); } catch { /* ignore */ }
  }
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(AGENCY.name, margin + (logo ? 78 : 0), 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Insurance brokerage & advisory", margin + (logo ? 78 : 0), 68);

  // contact column (right)
  doc.setFontSize(9);
  const rx = pageW - margin;
  doc.text(AGENCY.phone, rx, 38, { align: "right" });
  doc.text(AGENCY.email, rx, 52, { align: "right" });
  doc.text(AGENCY.website, rx, 66, { align: "right" });
  doc.text("Nairobi, Kenya", rx, 80, { align: "right" });

  // ===== RECEIPT title =====
  let y = 144;
  doc.setTextColor(BRAND_DARK); doc.setFont("helvetica", "bold"); doc.setFontSize(28);
  doc.text("RECEIPT", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor("#111827");
  doc.text(`Receipt No.: ${receiptNo}`, margin, y + 18);

  // Date (right)
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("DATE", rx, y - 12, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor("#111827");
  const dateStr = payment?.paid_date ? new Date(payment.paid_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
  doc.text(dateStr, rx, y + 4, { align: "right" });

  y += 44;

  // ===== RECEIVED FROM =====
  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("RECEIVED FROM", margin, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor("#111827");
  doc.text((clientName || "—").toUpperCase(), margin, y + 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(MUTED);
  const fromLines = [client?.phone ?? "", client?.email ?? "", branch?.name ? `${branch.name} branch` : ""].filter(Boolean);
  fromLines.forEach((l, i) => doc.text(String(l), margin, y + 32 + i * 13));

  // ===== AMOUNT RECEIVED (right side) =====
  const total = Number(invoice?.total ?? 0);
  const newPaid = Number(invoice?.amount_paid ?? 0); // post-update value when called after save
  const balance = Math.max(0, total - newPaid);
  const amount = Number(payment?.amount ?? 0);

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("AMOUNT RECEIVED", rx, y, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(BRAND_DARK);
  doc.text(moneyPlain(amount), rx, y + 22, { align: "right" });
  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor("#374151");
  const words = `(${kesInWords(amount)})`;
  const wrapped = doc.splitTextToSize(words, 280);
  doc.text(wrapped, rx, y + 38, { align: "right" });

  // PAID IN FULL / PARTIAL tag
  const tag = balance <= 0.01 ? "PAID IN FULL" : "PARTIAL PAYMENT";
  const tagColor = balance <= 0.01 ? "#047857" : "#b45309";
  const tagY = y + 38 + wrapped.length * 11 + 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(tagColor);
  doc.text(tag, rx, tagY, { align: "right" });

  y += 110;

  // ===== PAYMENT DETAILS =====
  doc.setFillColor("#f1f5f9");
  doc.rect(margin, y, pageW - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(BRAND_DARK);
  doc.text("PAYMENT DETAILS", margin + 10, y + 15);
  y += 34;

  const labelVal = (label: string, val: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(MUTED);
    doc.text(label, x, yy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor("#111827");
    doc.text(val || "—", x, yy + 14);
  };
  const colW = (pageW - margin * 2) / 2;
  labelVal("PAYMENT METHOD", String(payment?.method ?? "—").toUpperCase(), margin, y);
  labelVal("REFERENCE", String(payment?.reference ?? "—"), margin + colW, y);
  y += 36;
  labelVal("INVOICE", String(invoice?.invoice_no ?? "—"), margin, y);
  labelVal("POLICY", String(policyNo ?? "—"), margin + colW, y);
  y += 40;

  // ===== PAYMENT SUMMARY =====
  const priorPaid = Math.max(0, newPaid - amount);
  autoTable(doc, {
    startY: y,
    head: [["PAYMENT SUMMARY", ""]],
    body: [
      ["Invoice total", money(total)],
      ["Previously paid", money(priorPaid)],
      ["This payment", money(amount)],
      ["Total paid to date", money(newPaid)],
      ["Balance", money(balance)],
    ],
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold", halign: "left" },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = balance > 0 ? BRAND_DARK : "#047857";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 24;

  // ===== RECEIVED BY + stamp =====
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("RECEIVED BY", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor("#111827");
  doc.text(receivedBy || "Zest Insurance Agency", margin, y + 16);
  doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("Authorized signatory", margin, y + 30);

  const stamp = await loadImage(stampAsset.url);
  if (stamp) {
    try { doc.addImage(stamp, "PNG", pageW - margin - 110, y - 20, 110, 110); } catch { /* ignore */ }
  }

  y += 80;

  // ===== Terms =====
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(BRAND_DARK);
  doc.text("TERMS & CONDITIONS", margin, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor("#374151");
  const terms = [
    "Payment is acknowledged as per the invoice referenced above.",
    "This receipt is valid for the amount stated above only.",
    "No refund shall be made once payment is processed.",
    "Thank you for choosing Zest Insurance Agency.",
  ];
  terms.forEach((t, i) => doc.text(`• ${t}`, margin, y + 14 + i * 12));

  // ===== Footer =====
  doc.setDrawColor(BRAND); doc.setLineWidth(2);
  doc.line(margin, pageH - 50, pageW - margin, pageH - 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(MUTED);
  doc.text(`${AGENCY.address}  •  ${AGENCY.phone}  •  ${AGENCY.email}`, pageW / 2, pageH - 32, { align: "center" });
  doc.text("Powered by Texcortech Systems", pageW / 2, pageH - 18, { align: "center" });

  const filename = `Receipt-${receiptNo}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}