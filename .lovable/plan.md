# Push the latest changes to the live site

## What's happening

Frontend changes (the invoice edit fix and the new delete actions) go live only after the project is published again. The preview always runs the newest code; the published site keeps serving the last deployed build until a new deploy is made.

Backend changes (database rules, server logic) deploy immediately, which is why some things appear to work while the UI changes do not.

## Plan

1. Run a security scan check, then publish the project so the current build is deployed.
2. After the deploy finishes (about a minute), reload the live site with a hard refresh to bypass the browser cache.
3. Confirm on the live site that:
   - opening an invoice, editing it, and saving works
   - the Delete action appears on the invoices list and invoice detail page for admins and managers

If the changes still do not appear after a fresh publish and hard refresh, investigate build output and caching on the published domain (including the custom domain).
