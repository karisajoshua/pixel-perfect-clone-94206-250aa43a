## Goal
Add "Powered by Texcortech Systems" branding across the app and PDF outputs.

## Changes

### 1. Landing page footer
Update `src/routes/index.tsx` to append "Powered by Texcortech Systems" to the existing bottom-left copyright line.

### 2. Internal pages footer
Create a reusable `PageFooter` component and render it inside `src/components/app-shell.tsx` so it appears at the bottom of every authenticated page.

### 3. Invoice PDF footer
Update `src/lib/invoice-pdf.ts` to add "Powered by Texcortech Systems" alongside the existing "Thank you for choosing Zest Insurance Agency" footer text.

### 4. Quotation PDF footer
Update `src/lib/quotation-pdf.ts` to add "Powered by Texcortech Systems" alongside the existing disclaimer footer text.

## Files to edit
- `src/routes/index.tsx`
- `src/components/app-shell.tsx`
- `src/lib/invoice-pdf.ts`
- `src/lib/quotation-pdf.ts`
- Create `src/components/page-footer.tsx`

## Technical details
- The internal footer should be subtle: small text, muted color, fixed to the bottom of the `<main>` content area inside `AppShell`.
- PDF footers: place the Texcortech line below the existing footer text, same muted styling, to avoid crowding the page bottom.