# Fix invoice editing + allow deleting invoices

## What's wrong today

Opening an invoice and clicking **Edit → Save** fails. The edit dialog is handed the full invoice record loaded with its related data (client, policy, line items, payments, branch). When saving, that whole object — related data included — is sent back as the invoice update, and the database rejects it because those related blocks are not columns on the invoice.

The same shape of bug was fixed earlier on claims.

## Changes

### 1. Invoice edit save (fix)
In the invoice form dialog, build the update from an explicit whitelist of invoice fields only:
`invoice_no, client_id, policy_id, branch_id, issue_date, due_date, subtotal, tax, total, status, notes`.
- Drop `clients`, `policies`, `invoice_items`, `payments`, `branches`, `items`, `id`, `created_at`, `updated_at`, `tenant_id` from the payload.
- Keep `created_by` only when creating a new invoice, so editing doesn't reassign ownership.

### 2. Delete invoices (new)
- Add a **Delete** action on the invoices list row (in the same actions cell as PDF / Open) and a **Delete** button on the invoice detail page header.
- Show a confirmation dialog naming the invoice number and warning that payments and line items recorded against it are removed too.
- Deletion removes payments, then line items, then the invoice, and refreshes the list; from the detail page it navigates back to `/invoices`.
- Visible to admins and managers only. Agents keep read/edit but no delete.

## Technical notes

Files touched:
- `src/components/invoices/invoice-form-dialog.tsx` — whitelist the update payload.
- `src/routes/_authenticated/invoices.tsx` — row delete action + confirm dialog.
- `src/routes/_authenticated/invoices.$id.tsx` — header delete button + redirect after delete.

No database migration needed: existing access rules already permit admins and managers to delete invoices, line items, and payments within their scope. Role gating in the UI uses the existing auth/role hook.
