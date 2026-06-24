// ── viewStateKey — GlobalState key for a persisted view-toggle choice ──
//
//  Composes a stable, well-formed GlobalState key from a caller-supplied
//  namespace (e.g. 'section') and a resolved container id. Persisting the
//  active role under this key keeps the chart/table choice across
//  navigations (see GlobalStateProvider).
//
//  Falls back to `'anon'` when the container has no resolved id so the key
//  is still stable; such containers simply share one anonymous slot.
//

export function viewStateKey(namespace: string, resolvedId: string | undefined): string {
  return `${namespace}:view:${resolvedId ?? 'anon'}`
}
