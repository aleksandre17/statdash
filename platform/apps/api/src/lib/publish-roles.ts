// ── publish-roles — the RBAC gate for the governance acts (ADR-052 §4 / C4) ────
//
//  AUTHORING vs PUBLISHING are distinct privileges (C4 / P3-5). The config routes'
//  authPlugin already gates every route with a valid Bearer JWT, so save (POST /,
//  PUT /:id) is open to any authenticated write role. A RESTORE — re-applying a
//  historical body as the live document — is the governance act and must be gated
//  MORE STRICTLY, exactly as page PUBLISH is (an editor curates, an admin governs).
//
//  ROLE VOCABULARY: the platform RBAC set is admin/editor/viewer (V10 / admin
//  KNOWN_ROLES). There is NO dedicated `publisher` role. Rather than invent a 4th
//  role (a one-way-door change spanning the DB CHECK, KNOWN_ROLES, and token
//  issuance — an architect-level cross-module decision), the governance acts gate to
//  the existing privileged role: admin. This is the SAME rule pages.ts already
//  applies to publish (PUBLISH_ROLES = ['admin']); this module is the shared SSOT so
//  the spec/source restore gate and the page publish gate cannot drift.
//
//  ESCALATION (flagged for the architect): if the product later needs a `publisher`
//  role distinct from admin, the expand step is additive — add 'publisher' to
//  KNOWN_ROLES + the V10 comment, then widen PUBLISH_ROLES here to
//  ['admin','publisher']. This one constant is the single seam that absorbs it
//  (Protected Variations). pages.ts page-publish + the data-spec/data-source restore
//  gates ALL consume this seam (the former pages.ts local copy is retired).
//
//  401 (no/invalid token, from authPlugin) vs 403 (valid token, wrong role, here)
//  are kept distinct per RFC 7235.

import { forbidden } from './problem.js'

/** The roles permitted to perform a governance act (restore / publish). */
export const PUBLISH_ROLES = ['admin'] as const

/**
 * Throw 403 unless the caller carries a publish-privileged role. Use in an
 * `onRequest` hook so an unauthorised caller never opens a DB connection (the
 * pages.ts publish-gate shape). `act` names the governance act for the 403
 * detail ('publish' / 'restore a revision') — one gate, occurrence-precise
 * messages (RFC 9457 detail is per-occurrence).
 */
export function requirePublishRole(roles: string[] | undefined, act: string): void {
  const r = roles ?? []
  if (!PUBLISH_ROLES.some((role) => r.includes(role))) {
    throw forbidden(`admin role required to ${act}`)
  }
}
