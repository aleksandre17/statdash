// ── Engine Types — Auth layer [N41] ───────────────────────────────────
//
//  AuthContext lives in engine/react, NOT engine/core. Auth is an app-tier
//  concern (Law 3): engine/core knows nothing about users or roles. The
//  app (apps/geostat) injects the resolved identity into RenderContext at
//  the app tier; engine/react's render pipeline (renderNode) reads it to
//  enforce view.visibleToRoles. engine/core stays free of any user model.
//
//  Absent auth ⇒ anonymous (roles: []). This is the safe default: an
//  unauthenticated request sees only nodes without a visibleToRoles gate.
//

/**
 * Resolved identity threaded through the render tree for RBAC visibility.
 * Serializable (no functions) — it belongs to RenderContext's "A" half and
 * is safe to snapshot. Injected by the app tier; absent ⇒ anonymous.
 */
export interface AuthContext {
  /** Subject id of the authenticated user. Absent ⇒ anonymous. */
  userId?: string
  /** Roles granted to this identity. Empty array ⇒ anonymous / no roles. */
  roles:   string[]
}
