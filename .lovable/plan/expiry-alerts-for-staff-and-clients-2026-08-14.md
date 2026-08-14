# Expiry alerts for staff and clients

Covers expiring soon should be impossible to miss: staff get an in-app alert in the top bar, clients see a banner on their portal dashboard.

## Staff (admin / manager / agent)

- A bell in the app header with a red count of covers expiring in the next 14 days (plus any already expired in the last 7 days that are still marked active).
- Clicking the bell opens a dropdown listing each policy: client name, policy number, vehicle registration, expiry date, and a "in X days" chip (red under 7 days, amber otherwise).
- Each row links to the policy detail page; a footer link opens the full Renewals page.
- Scoping follows existing rules — agency-wide for admins/managers, branch-scoped for agents — so nobody sees another agency's clients.
- Data refreshes on load and every few minutes; counts are cached so it does not slow the app down.

## Client portal

- A dismissible banner on the portal dashboard when any of the client's policies expires within 30 days: "Your cover POL-… expires on 12 Sep (in 12 days)" with a link to the policy.
- Under 7 days the banner turns red and reads "expires in N days — contact us to renew".
- The dashboard "Next renewal" tile gets the same countdown text so it reads clearly at a glance.

## Notes

- This is display-only: no schema changes, no emails, no cron. The existing daily renewal-reminder email hook keeps running as it is.
- The existing Notifications admin page is left unchanged; the bell is a live view of expiring covers, not of that queue.

## Technical outline

- New `src/lib/renewal-alerts.functions.ts`: authenticated server fn returning upcoming expiries (policies with `status` in active/renewed/pending, `end_date` between today-7 and today+14), joined to client and vehicle, ordered by `end_date`. RLS handles tenant/branch scoping.
- New `src/components/renewal-bell.tsx` rendered in `src/components/app-shell.tsx` header, using `useQuery` with `staleTime` of 5 minutes.
- `src/lib/portal.functions.ts`: add `expiringSoon` (policies within 30 days) to the overview payload.
- New `src/components/portal/renewal-banner.tsx` rendered in `src/routes/_portal/portal/index.tsx`; dismissal stored in `sessionStorage` per policy id.
- Day math via existing `parseLocalDate` in `src/lib/date-only.ts` to avoid timezone drift.
