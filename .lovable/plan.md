I found the sidebar only shows admin items when the current user's `user_roles` query returns `admin`, but the live request is returning an empty list, so the Admin section and the designation under your name disappear.

Plan:
1. Restore the missing admin role record for the signed-in admin user in the backend so the sidebar can show the admin-only buttons again.
2. Keep the sidebar rendering tied to the role table, so admin buttons only show for real admins.
3. Add a small loading state in the sidebar role label so it does not briefly show `—` while roles are still being fetched.
4. Verify that the Admin section below Reports and the `admin` designation under your name are visible again after login.