# Make every client's vehicles visible to staff

## What's actually happening

The vehicles are in the database and attached to the right owners — 988 vehicles across 800 clients, none unassigned, and none in the wrong agency. Checks run against the live data found only 4 policies whose vehicle is recorded against a different client than the policy itself.

The reason some clients look empty is an access-rule mismatch:

- The **client list** was widened earlier so admins, managers and agents can see every client in the agency.
- The **vehicle** and **policy** rules were never widened: managers only see vehicles/policies for clients in their own branch, and agents only for their own branch or clients assigned to them.

So when a manager or agent opens a client from another branch, the client page loads but the Vehicles tab returns nothing — it looks like the client has no vehicles, when it is really "not visible to you".

## Changes

### 1. Align vehicle and policy visibility with client visibility
Update the read rules so admins, managers, agents and viewers can see vehicles and policies for any client in their own agency, exactly as they already can for clients. Agency separation stays enforced, and client-portal users continue to see only their own records.

Editing rules stay as they are today (managers/admins keep their existing edit and cancel rights).

### 2. Same for payment extensions display
Extensions are already agency-wide, so no change needed there — they will start showing once the parent policies are visible.

### 3. Tidy the 4 mismatched policies
For the 4 policies where the policy's client and the vehicle's owner disagree, list them and re-point each policy to the vehicle's current owner (these are almost certainly vehicles that changed hands). This is a small data correction, applied after review.

### 4. Keep vehicle branch in step with the owner
Set each vehicle's branch to its owner's branch so branch reporting stays accurate now that visibility no longer depends on it.

## Technical notes

- Migration replaces `Staff read vehicles in branch` and `Staff read policies in branch` with agency-scoped read policies (role check only; `tenant_isolation` continues to scope by agency). Client-side policies (`current_client_id()`) untouched.
- Data update: `policies.client_id` re-pointed for the 4 mismatches; `vehicles.branch_id` synced from `clients.branch_id`.
- No frontend changes required — `src/components/clients/client-vehicles.tsx` already queries by `client_id`; the rows simply start coming back.
