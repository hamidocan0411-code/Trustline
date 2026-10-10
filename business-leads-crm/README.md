# Business Leads CRM — isolated prototype

This folder is reserved for the future standalone Trustline Express business-lead CRM. The first implementation must remain isolated from the delivery app.

## Before implementation
Read `docs/BUSINESS_LEADS_CRM_REQUIREMENTS.md`.

## Isolation rules
- Do not import the existing app's Firebase configuration.
- Do not reuse the delivery app's Firebase project or Firestore collections.
- Do not modify the root `package.json`, `firebase.json`, Firestore rules, existing app source, or deployment configuration for this prototype.
- No WhatsApp auto-send functionality. The MVP may only create a draft and open WhatsApp after an operator action, and only when consent eligibility is recorded.
- Use synthetic demo records until authentication, consent enforcement, and access control are tested.

## Planned independent stack
A separate React + TypeScript UI, a small server-side API, and a separately provisioned PostgreSQL database. This folder is a planning marker only; no runtime code or credentials are included yet.

## Local setup (when scaffold is added)
Use a separate directory/repository and its own `.env` file. Never place secrets in Git. Do not run the delivery app's Firebase deployment commands for this CRM.
