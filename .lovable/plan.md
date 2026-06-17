I’ll restore the invoice download behavior so clicking PDF immediately downloads the file and does not open a new tab.

Plan:
1. Update the shared PDF helper in `src/lib/invoice-pdf.ts`.
2. Remove the iframe/new-tab fallback that currently calls `window.open(...)`.
3. Trigger the download using a hidden anchor from the generated PDF blob, then clean up the object URL after a short delay.
4. Keep the existing invoice styling changes: white logo and blue brand color.
5. Leave the admin invoice list and detail page button behavior unchanged, since they already call the shared helper.