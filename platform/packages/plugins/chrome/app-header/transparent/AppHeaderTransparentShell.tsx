import { AppHeaderShell } from '../default/AppHeaderShell'
import './app-header-transparent.css'

// ── AppHeaderTransparentShell — frosted-glass header variant ──────────
//
//  The transparent appearance is now a DECLARED variant on the header element
//  (`data-surface="transparent"`), not a wrapper-div + descendant-modifier hack.
//  This shell simply selects that surface; the visual override lives in
//  app-header-transparent.css as `.app-header[data-surface="transparent"]`.
//  Zero-prop at the registry boundary (chrome ISP) — the prop is an internal
//  composition detail with a default.

export function AppHeaderTransparentShell() {
  return <AppHeaderShell surface="transparent" />
}
