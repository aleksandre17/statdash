// ── useViewToggle — role-based view toggle over role-tagged children ──
//
//  App-agnostic container hook. A container can hold sibling children that
//  represent the SAME data in different forms (e.g. a chart and a table,
//  each tagged with `view.role`). When more than one distinct role is
//  present, the caller shows a toggle group and only the active role's
//  children are visible; the rest stay mounted but hidden (resolveViewState)
//  so toggling is instant + a11y-safe.
//
//  The active role is persisted in GlobalState so the choice survives
//  navigation. The persistence key is composed from a caller-supplied
//  `keyNamespace` (e.g. 'section') + a `resolvedId`, so this hook is NOT
//  bound to any one container type — any role-tagged-children container
//  reuses it with zero new code.
//

import { useGlobalVar }            from '../../context/GlobalState'
import { viewStateKey }            from './viewStateKey'
import type { NodeDef, NodeBase }  from '../types'

export interface ViewToggle {
  /** Distinct, declaration-ordered roles found across the children. */
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
 * @param children    the container's child defs (children.defs)
 * @param keyNamespace GlobalState key namespace (e.g. 'section'); composed with
 *                    resolvedId into a unique persistence key.
 * @param resolvedId  template-resolved container id — MUST be resolved by the
 *                    caller before this hook runs so the GlobalState key is
 *                    unique per Repeat iteration.
 * @param toggleOptIn whether the container opts into toggling.
 */
export function useViewToggle(
  children:     NodeDef[],
  keyNamespace: string,
  resolvedId:   string | undefined,
  toggleOptIn:  boolean | undefined,
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
  const [storedRole, setStoredRole] = useGlobalVar<string>(viewStateKey(keyNamespace, resolvedId))
  const activeRole    = storedRole ?? roles[0]
  const setActiveRole = (r: string) => setStoredRole(r)

  const showToggle = !!toggleOptIn && roles.length > 1

  const isHidden = (child: NodeDef): boolean => {
    const role = (child as NodeBase).view?.role
    return !!(showToggle && role && role !== activeRole)
  }

  return { roles, roleLabels, activeRole, setActiveRole, showToggle, isHidden }
}
