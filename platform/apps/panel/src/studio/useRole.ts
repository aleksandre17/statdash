import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── The Steward role LENS (AR-49 M2.0) ────────────────────────────────────────
//
//  Role is a UI LENS, not a permission system. It projects which authoring
//  surfaces a session sees over the ONE live document:
//    • author  — compose with governed nouns (the five compose surfaces).
//    • steward — additionally sees Model mode, where the governed semantic layer
//                is defined (unlocked here in M2.0; its content lands in later M2).
//  Define-vs-curate is an information-architecture projection over one canvas —
//  the store, pages, and canvas are identical for both roles.
//
//  ⚠️ NOT A SECURITY / ENFORCEMENT BOUNDARY (yet). The value is a persisted LOCAL
//  preference the user can freely toggle. Its job today is task/audience
//  organization + safety-by-default (a fresh session lands in `author`, so the raw
//  query cliff stays off the compose path) — NOT access control. A user CAN flip
//  it; `role === 'steward'` is therefore NOT proof of authorization anywhere.
//  Real access control binds later to auth (AR-30), at the single seam below.
//  Spec: docs/architecture/proposals/SPEC-authoring-reconception-M2.md §2.

export type Role = 'author' | 'steward'

interface RoleState {
  role:       Role
  setRole:    (role: Role) => void
  toggleRole: () => void
}

// The role SOURCE — today a persisted local preference (localStorage key
// `statdash.role`, default `author`). This store is an IMPLEMENTATION DETAIL behind
// `useRole()`; UI consumers must never read it directly (FF-ROLE-IS-LENS) — they
// read the lens through the hooks below. Exposed only so tests can arrange the lens
// and a future auth-binding can be unit-checked at the seam.
export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      role: 'author',
      setRole:    (role) => set({ role }),
      toggleRole: () => set((s) => ({ role: s.role === 'steward' ? 'author' : 'steward' })),
    }),
    { name: 'statdash.role' },
  ),
)

/**
 * useRole — THE single reader of the role lens (the swappable SEAM).
 *
 * Every consumer reads the role ONLY through this hook. That is the whole point:
 * the SOURCE of the value is swappable behind this unchanged signature without
 * touching a single consumer —
 *
 *   today:  useRole() → persisted local preference (default 'author')
 *   later:  useRole() → auth-claim projection (the JWT 'role'/'scope' the config
 *           API already issues) — when real multi-user RBAC is needed (AR-30).
 *
 * The rebind is a one-line body change here; the rail, shell, and top bar never
 * change. This is the AR-30-style "seam preserved, not built": the indirection
 * exists now; the enforcement point is reserved and documented, not implemented.
 */
export function useRole(): Role {
  return useRoleStore((s) => s.role)
}

/** Toggle the lens (author ⇄ steward). The top-bar "Model mode" control drives this. */
export function useToggleRole(): () => void {
  return useRoleStore((s) => s.toggleRole)
}

/** Set the lens explicitly (imperative — reserved for the ⌘K command / tests). */
export function useSetRole(): (role: Role) => void {
  return useRoleStore((s) => s.setRole)
}
