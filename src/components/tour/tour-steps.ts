export type TourStep = {
  id: string;
  /** Route to navigate to before showing this step. Omit to stay on the current page. */
  path?: string;
  /** CSS selector of the element to spotlight. Omit for a centered card. */
  selector?: string;
  title: string;
  body: string;
  /** Only show for these roles (any match). Omit for everyone. */
  roles?: string[];
};

export const STAFF_TOUR_ID = "staff-v1";
export const PORTAL_TOUR_ID = "portal-v1";

export const staffTourSteps: TourStep[] = [
  {
    id: "dashboard",
    path: "/dashboard",
    selector: '[data-tour="nav-/dashboard"]',
    title: "Your dashboard",
    body: "Start here every morning: live numbers for clients, policies, renewals and money collected.",
  },
  {
    id: "clients-nav",
    path: "/clients",
    selector: '[data-tour="nav-/clients"]',
    title: "Clients come first",
    body: "Everything in the system hangs off a client — vehicles, quotes, policies, invoices and claims.",
  },
  {
    id: "clients-new",
    path: "/clients",
    selector: '[data-tour="clients-new"]',
    title: "Onboard a client",
    body: "Click here to capture a new client. You can verify their KRA PIN right inside the form.",
  },
  {
    id: "clients-search",
    path: "/clients",
    selector: '[data-tour="clients-search"]',
    title: "Find anyone fast",
    body: "Search the full client database by name, ID number, KRA PIN or phone. Open a client to manage their vehicles, KYC documents and cover details.",
  },
  {
    id: "quotations",
    path: "/quotations",
    selector: '[data-tour="quotations-new"]',
    title: "Quote in seconds",
    body: "Create a quote, choose the cover type and term, then send the branded PDF. Approved quotes convert straight into a policy.",
  },
  {
    id: "policies",
    path: "/policies",
    selector: '[data-tour="policies-new"]',
    title: "Policies live here",
    body: "Converted quotes land here automatically. Open a policy to record payment extensions, edit cover terms or cancel with a reason.",
  },
  {
    id: "invoices",
    path: "/invoices",
    selector: '[data-tour="invoices-new"]',
    title: "Bill and get paid",
    body: "Raise an invoice against a client or policy. Every downloaded invoice carries a QR code anyone can scan to verify it.",
  },
  {
    id: "claims",
    path: "/claims",
    selector: '[data-tour="claims-new"]',
    title: "File a claim",
    body: "Log an incident and the client's policy and vehicle prefill for you. Track it through to settlement.",
  },
  {
    id: "renewals",
    path: "/renewals",
    selector: '[data-tour="nav-/renewals"]',
    title: "Never miss a renewal",
    body: "Policies expiring soon are queued here so you can call the client before the cover lapses.",
  },
  {
    id: "reports",
    path: "/reports",
    selector: '[data-tour="nav-/reports"]',
    title: "Reports",
    body: "Production, collections and branch performance — exportable whenever you need them.",
  },
  {
    id: "admin-users",
    path: "/admin/users",
    selector: '[data-tour="nav-/admin/users"]',
    title: "Your team",
    body: "Invite staff and set what each person can do: admin, manager, agent or viewer.",
    roles: ["admin"],
  },
  {
    id: "admin-branches",
    path: "/admin/branches",
    selector: '[data-tour="nav-/admin/branches"]',
    title: "Branches",
    body: "Add your branches here. Dashboard numbers and staff access are scoped per branch.",
    roles: ["admin"],
  },
  {
    id: "admin-tenant",
    path: "/admin/tenant",
    selector: '[data-tour="nav-/admin/tenant"]',
    title: "Make it yours",
    body: "Upload your logo and stamp, set brand colours and payment details — they appear on every quote, invoice and receipt.",
    roles: ["admin"],
  },
  {
    id: "done",
    path: "/dashboard",
    title: "You're all set",
    body: "That's the whole workspace. You can replay this tour any time from the sidebar.",
  },
];

export const portalTourSteps: TourStep[] = [
  {
    id: "overview",
    path: "/portal",
    selector: '[data-tour="portal-nav-/portal"]',
    title: "Your overview",
    body: "A snapshot of your cover: what's active, what's due and anything that needs your attention.",
  },
  {
    id: "policies",
    path: "/portal/policies",
    selector: '[data-tour="portal-nav-/portal/policies"]',
    title: "Your policies",
    body: "View each policy, its dates and download your documents.",
  },
  {
    id: "vehicles",
    path: "/portal/vehicles",
    selector: '[data-tour="portal-nav-/portal/vehicles"]',
    title: "Your vehicles",
    body: "Every insured vehicle, with its cover details and required documents.",
  },
  {
    id: "invoices",
    path: "/portal/invoices",
    selector: '[data-tour="portal-nav-/portal/invoices"]',
    title: "Invoices",
    body: "See what's outstanding and download receipts for anything you've paid.",
  },
  {
    id: "claims",
    path: "/portal/claims",
    selector: '[data-tour="portal-nav-/portal/claims"]',
    title: "Claims",
    body: "Report an incident and follow your claim through to settlement.",
  },
  {
    id: "done",
    path: "/portal",
    title: "You're all set",
    body: "That's it. You can replay this tour any time from your account menu.",
  },
];