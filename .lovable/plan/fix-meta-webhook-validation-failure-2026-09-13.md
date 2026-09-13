# Fix Meta webhook validation failure

## Diagnosis (confirmed by testing the live URL)

- `https://app.zestinsurance.co.ke/api/public/whatsapp/webhook` **is live and reachable** — publishing is not the problem.
- It currently responds **503 "Webhook verify token not configured"** because the `WHATSAPP_VERIFY_TOKEN` secret was never saved in the project's secret store (confirmed: it is absent from the secrets list).
- Meta calls the URL, gets a 503 instead of the challenge echo, and shows "The callback URL or verify token couldn't be validated."

## Fix steps

1. **Save the verify token secret.** Store `WHATSAPP_VERIFY_TOKEN` = `fcdbec8809828ead59494cc42ff235a4` (the token generated earlier). No user action needed — I can store this exact value directly.
2. **Verify the endpoint.** Call the live webhook URL with the token and confirm it echoes the challenge with HTTP 200.
3. **Re-run Meta's verification.** In the Meta app dashboard (WhatsApp → Configuration), use:
   - Callback URL: `https://app.zestinsurance.co.ke/api/public/whatsapp/webhook`
   - Verify token: `fcdbec8809828ead59494cc42ff235a4`
   - Then subscribe to the `messages` field.
4. **Request the remaining two secrets** (secure form) so sending and receiving actually work after verification:
   - `WHATSAPP_APP_SECRET` — Meta app dashboard → Settings → Basic → App Secret (needed to verify signatures on incoming messages).
   - `WHATSAPP_ACCESS_TOKEN` — Meta app dashboard → WhatsApp → API Setup → access token (needed to send messages).

## Notes

- No code changes are needed — the webhook endpoint already handles Meta's verification correctly; it only lacks the stored token.
- After step 1-2, Meta's "Verify and save" should succeed immediately.
