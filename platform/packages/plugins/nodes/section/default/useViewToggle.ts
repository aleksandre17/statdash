// ── useViewToggle — role-based chart/table view toggle ────────────────
//
//  A section can hold sibling panels that represent the SAME data in
//  different forms (e.g. a chart and a table, each tagged with `view.role`).
//  When more than one distinct role is present, the header shows a toggle
//  group and only the active role's panels are visible; the rest are kept
//  mounted but hidden (resolveViewState) so toggling is instant + a11y-safe.
//
//  The active role is persisted in GlobalState so the choice survives
//  navigation (and Repeat iterations get their own key via resolvedId).
//

import { useGlobalVar }      from '@statdash/react/engine'
import type { NodeDef, NodeBase } from '@statdash/react/engine'
import { sectionViewStateKey } from './sectionKeys'

export interface ViewToggle {
  /** Distinct, declaration-ordered roles found across the section's children. */
  roles:         string[]
  /** role → display label (first label authored for that role, else the role). */
  roleLabels:    Record<string, string>
  /** Currently selected role (persisted; defaults to the first role). */
  activeRole:    string | undefined
  /** Persist a new active role. */
  setActiveRole: (role: string) => void
  /** True when a toggle is warranted: caller opted in AND >1 distinct role. */
  showToggle:    boolean
  /** Per-child predicate: hide children whose role isn't the active one. */
  isHidden:      (child: NodeDef) => boolean
}

/**
 * @param children   the section's child defs (children.defs)
 * @param resolvedId template-resolved section id — MUST be resolved by the
 *                   caller before this hook runs so the GlobalState key is
 *                   unique per Repeat iteration.
 * @param toggleOptIn `merged.toggle` — whether the section opts into toggling.
 */
export function useViewToggle(
  children:    NodeDef[],
  resolvedId:  string | undefined,
  toggleOptIn: boolean | undefined,
): ViewToggle {
  const childMeta = children.map((d: NodeDef) => ({
    role:  (d as NodeBase).view?.role,
    label: (d as NodeBase).view?.label,
  }))

  const roles = [...new Set(childMeta.map(m => m.role).filter((r): r is string => !!r))]

  const roleLabels: Record<string, string> = {}
  childMeta.forEach(({ role, label }) => {
    if (role && !(role in roleLabels)) roleLabels[role] = label ?? role
  })

  // GlobalState: persist the chart/table choice across navigations.
  const [storedRole, setStoredRole] = useGlobalVar<string>(sectionViewStateKey(resolvedId))
  const activeRole    = storedRole ?? roles[0]
  const setActiveRole = (r: string) => setStoredRole(r)

  const showToggle = !!toggleOptIn && roles.length > 1

  const isHidden = (child: NodeDef): boolean => {
    const role = (child as NodeBase).view?.role
    return !!(showToggle && role && role !== activeRole)
  }

  return { roles, roleLabels, activeRole, setActiveRole, showToggle, isHidden }
}
