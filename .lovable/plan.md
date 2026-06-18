## Goal

1. Stop emails from showing `pixel-perfect-clone-94206` and use the brand "Zest Insurance Agency" + the production domain `app.zestinsurance.co.ke` everywhere.
2. Make signup confirmation emails actually arrive in users' inboxes.

## 1. Rebrand all email templates

Every email template and the auth webhook were scaffolded with the auto-generated project slug `pixel-perfect-clone-94206` baked in as both `SITE_NAME` and the logo image host. That's why recipients see that string instead of the brand.

Replace in all files:
- `SITE_NAME = "pixel-perfect-clone-94206"` → `SITE_NAME = "Zest Insurance Agency"`
- Logo `src="https://pixel-perfect-clone-94206.lovable.app/__l5e/.../zia-logo-red.png"` → host swapped to `https://app.zestinsurance.co.ke/...` (the verified custom domain)
- `SAMPLE_PROJECT_URL` in `preview.ts` → `https://app.zestinsurance.co.ke`

Files touched (18):
- `src/routes/lovable/email/auth/webhook.ts`
- `src/routes/lovable/email/auth/preview.ts`
- All 16 templates in `src/lib/email-templates/*.tsx` (signup, magic-link, recovery, invite, email-change, reauthentication, renewal-reminder, policy-issued, payment-receipt, claim-update, claim-acknowledgement, client-welcome, quotation-sent, invoice-issued, portal-invite)

Also update the footer `"Zest Insurance · Nairobi, Kenya"` lines to the full agency contact line previously requested (Ruai, Miranje Hse, Nairobi • +254 713 985230 • info@zestinsurance.co.ke).

## 2. Signup emails not arriving — diagnose & fix

The auth hook IS firing (auth logs show `Hook ran successfully` on the most recent signup), so Supabase is calling our queue. The issue is downstream — most likely one of:

a. **Email domain not yet DNS-verified** for `zestinsurance.co.ke`. Until verified, queued sends fail at the provider.
b. **Queue/cron** for `process-email-queue` isn't active in this environment.
c. **Suppression list** has the recipient (unlikely on first signup, but worth checking).

Steps in build mode:
1. Run `email_domain--check_email_domain_status` to see the verified sender domain + status.
2. Read recent rows from `email_send_log` (filter `template_name='signup'`) and `suppressed_emails` to see what's actually happening to enqueued messages.
3. Confirm `cron.job` contains `process-email-queue`. If missing, call `email_domain--setup_email_infra`.
4. If DNS is still pending, tell the user it activates after verification and point to Cloud → Emails. If the domain isn't set at all, surface the email setup dialog.
5. If suppression is the cause, identify and clear the test address.

No code changes are needed for issue (2) beyond what the diagnostics turn up — the auth webhook itself is already correctly wired through `enqueue_email`.

## Out of scope
- No changes to signup form UX (still works; the email just isn't being received).
- No template content rewrites beyond the brand/host swap and footer line.
