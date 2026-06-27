import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/zest-icon-512.png.asset.json";
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

const ORANGE = "#f37021";
const BLACK = "#0d0d0d";
const DARK = "#1a1a1a";
const MUTED = "#6b7280";
const LIGHT = "#f5f5f5";

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

  const total = Number(invoice?.total ?? 0);
  const newPaid = Number(invoice?.amount_paid ?? 0);
  const balance = Math.max(0, total - newPaid);
  const amount = Number(payment?.amount ?? 0);
  const priorPaid = Math.max(0, newPaid - amount);
  const isFull = balance <= 0.01;

  // ===== Header: black angled panel right with contact info =====
  // Black polygon on right
  const panelLeft = pageW * 0.45;
  doc.setFillColor(BLACK);
  doc.triangle(panelLeft, 0, panelLeft + 60, 0, panelLeft, 60, "F");
  doc.rect(panelLeft + 60, 0, pageW - panelLeft - 60, 170, "F");
  doc.setFillColor(BLACK);
  doc.rect(panelLeft + 30, 60, pageW - panelLeft - 30, 110, "F");
  // small orange accent triangle top
  doc.setFillColor(ORANGE);
  doc.triangle(panelLeft + 60, 0, panelLeft + 120, 0, panelLeft + 60, 30, "F");

  // Logo (top-left)
  const logo = await loadImage(logoAsset.url);
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 30, 70, 70); } catch {}
  }
  // Agency name
  doc.setTextColor(BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("ZEST", margin + 84, 60);
  doc.setTextColor(ORANGE);
  doc.text("INSURANCE", margin + 84 + doc.getTextWidth("ZEST") + 4, 60);
  doc.setTextColor(BLACK); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("AGENCY", margin + 84, 78);
  // tagline
  doc.setDrawColor(ORANGE); doc.setLineWidth(1);
  doc.line(margin + 84, 88, margin + 200, 88);
  doc.setFontSize(8); doc.setTextColor(DARK);
  doc.text("INSURANCE BROKERAGE & ADVISORY", margin + 84, 100);

  // Contact info (in black panel, orange icons replaced with bullets)
  const cx = panelLeft + 80;
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const contactItems = [
    { icon: "\u260E", text: AGENCY.phone },
    { icon: "\u2709", text: AGENCY.email },
    { icon: "\u2318", text: AGENCY.website },
    { icon: "\u25C9", text: "Nairobi, Kenya" },
  ];
  contactItems.forEach((item, i) => {
    const yy = 78 + i * 20;
    doc.setTextColor(ORANGE); doc.setFontSize(11);
    doc.text(item.icon, cx - 18, yy);
    doc.setTextColor("#ffffff"); doc.setFontSize(10);
    doc.text(item.text, cx, yy);
  });

  // ===== RECEIPT title =====
  let y = 210;
  doc.setTextColor(BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(40);
  doc.text("RECEIPT", margin, y);
  // orange underline
  doc.setDrawColor(ORANGE); doc.setLineWidth(3);
  doc.line(margin, y + 8, margin + 90, y + 8);

  // Receipt No pill
  y += 32;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(DARK);
  doc.text("Receipt No.:", margin, y);
  const rnX = margin + doc.getTextWidth("Receipt No.:") + 10;
  doc.setFillColor(BLACK);
  doc.roundedRect(rnX, y - 14, 140, 22, 4, 4, "F");
  doc.setTextColor(ORANGE); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(receiptNo, rnX + 70, y + 1, { align: "center" });

  // Date block (right)
  const rx = pageW - margin;
  doc.setFillColor(BLACK);
  doc.circle(rx - 130, y - 8, 14, "F");
  doc.setTextColor(ORANGE); doc.setFontSize(14);
  doc.text("\u25A4", rx - 130, y - 4, { align: "center" });
  doc.setTextColor(BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("DATE", rx - 110, y - 10);
  doc.setTextColor(ORANGE); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  const dateStr = payment?.paid_date ? new Date(payment.paid_date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
  doc.text(dateStr, rx - 110, y + 6);

  y += 40;

  // ===== Two columns: RECEIVED FROM (left) + AMOUNT RECEIVED card (right) =====
  const leftW = (pageW - margin * 2) * 0.42;
  const rightX = margin + leftW + 24;
  const rightW = pageW - margin - rightX;

  // Left: avatar circle
  doc.setFillColor(ORANGE);
  doc.circle(margin + 18, y + 18, 18, "F");
  doc.setTextColor("#ffffff"); doc.setFontSize(18);
  doc.text("\u2638", margin + 18, y + 23, { align: "center" });

  doc.setTextColor(ORANGE); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("RECEIVED FROM", margin + 48, y + 8);
  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  doc.setTextColor(BLACK); doc.setFontSize(14);
  doc.text((clientName || "—").toUpperCase(), margin + 48, y + 28);

  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(DARK);
  const fromItems = [
    { i: "\u260E", t: client?.phone ?? "" },
    { i: "\u2709", t: client?.email ?? "" },
    { i: "\u25C9", t: branch?.name ? `${branch.name} branch` : "Nairobi" },
  ].filter(x => x.t);
  fromItems.forEach((it, i) => {
    const yy = y + 50 + i * 18;
    doc.setTextColor(ORANGE); doc.text(it.i, margin + 48, yy);
    doc.setTextColor(DARK); doc.text(String(it.t), margin + 64, yy);
  });

  // Right: AMOUNT card
  const cardY = y;
  const cardH = 130;
  // border
  doc.setDrawColor("#e5e5e5"); doc.setLineWidth(1);
  doc.roundedRect(rightX, cardY, rightW, cardH, 6, 6, "S");
  // header black band
  doc.setFillColor(BLACK);
  doc.roundedRect(rightX, cardY, rightW, 28, 6, 6, "F");
  doc.rect(rightX, cardY + 14, rightW, 14, "F");
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("AMOUNT RECEIVED", rightX + rightW / 2, cardY + 19, { align: "center" });
  // amount
  doc.setTextColor(ORANGE); doc.setFontSize(28);
  doc.text(moneyPlain(amount), rightX + rightW / 2, cardY + 60, { align: "center" });
  // words
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(DARK);
  const words = `(${kesInWords(amount)})`;
  const wrapped = doc.splitTextToSize(words, rightW - 30);
  doc.text(wrapped, rightX + rightW / 2, cardY + 78, { align: "center" });
  // status orange band
  doc.setFillColor(ORANGE);
  doc.roundedRect(rightX + 8, cardY + cardH - 38, rightW - 16, 32, 4, 4, "F");
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(isFull ? "\u2714  PAID IN FULL" : "\u26A0  PARTIAL PAYMENT", rightX + rightW / 2, cardY + cardH - 17, { align: "center" });

  y = cardY + cardH + 30;

  // ===== PAYMENT DETAILS =====
  // Tab label
  doc.setFillColor(BLACK);
  doc.roundedRect(margin, y, 160, 26, 4, 4, "F");
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("PAYMENT DETAILS", margin + 12, y + 17);
  // Rounded panel
  const pdY = y + 16;
  const pdH = 86;
  doc.setDrawColor("#e5e5e5");
  doc.roundedRect(margin, pdY, pageW - margin * 2, pdH, 6, 6, "S");

  const col4W = (pageW - margin * 2) / 4;
  const drawDetail = (label: string, val: string, icon: string, idx: number) => {
    const cxc = margin + col4W * idx + col4W / 2;
    const cyc = pdY + 22;
    doc.setFillColor(ORANGE); doc.circle(cxc, cyc, 12, "F");
    doc.setTextColor("#ffffff"); doc.setFontSize(12);
    doc.text(icon, cxc, cyc + 4, { align: "center" });
    doc.setTextColor(BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(label, cxc, cyc + 26, { align: "center" });
    doc.setTextColor(ORANGE); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const wrapVal = doc.splitTextToSize(val || "—", col4W - 12);
    doc.text(wrapVal, cxc, cyc + 40, { align: "center" });
    // divider
    if (idx < 3) {
      doc.setDrawColor("#e5e5e5");
      doc.line(margin + col4W * (idx + 1), pdY + 12, margin + col4W * (idx + 1), pdY + pdH - 12);
    }
  };
  const payDate = payment?.paid_date ? new Date(payment.paid_date).toLocaleDateString("en-GB") : "";
  drawDetail("PAYMENT METHOD", String(payment?.method ?? "—").toUpperCase(), "$", 0);
  drawDetail("REFERENCE", String(payment?.reference ?? "—"), "#", 1);
  drawDetail("INVOICE", String(invoice?.invoice_no ?? "—"), "\u25A4", 2);
  drawDetail("POLICY", String(policyNo ?? payDate ?? "—"), "\u2630", 3);

  y = pdY + pdH + 24;

  // ===== PAYMENT SUMMARY (left) + RECEIVED BY (right) =====
  const sumW = (pageW - margin * 2) * 0.48;
  const recvX = margin + sumW + 16;
  const recvW = pageW - margin - recvX;

  // Summary table
  autoTable(doc, {
    startY: y,
    head: [["PAYMENT SUMMARY", ""]],
    body: [
      ["Invoice total", money(total)],
      ["Previously paid", money(priorPaid)],
      ["This payment", money(amount)],
      ["Total paid", money(newPaid)],
      ["Balance", money(balance)],
    ],
    styles: { fontSize: 10, cellPadding: 7, lineColor: "#e5e5e5", lineWidth: 0.5 },
    headStyles: { fillColor: BLACK, textColor: "#ffffff", fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
    margin: { left: margin, right: pageW - margin - sumW },
    tableWidth: sumW,
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.row.index === 3) {
          data.cell.styles.fillColor = ORANGE;
          data.cell.styles.textColor = "#ffffff";
          data.cell.styles.fontStyle = "bold";
        }
        if (data.row.index === 4) {
          data.cell.styles.fillColor = BLACK;
          data.cell.styles.textColor = "#ffffff";
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  const sumEnd = (doc as any).lastAutoTable.finalY;

  // Received by panel
  doc.setDrawColor("#e5e5e5");
  doc.roundedRect(recvX, y, recvW, sumEnd - y, 6, 6, "S");
  doc.setTextColor(ORANGE); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("RECEIVED BY", recvX + 14, y + 22);
  // signature line
  doc.setDrawColor("#bfbfbf"); doc.setLineWidth(0.8);
  doc.line(recvX + 14, y + 70, recvX + recvW - 130, y + 70);
  doc.setTextColor(BLACK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(receivedBy || AGENCY.name, recvX + 14, y + 86);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("Authorized Signatory", recvX + 14, y + 100);
  // stamp
  const stamp = await loadImage(stampAsset.url);
  if (stamp) {
    try { doc.addImage(stamp, "PNG", recvX + recvW - 110, y + 8, 100, 100); } catch {}
  }

  y = sumEnd + 24;

  // ===== Terms =====
  doc.setFillColor(BLACK);
  doc.circle(margin + 14, y + 8, 14, "F");
  doc.setTextColor(ORANGE); doc.setFontSize(14);
  doc.text("\u2630", margin + 14, y + 12, { align: "center" });
  doc.setTextColor(ORANGE); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("TERMS & CONDITIONS", margin + 36, y + 4);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(DARK);
  const terms = [
    "Payment is acknowledged in full as per the invoice.",
    "This receipt is valid for the amount stated above only.",
    "No refund shall be made once payment is processed.",
    "Thank you for choosing Zest Insurance Agency.",
  ];
  terms.forEach((t, i) => doc.text(`\u2022 ${t}`, margin + 36, y + 20 + i * 12));

  // ===== Footer band =====
  const fY = pageH - 36;
  doc.setFillColor(BLACK);
  doc.rect(0, fY, pageW * 0.45, 36, "F");
  doc.setFillColor(ORANGE);
  doc.triangle(pageW * 0.45, fY, pageW * 0.45 + 30, fY, pageW * 0.45, fY + 36, "F");
  doc.rect(pageW * 0.45 + 30, fY, pageW - pageW * 0.45 - 30, 36, "F");
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("INSURE.", margin, fY + 22);
  doc.text("PROTECT.", margin + 60, fY + 22);
  doc.setTextColor(BLACK);
  doc.text("THRIVE.", margin + 130, fY + 22);
  doc.setTextColor("#ffffff"); doc.setFont("helvetica", "italic"); doc.setFontSize(11);
  doc.text("Thank you for your trust in Zest Insurance Agency.", pageW * 0.72, fY + 22, { align: "center" });

  const filename = `Receipt-${receiptNo}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}