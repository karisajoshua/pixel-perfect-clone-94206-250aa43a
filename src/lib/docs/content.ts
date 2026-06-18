export type DocSection = {
  id: string;
  title: string;
  route?: string;
  summary: string;
  body: string;
};

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    route: "/dashboard",
    summary: "Set up branches, invite staff, and start adding clients.",
    body: `Onboarding order:\n\n1. **Branches** — Admin → Branches. Create at least one branch; all policies and invoices are tagged to a branch.\n2. **Users & roles** — Admin → Users. Invite staff and assign roles (admin, manager, agent, accountant, client).\n3. **Insurers** — Admin → Insurers. Add the underwriters you place business with.\n4. **Clients** — start capturing clients and their KYC documents.\n5. **Vehicles → Quotations → Policies → Invoices → Claims** is the typical workflow.`,
  },
  {
    id: "clients",
    title: "Clients & KYC",
    route: "/clients",
    summary: "Individual and corporate clients with KYC documents and communications.",
    body: `Use the **New client** button to add individual or corporate clients. The client page shows policies, vehicles, claims, invoices, KYC documents, and an audit of communications. Use **Export** to download CSV.`,
  },
  {
    id: "vehicles",
    title: "Vehicles",
    route: "/vehicles",
    summary: "Vehicles attached to a client for motor policies.",
    body: `Each vehicle belongs to a client. Capture registration, make/model/year, value, and use this vehicle when issuing a motor quotation or policy.`,
  },
  {
    id: "policies",
    title: "Policies",
    route: "/policies",
    summary: "Active and lapsed policies with renewal tracking.",
    body: `Policies are issued against a client, insurer, and (optionally) vehicle. The system tracks start/end dates and surfaces upcoming renewals in **Renewals**.`,
  },
  {
    id: "quotations",
    title: "Quotations",
    route: "/quotations",
    summary: "Prepare and send underwriter quotations as PDFs.",
    body: `Create a quotation for a client. Use **Download PDF** to generate a branded quotation document, or **Send** to email it. Quotations can be converted to policies once accepted.`,
  },
  {
    id: "invoices",
    title: "Invoices & payments",
    route: "/invoices",
    summary: "Issue invoices, record payments, and email PDFs to clients.",
    body: `Invoices link to a policy and a client. Add line items, record payments (M-Pesa, bank, cheque, cash) and the balance updates automatically. **Download PDF** produces a branded invoice with the agency address and contact details.`,
  },
  {
    id: "claims",
    title: "Claims",
    route: "/claims",
    summary: "Log claims, acknowledge them, and track status to settlement.",
    body: `Open a claim against a policy. The acknowledgement email goes to the client automatically. Use the status field to move claims through reported → assessment → settled / rejected.`,
  },
  {
    id: "renewals",
    title: "Renewals",
    route: "/renewals",
    summary: "Upcoming policy expirations in the next 30/60/90 days.",
    body: `The renewals queue shows policies due. Trigger reminders manually or rely on the daily cron that emails clients via the renewal-reminder template.`,
  },
  {
    id: "reports",
    title: "Reports",
    route: "/reports",
    summary: "Revenue, production, and claims reporting.",
    body: `Drill into revenue by branch, by insurer, and by product class. Export the underlying data as CSV for accounting.`,
  },
  {
    id: "admin-branches",
    title: "Admin — Branches",
    route: "/admin/branches",
    summary: "Manage branch offices used across the system.",
    body: `A branch carries its own address, phone, and email which override the default agency contact on invoices and quotations.`,
  },
  {
    id: "admin-users",
    title: "Admin — Users & Roles",
    route: "/admin/users",
    summary: "Invite staff and assign roles.",
    body: `Roles: **admin** (full access), **manager**, **agent**, **accountant**, **client** (portal only). Roles are stored separately from profiles — change them here.`,
  },
  {
    id: "admin-insurers",
    title: "Admin — Insurers",
    route: "/admin/insurers",
    summary: "Underwriters you place business with.",
    body: `Insurers appear as choices on quotations and policies. Add their contact details so claims correspondence flows correctly.`,
  },
  {
    id: "admin-emails",
    title: "Admin — Email log",
    route: "/admin/emails",
    summary: "Audit trail of every transactional and auth email sent.",
    body: `Every email — welcome, magic link, invoice issued, renewal reminder, claim acknowledgement — is logged with delivery status. Use this to troubleshoot delivery problems.`,
  },
  {
    id: "admin-notifications",
    title: "Admin — Notifications",
    route: "/admin/notifications",
    summary: "System notification templates and cron schedules.",
    body: `Configure the renewal reminder cadence and other automated outbound communications.`,
  },
  {
    id: "admin-audit",
    title: "Admin — Audit log",
    route: "/admin/audit",
    summary: "Who did what and when.",
    body: `Every create / update / delete on key tables is recorded with the actor and timestamp.`,
  },
  {
    id: "admin-import",
    title: "Admin — Data import",
    route: "/admin/import",
    summary: "Bulk-import clients, vehicles, and policies from CSV / Excel.",
    body: `Download the template, fill in your records, and upload. The importer validates required fields before committing.`,
  },
  {
    id: "portal",
    title: "Client portal",
    route: "/portal",
    summary: "What the client sees when they sign in.",
    body: `Clients see their policies, vehicles, invoices, claims, and documents. They cannot see other clients' data.`,
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    summary: "Ask questions in plain English and get pointed to the right page.",
    body: `Tap the chat icon at the bottom-right of any page. Ask things like "how do I issue a renewal reminder?" or "where do I add a new insurer?" — the assistant answers from this documentation and gives you a one-click button to navigate there.`,
  },
  {
    id: "pdfs",
    title: "PDF documents",
    summary: "Branded invoices and quotations.",
    body: `PDFs include the Zest logo, branch address (or the default agency contact: Ruai, Miranje Hse, Nairobi, Kenya • +254 713 985230 • info@zestinsurance.co.ke), and a Texcortech footer. The address used is the branch on the policy, falling back to the agency default.`,
  },
  {
    id: "troubleshooting",
    title: "FAQ & troubleshooting",
    summary: "Common issues and how to resolve them.",
    body: `**Client can't sign in:** confirm the invite email arrived (Admin → Email log) and they used the magic link.\n\n**Email not delivered:** check Admin → Email log for the error message and verify the recipient address.\n\n**Wrong total on invoice:** verify line items and tax; balance recalculates after each payment.`,
  },
];

export function findRelevantDocs(query: string, max = 5): DocSection[] {
  const q = query.toLowerCase();
  const scored = DOC_SECTIONS.map((s) => {
    const hay = `${s.title} ${s.summary} ${s.body}`.toLowerCase();
    let score = 0;
    for (const word of q.split(/\s+/).filter(Boolean)) {
      if (hay.includes(word)) score += 1;
      if (s.title.toLowerCase().includes(word)) score += 2;
    }
    return { s, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
  return scored;
}

export function docsAsContext(): string {
  return DOC_SECTIONS.map(
    (s) => `## ${s.title}${s.route ? ` (route: ${s.route})` : ""}\n${s.summary}\n${s.body}`,
  ).join("\n\n");
}