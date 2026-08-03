# Delete quotations

Add a delete action to the quotations list so unwanted or duplicate quotes can be removed.

## What changes

- A trash icon appears in each row's action area on the Quotations page.
- Clicking it asks for confirmation showing the quote number, then removes the quote and refreshes the list.
- Quotes already converted to a policy cannot be deleted (the policy record depends on them) — the delete button is hidden for those, with a note that the policy must be cancelled first.
- Child revisions that point at a deleted quote have their link cleared so nothing breaks.
- Only admins and managers see the delete button; agents keep the existing actions.

## Technical notes

- File: `src/routes/_authenticated/quotations.tsx`.
- New `remove(q)` handler: clear `parent_quote_id` on any child revisions, then `supabase.from("quotations").delete().eq("id", q.id)`, then `qc.invalidateQueries({ queryKey: ["quotations"] })` with a success/error toast.
- Gate the button on `canApprove` (admin/manager) and `q.status !== "converted"`.
- No database change needed: the existing "Staff write quotations" policy already allows delete for admin/manager/agent, and tenant isolation still applies.
