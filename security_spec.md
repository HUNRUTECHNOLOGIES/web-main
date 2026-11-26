# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Projects Visibility Invariant**: Non-admin queries and reads on `/projects/{projectId}` can only access documents where `visible == true`. Only verified admins can create, edit, hide, or delete projects.
2. **Collaboration PII Isolation Invariant**: Submissions in `/collaborations/{collabId}` contain PII (`contact`, `pitch`, `portfolioUrl`) and are strictly unreadable (`get`, `list`) by non-admins. Every creation must enforce `status == 'Pending'`, `adminNotes == ''`, and atomically write a matching non-PII record in `/collabStatuses/{referenceId}` via `existsAfter`.
3. **Reference ID Lookup Invariant**: `/collabStatuses/{refId}` allows single-document `get` by known `refId`, strictly forbids `list` by non-admins, and contains zero PII.
4. **Admin RBAC Invariant**: `isAdmin()` requires `request.auth != null && request.auth.token.email_verified == true` AND either the bootstrapped founder email (`atomzentwo@gmail.com`) or an explicit `/admins/{uid}` document. Non-admins cannot escalate privileges or modify `/siteSettings/global`, `/apiPresets`, or `/admins`.
5. **Strict Schema & Temporal Invariant**: Every write passes a `isValid*` helper checking exact keys (`hasAll` + `hasOnly`), string `.size()` bounds, list `.size()` bounds, regex IDs (`isValidId`), immutable `createdAt`, and server-enforced `request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Collab Create**: `{ ...validCollab, isAdmin: true, status: "Pending" }` -> Rejected by `keys().hasOnly(...)`.
2. **Status Shortcutting on Collab Create**: `{ ...validCollab, status: "Approved" }` -> Rejected because `status == 'Pending'` is enforced on create.
3. **Orphaned Collab Without Status Mirror**: Creating `/collaborations/{id}` without batching `/collabStatuses/{refId}` -> Rejected by `existsAfter(...)`.
4. **PII Scraping List on Collaborations**: Unauthenticated or non-admin `list` on `/collaborations` -> Rejected by `allow list: if isAdmin()`.
5. **Status Enumeration List on CollabStatuses**: Non-admin `list` on `/collabStatuses` -> Rejected by `allow list: if isAdmin()`.
6. **Hidden Project Leak**: Non-admin `get` or `list` returning a `/projects/{id}` with `visible: false` -> Rejected by `resource.data.visible == true || isAdmin()`.
7. **ID Poisoning Attack**: Writing `/projects/<1500-char-junk-id>` -> Rejected by `isValidId(projectId)`.
8. **Timestamp Forgery**: Creating a project or collab with `createdAt` set to a past client timestamp instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
9. **Unverified Email Admin Spoof**: Token with `email: "atomzentwo@gmail.com"` and `email_verified: false` -> Rejected by `request.auth.token.email_verified == true`.
10. **Self-Privilege Escalation**: Authenticated non-admin attempting to write `/admins/{ownUid}` -> Rejected by `isAdmin()`.
11. **Oversized Pitch / DoW Payload**: Submitting a collaboration pitch > 3000 chars or > 12 techStack items -> Rejected by `.size()` bounds.
12. **Type Poisoning on Project Update**: Admin or attacker updating `techStack` with a string instead of a list, or injecting unknown keys -> Rejected by `isValidProject(incoming())` + `affectedKeys().hasOnly(...)`.
