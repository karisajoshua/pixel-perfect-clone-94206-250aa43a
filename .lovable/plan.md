## Delete TRIDENT policies and their clients

Scope confirmed: remove the 892 policies under insurer **TRIDENT** (`d99899fb-0692-4120-b0cf-1fa1790bf141`) and all 735 clients that hold at least one such policy, along with every record attached to those clients.

### What gets deleted

For the client set `C = { clients with any TRIDENT policy }`:

1. `policy_payment_extensions` for policies of clients in C
2. `payments` for policies/invoices of clients in C
3. `invoice_items` + `invoices` for clients in C
4. `claims` for clients in C
5. `client_communications`, `client_required_documents` for clients in C
6. `service_requests` for clients in C
7. `quotations` for clients in C
8. `vehicles` owned by clients in C
9. `policies` (all policies of clients in C — not just TRIDENT ones, since the client is being removed)
10. `clients` in C

Storage objects in `client-documents` for these clients are **not** touched (kept for audit); say so if you'd like them purged too.

### Execution

Runs as a single transaction via the insert (data-change) tool so it's atomic — either all rows go or none do. Uses a CTE that resolves the client set once, then deletes children before parents to satisfy FKs.

### Irreversible

735 clients + 892 policies + all their vehicles/invoices/claims/quotes will be gone. No soft-delete, no backup restore available from the app. Confirm before I run.

### Alternative if you want to reconsider

- Keep clients, delete only the 892 TRIDENT policies (much safer)
- Export the affected clients to CSV first, then delete
