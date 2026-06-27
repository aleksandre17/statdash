// ── mergeScope — apply per-panel ScopeOverride onto a base SectionContext ──
//
//  Called by resolveNodeRows before interpretSpec when a node carries
//  view.scope. Returns the base reference unchanged when scope is absent
//  (zero allocation on the common path).
//
//  Contract (approved N37-Q2):
//    - Shallow merge of dims: { ...base.dims, ...scope.dimOverride }
//    - Returns base reference unchanged when scope is undefined
//    - Does NOT deep-clone — safe because interpretSpec never mutates context
//

import type { SectionContext } from '../core/context'
import type { ScopeOverride }  from './scopeOverride'

export function mergeScope(
  base:  SectionContext,
  scope: ScopeOverride | undefined,
): SectionContext {
  if (!scope?.dimOverride) return base
  return {
    ...base,
    dims: { ...base.dims, ...scope.dimOverride },
  }
}
