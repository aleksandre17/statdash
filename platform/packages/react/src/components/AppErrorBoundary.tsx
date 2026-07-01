import { Component, type ReactNode, type ErrorInfo } from 'react'

// ── AppErrorBoundary — top-level graceful-degradation boundary ──────────────
//
//  Defense-in-depth for the fail-soft guarantee (ADR-0028). ANY uncaught render
//  crash anywhere in the app tree — a shell dereferencing bad config, a renderer
//  throwing on a malformed node — is caught HERE and swapped for a brand-free
//  fallback, instead of React unmounting the entire tree to a blank white page
//  (Resilience / Graceful Degradation · Principle of Least Astonishment).
//
//  SRP — this component is the MECHANISM only (catch → swap). The fallback UI is
//  INJECTED as a prop, so the shared, app-agnostic react layer carries no
//  tenant/locale literal (Law 4): the host app supplies its own neutral fallback
//  markup. It mirrors the per-node NodeErrorBoundary one level up — that guards a
//  single shell; this guards the whole app root.
//
//  The fallback MUST be plain, self-contained markup that does NOT re-enter
//  i18n / site context — those subsystems may be the very thing that failed, so
//  the last line of defense cannot depend on them (fail-soft).
//
interface Props {
  children: ReactNode
  /** Brand-free, context-free fallback UI rendered when a descendant throws. */
  fallback: ReactNode
  /** Optional side-channel for logging / telemetry. */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fail-soft, but never SILENT (Law 6 / fail-fast at the boundary): surface the
    // crash to the console + the optional telemetry sink, then degrade the UI.
    console.error('[AppErrorBoundary] app tree crashed — rendering fail-soft fallback', {
      error,
      componentStack: info.componentStack,
    })
    this.props.onError?.(error, info)
  }

  render() {
    return this.state.error !== null ? this.props.fallback : this.props.children
  }
}
