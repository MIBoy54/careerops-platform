# Employer Contact workflow: implementation contract

Prepared November 2, 2026. Status: design and migration preparation; no schema or
business-record changes applied. Current verified baseline: 977eacd.

## Completed

- Company/Agency lookup starts at two trimmed characters and displays selectable
  Date / Company-Agency / Role records. Selection uses the contact ID.
- Role is a free-text input backed by the existing role_level value. Existing
  values remain intact; no Role migration was needed.
- DEMO permits lookup and local Reset while business writes remain blocked.
- Latest Quality Gates displays DEV, QA, DEMO and PROD independently.

## Requested fields

| UI field | Values |
| --- | --- |
| Role | Free text, retaining existing Level values |
| Role Type | Consultant; Individual Contributor; Leadership |
| Hiring Workflow (Funnel) | Applied; Recruiter Interview; Submitted; HR Interview; Hiring Interview |
| Position Status | Awaiting Decision; On-hold; Rejected; Closed; Hired |
| Relationship Status | Retain Active / Warm / Cold independently |

Hiring stage and Position Status are independent. For example, a contact may be
at Submitted / On-hold or Hiring Interview / Awaiting Decision. Relationship
Status continues to describe the recruiter relationship.

## Preservation rules

Existing role_type mixes job categories and role classification. Preserve the
original values. Leadership can map directly; QE Transformation, QA Operations,
DevOps Platform, Healthcare Tech and AI / Data Platforms must not be silently
classified as Individual Contributor or Consultant.

Use an additive canonical Role Type field, provisionally role_category, while
retaining role_type as historical category data. When editing an unclassified
record, show the previous category and allow an explicit new classification.
The new selector offers only the three requested categories plus an unset value.

Add nullable hiring_stage and position_status columns. Preserve the existing
status column as legacy evidence until all dependent views use the new contract.
Backfill only unambiguous information:

| Existing status | Hiring stage | Position Status |
| --- | --- | --- |
| Applied | Applied | Unset |
| Submitted | Submitted | Unset |
| Interviewing | Unset | Unset |
| Awaiting decision | Unset | Awaiting Decision |
| On hold | Unset | On-hold |
| Rejected | Unset | Rejected |
| Closed | Unset | Closed |
| Offer | Unset | Unset |

An offer does not establish Hired. Interviewing does not establish which interview
stage occurred. Blank values represent unknown history and are not invented.
New records may default explicitly to Applied / Awaiting Decision; existing
records should not inherit those defaults without supporting data.

## Implementation sequence

1. Inventory actual schema types and aggregate legacy values in DEV, QA, DEMO
   and PROD using read-only queries. Do not export recruiter/contact details.
2. Build guarded additive migrations and schema verification. Test on disposable
   data, including repeated migration attempts and unchanged legacy values.
3. Add canonical fields to create/update requests, validation, lookup, details,
   exports and protected snapshot allowlists. Preserve omission semantics so an
   older client cannot erase canonical fields inadvertently.
4. Update the form and its exact-ID selection loader. Keep guest fields and Save
   restricted. Display unclassified historical values meaningfully.
5. Update dependent filters, funnel calculations and status totals alongside the
   new contract. Hired must not silently become Applied, Rejected or Closed.
   The broader dashboard visual redesign remains a separate planned item.
6. Test source snapshot consistency and privacy with the new fields, including
   source tables provisioned before code starts selecting new columns.
7. Promote DEV -> QA -> DEMO -> PROD with the established gates and stop on
   failure. Apply only the reviewed additive schema changes at each stage.
8. Verify privileged create/update on synthetic fixtures and guest read-only
   desktop/mobile flows. Do not edit existing LIVE records for acceptance.

## Required acceptance

- Existing Role values survive load, edit, save, export and snapshot capture.
- Every requested stage and Position Status round-trips independently.
- Unknown categories, Interviewing and Offer retain their legacy evidence.
- Existing records survive backfill unchanged apart from justified canonical
  additions; no historical rows are deleted or guessed.
- Search still selects the intended dated opportunity when a company repeats.
- A guest's stage/status view remains frozen after reload; a new guest receives
  a new protected capture. Historical orphan-link projection remains intact.
- Writes and administrative actions remain refused for guests.
- Dashboard/status counts reconcile across legacy and canonical records.
- An expired PROD login leaves unsaved form entries intact for reauthentication.

## Outstanding work

Implement and validate this contract, then complete the dashboard redesign and
a safely timed WSL restart-recovery check. Production remains at the verified
baseline until a tested change is ready for promotion.
