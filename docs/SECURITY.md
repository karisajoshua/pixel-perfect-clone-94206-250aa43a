# Security verification plan

This document describes review requirements, **not a certification**.

## Highest-priority controls
1. Enforce tenant isolation at database RLS and server API layers; do not rely on UI routing.
2. Verify authorization on all staff, customer, platform and export endpoints.
3. Authenticate public payment, WhatsApp and automation callbacks; prevent replay and duplicate processing.
4. Protect secrets in environment configuration; scan Git history before public releases.
5. Check MFA enforcement for privileged users, session revocation and account recovery.
6. Ensure AI tooling cannot retrieve records outside the current user's permissions.
7. Minimize customer PII in logs, analytics, email and generated documents.
8. Validate uploaded files and apply least-privilege storage policies.

## Test approach
Use isolated test tenants, synthetic customer records and sandbox provider accounts. Record each finding with severity, reproduction steps, owner, remediation and verification evidence. Do not conduct destructive tests on production.
