## Plan

1. **Make invoice downloads reliable again**
   - Update the shared PDF download helper so it triggers a direct browser download in the same click flow.
   - Use a temporary hidden anchor with a PDF blob URL and remove the previous new-tab behavior entirely.
   - Return a clear success/failure result from the helper so the UI only shows “Invoice downloaded” after the download trigger actually runs.

2. **Fix misleading invoice toast behavior**
   - Update both invoice download buttons (invoice list and invoice detail) to show success only when the helper completes the direct download trigger.
   - Keep the error toast when invoice data or PDF generation fails.

3. **Add quotation PDF generation**
   - Create a quotation PDF helper matching the invoice style: white logo, blue header, quote number, client, insurer, vehicle, cover details, premium values, validity date, status, and notes.
   - Reuse the same direct-download mechanism so quotation PDFs download immediately.

4. **Add PDF buttons to quotations**
   - Add a PDF/download button to each quotation row.
   - Fetch the full quotation data needed for the PDF, then download `Quotation-{quote_no}.pdf`.
   - Show “Quotation downloaded” only after the download trigger succeeds.

5. **Validate**
   - Check the changed files for syntax/import issues.
   - Verify the quotation page exposes the new PDF button and invoice buttons still call the shared direct-download path.