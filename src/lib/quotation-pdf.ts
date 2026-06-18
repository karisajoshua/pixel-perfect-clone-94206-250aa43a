import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoAsset from "@/assets/zia-logo-white.png.asset.json";

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

const BRAND = "#2563eb";
const BRAND_DARK = "#1e3a8a";
const MUTED = "#6b7280";

const AGENCY_CONTACT = {
  name: "Zest Insurance Agency",
  address: "Ruai, Miranje Hse, Nairobi, Kenya",
  phone: "+254 713 985230",
  email: "info@zestinsurance.co.ke",
};

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

const money = (n: any) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const titleCase = (s: any) => String(s ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function downloadQuotationPdf({ quotation, client, branch, insurer, vehicle }: QuotationPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

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
  doc.text("QUOTATION", pageW - margin, 42, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(quotation.quote_no ?? "", pageW - margin, 60, { align: "right" });

  let y = 120;
  doc.setTextColor("#111827");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FROM", margin, y);
  doc.text("PREPARED FOR", pageW / 2, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED);

  const fromLines = [
    branch?.name ?? AGENCY_CONTACT.name,
    branch?.address ?? AGENCY_CONTACT.address,
    [branch?.phone ?? AGENCY_CONTACT.phone, branch?.email ?? AGENCY_CONTACT.email].filter(Boolean).join(" • "),
  ].filter(Boolean);
  fromLines.forEach((l, i) => doc.text(String(l), margin, y + i * 12));

  const clientName = client?.client_type === "corporate" ? (client?.company_name ?? client?.full_name ?? "") : (client?.full_name ?? "");
  const toLines = [clientName || "—", client?.email ?? "", client?.phone ?? ""].filter(Boolean);
  toLines.forEach((l, i) => doc.text(String(l), pageW / 2, y + i * 12));

  y += Math.max(fromLines.length, toLines.length) * 12 + 16;

  doc.setDrawColor("#e5e7eb");
  doc.setFillColor("#f9fafb");
  doc.roundedRect(margin, y, pageW - margin * 2, 46, 4, 4, "FD");
  const cols: [string, string][] = [
    ["QUOTE DATE", String(quotation.created_at ?? "").slice(0, 10) || "—"],
    ["VALID UNTIL", quotation.valid_until ?? "—"],
    ["STATUS", String(quotation.status ?? "—").toUpperCase()],
    ["INSURER", insurer?.name ?? "—"],
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

  const rows: [string, string][] = [
    ["Product class", titleCase(quotation.product_class)],
    ["Cover type", titleCase(quotation.cover_type)],
  ];
  if (vehicle?.registration_no) {
    const veh = [vehicle.registration_no, [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")].filter(Boolean).join(" — ");
    rows.push(["Vehicle", veh]);
  }
  if (quotation.sum_insured != null) rows.push(["Sum insured", money(quotation.sum_insured)]);

  autoTable(doc, {
    startY: y,
    head: [["Detail", "Value"]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: BRAND, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#fafafa" },
    columnStyles: { 0: { cellWidth: 160, fontStyle: "bold" } },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  const totalsX = pageW - margin - 220;
  const row = (label: string, val: string, opts: { bold?: boolean; color?: string } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.color ?? "#111827");
    doc.setFontSize(10);
    doc.text(label, totalsX, y);
    doc.text(val, pageW - margin, y, { align: "right" });
    y += 16;
  };
  if (quotation.premium_net != null) row("Net premium", money(quotation.premium_net));
  doc.setDrawColor("#e5e7eb"); doc.line(totalsX, y - 8, pageW - margin, y - 8);
  row("Gross premium", money(quotation.premium_gross), { bold: true, color: BRAND_DARK });

  if (quotation.notes) {
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setTextColor("#111827"); doc.setFontSize(11);
    doc.text("Notes", margin, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setTextColor(MUTED); doc.setFontSize(10);
    const wrapped = doc.splitTextToSize(String(quotation.notes), pageW - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 12;
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BRAND); doc.setLineWidth(2);
  doc.line(margin, pageH - 50, pageW - margin, pageH - 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(MUTED);
  doc.text("This quotation is indicative and subject to underwriter approval.", margin, pageH - 32);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW - margin, pageH - 32, { align: "right" });
  doc.setFontSize(8);
  doc.text(
    `${AGENCY_CONTACT.address}  •  ${AGENCY_CONTACT.phone}  •  ${AGENCY_CONTACT.email}`,
    pageW / 2,
    pageH - 22,
    { align: "center" },
  );
  doc.text("Powered by Texcortech Systems", pageW / 2, pageH - 10, { align: "center" });

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