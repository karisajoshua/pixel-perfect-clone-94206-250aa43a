# Agency & Brand: make the stamp and payment details easy to find

## Current state (verified)

The **Payment details** and **Company stamp** cards already exist on the Agency & Brand page (`/admin/tenant`), below the "Brand & details" card. Two likely reasons you can't see them:

1. They sit far down a long single-column page, under the logo/colour fields.
2. They were added after the last publish, so the live site does not have them yet — only the preview does.

## What will change

### 1. Reorganise the Agency & Brand page into tabs
Replace the long scroll with four clearly named tabs at the top of the page:

- **Identity** — agency name, tagline, contact email, phone, address, city, country, website
- **Branding** — logo upload, brand colours (with a small live preview swatch)
- **Documents & payments** — M-Pesa till, paybill + account, bank details, footer note, and the company stamp upload (stamp moves here, next to the details it prints with)
- **Underwriters** — unchanged

### 2. Say explicitly where each detail is used
Each field gets a short helper line under it, e.g.:

- Agency name / logo — "Header of every quotation, invoice and receipt, plus the client portal."
- Contact email / phone / address / website — "Footer of all generated documents."
- Colours — "Sidebar, buttons and highlights across your workspace."
- M-Pesa till / paybill / account — "Payment details box on quotations and invoices. Blank fields are hidden."
- Bank details — "Bank transfer lines in the same payment box."
- Footer note — "Small print at the bottom of quotations and invoices."
- Company stamp — "Stamped on quotations and receipts."

Each tab keeps its own Save button, and an "unsaved changes" hint appears when a field is edited.

### 3. Add a live document preview panel
On the **Documents & payments** tab, show a small mock of the payment box exactly as it will print, updating as you type, so it is obvious what appears on the PDF and what is skipped when a field is blank.

### 4. Publish
Publish the app so all of this (and the earlier per-agency independence work) is live for every onboarded agency, not just in preview.

## Technical notes

- Only `src/routes/_authenticated/admin.tenant.tsx` changes: wrap the existing cards in `@/components/ui/tabs`, move the stamp card into the documents tab, add helper text and the preview block. Server functions, brand model and PDF code stay as they are.
- Also fix the hydration warning on `/` (auth page rendering outside its Suspense boundary) while in the file set.
