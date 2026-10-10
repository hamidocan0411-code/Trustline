# Trustline Express — Business Lead CRM Requirements

## Purpose
Build a separate internal tool for discovering and qualifying business leads across Istanbul, tracking outreach eligibility, and preparing WhatsApp messages for a human to review and send.

## Non-negotiable boundaries
- This is a separate tool. Do not add routes, UI, dependencies, or runtime behavior to the existing Trustline Express delivery application in this phase.
- Do not change Firebase Authentication, existing Firestore collections/rules, orders, customer/courier/admin panels, maps, notifications, or current hosting configuration.
- Store CRM data in an independent database/project, not the delivery app's existing Firebase project.
- No unsolicited automated marketing messages. A phone number being publicly listed is not proof of WhatsApp marketing consent.
- WhatsApp deep links may open a prefilled draft only. A human must review and press Send.
- Track consent source, timestamp, scope, and withdrawal. Suppress any business/contact that opts out.
- Respect source terms, applicable Turkish commercial electronic message/privacy requirements, and WhatsApp policies. Do not scrape sources in violation of their terms.

## MVP scope
1. Lead import from permitted public business directories, business websites, sector associations, and manual entry.
2. Normalize and deduplicate business name, phone, website, address/district, sector, source URL, and last-verified date.
3. Lead status: new, needs-review, verified, consent-pending, eligible-for-contact, draft-ready, contacted, replied, quote-requested, converted, opted-out, invalid.
4. Consent ledger: status, method, timestamp, source/evidence reference, purpose/scope, and withdrawal date.
5. Search/filter by Istanbul district, sector, lead status, verification status, and consent eligibility.
6. Per-lead WhatsApp draft generation using Trustline Express website https://trustlineexpress.com.tr and contact +90 551 493 11 84.
7. Open WhatsApp via a wa.me link only when an operator explicitly clicks; never auto-send.
8. Record manual outcomes and follow-up date.
9. CSV import/export with validation, duplicate detection, and opt-out suppression.
10. Audit log for imports, consent changes, draft opens, and status changes.

## Daily operating target
Target 100+ verified business candidates prepared per day across Istanbul. This is a lead research/verification target, not a target for unsolicited messages. Contact volume is limited to contacts with documented valid permission and any applicable channel/policy requirements.

## Suggested independent architecture
- Separate repository or isolated subdirectory/repository deployment, with its own environment variables and deployment target.
- UI: React + TypeScript, consistent with the team's familiarity, but no dependency added to the existing app.
- API: a small server-side service for lead ingestion, validation, consent enforcement, and audit records.
- Database: independent PostgreSQL instance (managed service) for leads, consent records, outreach events, and suppression list.
- Authentication: separate admin/operator accounts and role checks; no shared session with the delivery app.
- Secrets: server-side environment variables only. Never expose database credentials or provider keys in client bundles.
- External sources: use official APIs or permitted directories; record source and verification date. Avoid relying on bulk scraping.
- WhatsApp: first phase uses user-initiated wa.me drafts. Official WhatsApp Business Platform is a later optional phase only for contacts with appropriate opt-in, approved templates where required, and policy-compliant messaging.

## Data model (initial)
### leads
- id (UUID)
- business_name
- sector
- phone_e164 (nullable until verified)
- website_url
- address_text
- district
- source_type
- source_url
- source_checked_at
- verification_status
- outreach_status
- notes
- created_at, updated_at

### consent_records
- id (UUID)
- lead_id
- channel (whatsapp, phone, email, other)
- consent_status (unknown, pending, granted, withdrawn)
- purpose_scope
- evidence_reference
- collected_at
- withdrawn_at
- recorded_by

### outreach_events
- id (UUID)
- lead_id
- channel
- event_type (draft_created, draft_opened, sent_manually, reply_received, follow_up, opt_out)
- occurred_at
- operator_id
- notes

### suppression_list
- id (UUID)
- normalized_phone_or_contact_key
- reason
- added_at
- source_event_id

## Security and privacy requirements
- Default-deny contact eligibility; unknown consent is not eligible for WhatsApp marketing.
- Check suppression status immediately before creating/opening a draft.
- Least-privilege database credentials and server-side authorization.
- Validate and normalize imported CSV rows; reject malformed phone numbers and unsafe URLs.
- Minimize stored personal data; record source and purpose; define retention/deletion procedures.
- Never store customer shipment data in this CRM.
- No production secrets or API keys in Git.
- Add rate limits to ingestion endpoints and audit all operator actions.

## Acceptance criteria
- Existing Trustline Express application remains unchanged.
- CRM uses its own database and credentials.
- Duplicate leads are detected by normalized phone and business identity.
- Unknown/withdrawn consent contacts cannot be marked eligible or have a WhatsApp draft opened from the app.
- Every lead has a source and verification date or is explicitly marked as manually entered/unverified.
- Operator can filter Istanbul leads and export selected records.
- Draft text includes https://trustlineexpress.com.tr and +90 551 493 11 84.
- No automated WhatsApp sending exists in MVP.
- Tests cover import validation, deduplication, consent gating, opt-out suppression, and authorization.

## Delivery phases
1. Requirements and repository isolation (this commit).
2. Separate CRM skeleton, login, database migrations, and sample-only data.
3. Lead import, deduplication, source tracking, filters, and CSV export.
4. Consent ledger, suppression checks, WhatsApp draft screen, and audit log.
5. Tests, security review, deployment to a separate service, and operator trial.
6. Optional official WhatsApp Business Platform integration only after policy/consent workflow review.

## First development step
Create and deploy the CRM independently. Begin with a local-only skeleton and synthetic sample records. Do not connect real lead sources, messaging, the production delivery database, or existing Firebase until authentication, consent gating, and access controls pass review.
