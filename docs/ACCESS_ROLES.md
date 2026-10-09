# Role and Navigation Guide

The application provides separate staff, customer, and platform administration experiences.

## Staff
The client, policy, quotation, claim and invoice pages declare access for agent, manager and admin roles. WhatsApp administration declares manager and admin access. The DMVIC administration page declares admin access. IPEN administration declares agent, manager and admin access.

## Customers
The customer portal checks that the signed-in account has the client role.

## Platform administrators
The platform area checks for a super-admin role and offers agency, notices, messaging health and audit navigation.

## Verification
These observations describe the routing implementation only. Verify permissions on every server operation and database record using test accounts from different agencies. Check multiple roles, session expiry and MFA requirements before deployment.
