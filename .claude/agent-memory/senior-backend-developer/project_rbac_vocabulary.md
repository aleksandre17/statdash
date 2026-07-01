---
name: rbac-vocabulary
description: api RBAC role set is admin/editor/viewer only — no publisher role; publish is gated to admin (editor saves, admin publishes)
metadata:
  type: project
---

# api RBAC role vocabulary — admin / editor / viewer (no publisher)

The platform RBAC role set is exactly `admin`, `editor`, `viewer`. Defined in:
- DB: `config.user.roles[]` (V10), default `'viewer'`, CHECK only `cardinality(roles) > 0` (the names are NOT enum-constrained in the DB).
- Boundary validation: `apps/api/src/routes/admin/users.ts` `KNOWN_ROLES = ['admin','editor','viewer']` (zod-enforced at create/patch — the real gate against typo'd roles).
- Write gates: `requireWrite` = admin OR editor (ingest, releases, displays). Admin-only: admin/users/export/audit.

**There is NO `publisher` role.** When C4 (Constructor publish-role gate) asked for a "publisher" gate on `POST /api/config/pages/:id/publish`, the in-vocabulary resolution was to gate publish to `admin` — giving editor-saves / admin-publishes separation without inventing a 4th role. See `pages.ts` `PUBLISH_ROLES = ['admin']` + `requirePublish`.

**Why:** adding a 4th role is a one-way-door cross-module change (DB V10 comment, KNOWN_ROLES, token issuance) — architect escalation, not an api-local decision.

**How to apply:** if a future ask needs publish-without-admin (a publisher who cannot manage users/system), the expand step is additive: add `'publisher'` to KNOWN_ROLES + V10 comment, then widen `PUBLISH_ROLES` to `['admin','publisher']`. The `requirePublish` gate is the single seam (Protected Variations). Flag it to the architect first. Related: [[checklaws-path-coupling]].
