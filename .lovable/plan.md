## 1. Brand the platform with the ZIA logo

**Two logo assets** (both via Lovable Assets / CDN, imported as JSON pointers):

- `zia-logo-white.png` — the uploaded white-on-transparent file. Used on dark surfaces: sidebar, auth page header band, email header (over a slate panel).
- `zia-logo-red.png` — generated from the upload via `imagegen--edit_image`, recolored to brand red + slate (no white outlines), for light surfaces: PDFs, reports, browser favicon, public landing.

**Placements**
- `src/components/app-shell.tsx` — replace the "Z" tile with the white logo (h-9) next to the wordmark.
- `src/routes/index.tsx` (auth page) — center the white logo over the existing slate hero band; remove the placeholder mark.
- `src/routes/__root.tsx` — set favicon to the red variant (32x32 pulled from CDN URL).
- Email templates (`src/lib/email-templates/*.tsx`) — header `<Img>` uses the white logo on the existing dark band.
- Reports PDF + any future server-rendered PDF — use the red variant via the asset's CDN URL.
- `<title>` and OG metadata stay as "Zest Insurance Agency".

## 2. Reports & Analytics module (replaces the stub at `/reports`)

Real route at `src/routes/_authenticated/reports.tsx`, role-gated to admin + manager (agents redirected to dashboard). Built with **Recharts** (already a transitive dep; install if missing).

### Layout

```text
[ PageHeader: Reports & analytics ]
[ Date range picker | Branch filter | Export PDF | Export CSV ]

[ KPI row: Revenue (period) | Active policies | New clients | Open claims | Renewal hit rate ]

[ Row 1 ]
  - Revenue over time         (area chart, monthly buckets)
  - Policies by status        (donut)

[ Row 2 ]
  - Insurer portfolio share   (horizontal bar — premium written per insurer)
  - Claims funnel             (bar: reported → assessed → approved → paid)

[ Row 3 ]
  - Branch performance table  (branch | policies | premium | claims | renewal %)
  - Top agents                (table: agent | policies sold | premium written)
```

### Data

One server function `getReportsSummary({ from, to, branchId? })` in `src/lib/reports.functions.ts` using `requireSupabaseAuth`. It runs parallel `supabase` aggregations against `policies`, `invoices`, `payments`, `claims`, `clients`, `profiles`, `branches`, `insurers`, returns a single typed payload. Cached with TanStack Query (`staleTime: 60_000`).

### Export

- **CSV** — client-side: flatten the summary to rows, trigger download via Blob.
- **PDF** — branded server-rendered PDF using `@react-pdf/renderer` (works in Workers) at `src/routes/api/public/reports/export.ts` (signed-token guarded: pass a one-shot token created via a `createSignedReportToken` server fn). Header band uses the red logo + report title + date range + generated-at timestamp. Body mirrors the on-screen sections as simple tables/bars.

### Empty / loading states

Skeleton on initial fetch; empty-state card per chart when the period has no data ("No revenue recorded between X and Y"). Also adds an empty-state to the existing Renewals page ("No upcoming renewals in the next 60 days") so the answer to last turn's question lands here.

## 3. Out of scope this turn (Phase 4/5 remainder)

Not building now: branded PDFs for quotation/policy/invoice/receipt, client portal (`/portal`), 2FA, HIBP, signed storage URLs, mobile pass, in-app help drawer, seed demo data. Each can be its own follow-up.

## Technical notes

- Asset pointers live at `src/assets/zia-logo-white.png.asset.json` and `src/assets/zia-logo-red.png.asset.json`; imports use `heroAsset.url`.
- Red variant prompt for `imagegen--edit_image`: "Recolor the 'Zia / Zest Insurance Agency' wordmark from white to brand red (#dc2626) with dark slate (#0f172a) outlines, keep the red flag accent, on a solid white background, preserve typography exactly." `transparent_background: true`.
- Recharts container heights fixed at 280px to avoid CLS; use `ResponsiveContainer`.
- Reports server fn does all aggregation in SQL via `supabase.rpc` if perf becomes an issue; first pass is plain `select` + JS rollups, fine for the data scale here.
- No schema migration required.
