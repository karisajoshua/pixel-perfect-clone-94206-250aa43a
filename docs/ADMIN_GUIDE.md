# Administrator guide — initial source-based edition

## Agency administration
The route registry includes administration pages for users, branches, insurers, notifications, security, sessions, requests, audit, imports, documentation, automation, email, DMVIC, IPEN and WhatsApp.

## WhatsApp operations
The WhatsApp admin route is restricted to admin/manager in source. It exposes channel configuration, templates, consent, test sends and message activity. Configure only approved test credentials until delivery and consent handling are validated.

## DMVIC operations
The DMVIC admin route is restricted to admin in source. It displays connection status, orders, certificate pricing, insurer rates, agency verification fields and settlement totals. Validate pricing and ledger reconciliations before live certificate activity.

## IPEN operations
The IPEN admin route is accessible to admin/manager/agent in source. It contains connection, MFA and provider workflow tools. Review whether this role scope is appropriate for each action.

## Platform administration
Separate platform routes exist for agencies, audit, notices and WhatsApp. The platform-wide permission model has **not** been verified.

## Required controls
Apply least privilege; audit sensitive configuration changes; require MFA for privileged accounts; verify tenant isolation; use approved secret storage; and maintain incident/rollback procedures.
