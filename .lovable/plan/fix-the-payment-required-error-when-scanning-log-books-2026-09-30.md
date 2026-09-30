# Fix the "payment required" error when scanning log books

## What's happening
Log book scanning uses the app's built-in AI reader, which runs on your workspace's AI credits. "Payment required / credits" means the AI service refused the scan for credit reasons, not a bug in the form. Everything scanned successfully up to 10:26 today; failed scans are rejected before they reach the logs.

Two things were found:
- Your workspace has a **monthly AI spending cap of 20 credits, set to block usage** when reached. That cap is the most likely cause.
- The workspace balance itself is fine (about 166 credits left), so no top-up is needed.

## What will change
1. **Raise the AI spending cap** (for example from 20 to 100 credits a month), keeping the alert notification. A log book scan costs about 0.004 credits, so this leaves plenty of room. Tell me if you want a different figure or no cap.
2. **Clearer error message on the scan button.** Instead of a raw "payment required" error, staff will see: "Log book reading is paused because the agency's AI allowance has been reached. Ask an administrator to raise it, or fill the fields in manually." The same goes for the "scan stored log book" button.
3. **Test a scan** once the cap is raised, to confirm fields fill in again.

## Technical notes
- Update the workspace `ai_gateway` notify_usage_up limit threshold (credits--update_limit).
- In `src/lib/vehicles.functions.ts` `extractLogbookFields`, catch AI Gateway 402/403 (credit / credit_limit_reached) and throw a friendly message; no retries.
- No changes to the database, payments, or other features.
