// ── useActiveProfile — the live cube profile for the editor context (C3) ─────
//
//  Binds the active dataset (derived from the session's data sources) to its
//  cached profile entry, kicking off the fetch on first use. The one hook every
//  data-bound control / palette gate calls to ask "what can I build here?".
//
//  Returns a discriminated ProfileEntry-shaped result (loading | ready | error
//  | none). 'none' is the no-cube-bound-source case — a distinct, expected state
//  (not an error): the editor simply has no dataset to introspect, and bound
//  fields fall back to free authoring. Every branch is fail-soft (verify-gate:
//  the editor never crashes when a profile is unavailable).
//
import { useEffect } from 'react'
import { useDataSources } from '../store/constructor.store'
import {
  useCubeProfileStore,
  pickActiveDatasetCode,
  type ProfileEntry,
} from './cubeProfile.store'
import type { CubeProfile } from '../lib/cubeApi'

/** The hook result — ProfileEntry plus the explicit 'none' (no bound dataset). */
export type ActiveProfile =
  | { status: 'none' }
  | ProfileEntry

/** Convenience: the resolved profile, or null in any non-ready state. */
export function profileOrNull(p: ActiveProfile): CubeProfile | null {
  return p.status === 'ready' ? p.profile : null
}

/**
 * Resolve the active dataset's profile for the current session, fetching it
 * (once) if needed. Reactive: re-renders when the profile entry transitions
 * loading → ready/error, or when the active dataset changes.
 */
export function useActiveProfile(): ActiveProfile {
  const sources       = useDataSources()
  const datasetCode   = pickActiveDatasetCode(sources)
  const ensure        = useCubeProfileStore((s) => s.ensure)
  const entry         = useCubeProfileStore((s) => (datasetCode ? s.byCode[datasetCode] : undefined))

  useEffect(() => {
    if (datasetCode) ensure(datasetCode)
  }, [datasetCode, ensure])

  if (!datasetCode) return { status: 'none' }
  return entry ?? { status: 'loading' }
}
