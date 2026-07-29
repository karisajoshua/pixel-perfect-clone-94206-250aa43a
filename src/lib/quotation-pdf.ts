import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/zia-logo-white.png.asset.json";
import stampAsset from "@/assets/zest-stamp.png.asset.json";
import { getCurrentBrand } from "./tenant-brand";

type Branch = { name?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null | undefined;
type Client = { full_name?: string | null; company_name?: string | null; client_type?: string | null; email?: string | null; phone?: string | null } | null | undefined;
type Insurer = { name?: string | null } | null | undefined;
type Vehicle = { registration_no?: string | null; make?: string | null; model?: string | null; year?: number | null } | null | undefined;

export type QuotationPdfInput = {
  quotation: any;
  client?: Client;
  branch?: Branch;
  insurer?: Insurer;
  vehicle?: Vehicle;
};

const MUTED = "#6b7280";

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

const money = (n: any) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: any, d = 0) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const titleCase = (s: any) => String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function downloadQuotationPdf({ quotation, client, branch, insurer, vehicle }: QuotationPdfInput) {
  const brand = await getCurrentBrand();
  const BRAND = brand.primary;
  const BRAND_DARK = brand.secondary;
  const AGENCY_CONTACT = { name: brand.name, address: brand.address, phone: brand.phone, email: brand.email };

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;

  // ===== Header band =====
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 110, "F");

  const logo = await loadImage(brand.logo_url || logoAsset.url);
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 18, 70, 70); } catch { /* ignore */ }
  }

  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const headerX = margin + 110;
  doc.text(`Quotation provided by: ${insurer?.name ?? "—"}`, headerX, 38);
  doc.text(`CLIENT NAME: ${(clientName || "—").toUpperCase()}`, headerX, 62);
  doc.text(`AGENT NAME: ${brand.name.toUpperCase()}`, headerX, 86);

  // ===== Build table data =====
  const li = (quotation.line_items ?? {}) as any;
  const ratePct = Number(li.rate_pct ?? 0);
  const levies = Number(li.levies ?? 0);
  const benefits: string[] = Array.isArray(li.benefits) ? li.benefits : [];
  const sumInsured = Number(quotation.sum_insured ?? 0);
  const basePremium = +(sumInsured * (ratePct / 100)).toFixed(2);
  const benefitRatePct = li.benefit_rate_pct === undefined || li.benefit_rate_pct === null || li.benefit_rate_pct === ""
    ? 0.25
    : Number(li.benefit_rate_pct);
  const benefitUnit = +(sumInsured * (benefitRatePct / 100)).toFixed(2);
  const benefitsTotal = +(benefitUnit * benefits.length).toFixed(2);
  const pllAmount = li.pll_enabled ? Number(li.pll_amount ?? 0) : 0;
  const paAmount = li.pa_enabled ? Number(li.pa_amount ?? 0) : 0;
  const grossPremium = +(basePremium + benefitsTotal + pllAmount + paAmount).toFixed(2);
  const total = +(grossPremium + levies).toFixed(2);

  const coverLabel = `${titleCase(quotation.product_class)}\n${titleCase(quotation.cover_type)}`;

  const remarks = [
    { title: "What you get in the policy", lines: [
      "Third party persons injury: As per statute",
      "Third party property damage: KES. 5,000,000",
      "Passenger legal liability per person: KES. 3,000,000",
      "Total passenger legal liability: KES. 20,000,000",
      "Windscreen free limit: KES. 50,000",
      "Towing charges: KES. 30,000",
      "Repair authority: KES. 50,000",
      "Medical expenses: KES. 30,000",
      "Entertainment free limit: KES. 50,000",
      "Riot and strike: Free",
    ]},
    { title: "Additional policy details", lines: [
      "For Audi, Mazda, Subaru and Volkswagen — basic rate loaded 30% on onboarding.",
      "Own damage claims: 2.5% of value min. KES. 5,000",
      "Theft (with ATD): 10% of value min. KES. 20,000",
      "Theft (without ATD): 20% of value min. KES. 20,000",
      "Theft (with tracking device): 2.5% of value min. KES. 20,000",
      "Third party injury claims: Nil.",
      "Third party property damage: KES. 10,000",
      "New and young drivers: KES. 7,500 additional",
    ]},
  ];

  const body: any[] = [];
  const extras: Array<{ label: string; amount: number }> = [];
  if (pllAmount > 0) extras.push({ label: "Passenger Legal Liability (PLL)", amount: pllAmount });
  if (paAmount > 0) extras.push({ label: "Personal Accident (PA)", amount: paAmount });
  const totalRows = Math.max(benefits.length, 1) + extras.length + 1;
  body.push([
    { content: coverLabel, rowSpan: totalRows, styles: { fontStyle: "bold", valign: "top", fillColor: "#eaf2ff" } },
    "",
    num(sumInsured),
    String(ratePct),
    num(basePremium),
    "",
    "",
  ]);
  if (benefits.length === 0) {
    body.push(["", "", "", "", "", ""]);
  } else {
    benefits.forEach((b) => {
      body.push([b, num(sumInsured), String(benefitRatePct), num(benefitUnit), "", ""]);
    });
  }
  extras.forEach((e) => {
    body.push([e.label, "", "", num(e.amount), "", ""]);
  });
  // Totals row
  body.push([
    { content: "Total premium payable", colSpan: 4, styles: { fontStyle: "bold", halign: "right", fillColor: "#f3f6fb" } },
    { content: num(grossPremium), styles: { fontStyle: "bold", fillColor: "#f3f6fb" } },
    { content: num(levies), styles: { fontStyle: "bold", fillColor: "#f3f6fb" } },
    { content: num(total), styles: { fontStyle: "bold", fillColor: "#f3f6fb" } },
  ]);



  autoTable(doc, {
    startY: 120,
    margin: { left: margin, right: margin },
    head: [["Class of insurance", "Additional benefits", "Sum insured", "Rate %", "Premium", "Levies", "Total"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, lineColor: "#d7e1ee", lineWidth: 0.5, textColor: "#111827", overflow: "linebreak" },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold", halign: "center", valign: "middle" },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 180 },
      2: { cellWidth: 100, halign: "right" },
      3: { cellWidth: 60, halign: "right" },
      4: { cellWidth: 90, halign: "right" },
      5: { cellWidth: 80, halign: "right" },
      6: { cellWidth: "auto", halign: "right" },
    },
  });

  // ===== Remarks section (rendered below the table) =====
  let ry = (doc as any).lastAutoTable.finalY + 16;
  const colW = (pageW - margin * 2 - 16) / 2;
  const startY = ry;
  let maxBottom = ry;
  remarks.forEach((section, idx) => {
    const cx = margin + idx * (colW + 16);
    let cy = startY;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(BRAND_DARK);
    doc.text(section.title, cx, cy);
    cy += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor("#1f3a68");
    section.lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(`• ${line}`, colW);
      doc.text(wrapped, cx, cy);
      cy += wrapped.length * 11;
    });
    if (cy > maxBottom) maxBottom = cy;
  });

  // ===== Payment details + stamp =====
  const footerH = 95;
  const footerY = pageH - footerH;

  let payY = maxBottom + 16;
  const payH = 70;
  // If not enough room above footer, push to new page
  if (payY + payH > footerY - 10) {
    doc.addPage();
    payY = margin + 10;
  }
  const payW = 400;
  // Payment panel
  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.8);
  doc.setFillColor("#eaf2ff");
  doc.roundedRect(margin, payY, payW, payH, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND_DARK);
  doc.text("Payment Details", margin + 12, payY + 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Safaricom Till Number:", margin + 12, payY + 36);
  doc.setFont("helvetica", "normal");
  doc.text("603830", margin + 145, payY + 36);
  doc.setFont("helvetica", "bold");
  doc.text("KCB Paybill:", margin + 12, payY + 52);
  doc.setFont("helvetica", "normal");
  doc.text("522533", margin + 145, payY + 52);
  doc.setFont("helvetica", "bold");
  doc.text("Account Number:", margin + 230, payY + 52);
  doc.setFont("helvetica", "normal");
  doc.text("1211118266", margin + 330, payY + 52);

  // Stamp (right side)
  const stamp = await loadImage(stampAsset.url);
  const stampSize = 110;
  const stampX = pageW - margin - stampSize;
  const stampY = payY + (payH / 2) - (stampSize / 2);
  if (stamp) {
    try { doc.addImage(stamp, "PNG", stampX, stampY, stampSize, stampSize); } catch { /* ignore */ }
  }

  // ===== Footer band =====
  doc.setFillColor(BRAND);
  doc.rect(0, footerY, pageW, footerH, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("** Subject to our standard policy terms, conditions and exceptions", margin, footerY + 20);
  doc.setFont("helvetica", "normal");
  doc.text(`Email: ${branch?.email ?? AGENCY_CONTACT.email}`, margin, footerY + 36);
  doc.text(`Contacts: ${branch?.phone ?? AGENCY_CONTACT.phone}`, margin, footerY + 50);
  doc.setFont("helvetica", "bold");
  doc.text("This quotation is valid for 30 days", margin, footerY + 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`This is a system generated document on ${new Date().toISOString()}`, margin, footerY + 84);
  doc.text("Powered by Texcortech Systems", pageW - margin, footerY + 84, { align: "right" });

  const filename = `Quotation-${quotation.quote_no ?? quotation.id}.pdf`;
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