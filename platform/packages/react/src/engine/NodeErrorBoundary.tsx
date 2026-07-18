import { Component, type ReactNode, type ErrorInfo } from 'react'
import type { NodeBase }                             from './types'
import { useTSafe }                                  from '../context/SiteContext'

// ── DefaultNodeErrorFallback — the localized default crash UI ──────────────
//
//  The boundary itself is a class (React error boundaries must be), so it can't
//  call hooks. The default fallback is therefore a function component that routes
//  its strings through the SAME i18n contract as the rest of the feedback chrome
//  (useT('feedback')) — the title/retry label previously sat as raw English
//  literals, rendering "Failed to load component"/"Retry" on a KA page (WCAG
//  3.1.2 language-of-parts). A slice may still override via its ErrorFallback.
function DefaultNodeErrorFallback({ error, onRetry }: { error: Error; onRetry: () => void }): ReactNode {
  const t = useTSafe('feedback')
  return (
    <div className="node-error">
      <div className="node-error__icon" aria-hidden="true">⚠</div>
      <p className="node-error__title">{t('error.title')}</p>
      <p className="node-error__body">{error.message}</p>
      <button className="node-error__retry" onClick={onRetry} type="button">
        {t('error.retry')}
      </button>
    </div>
  )
}

interface Props {
  node:     NodeBase
  children: ReactNode
  /** Per-slice crash UI — provided by slice's ErrorFallback export. */
  fallback?: (props: { node: NodeBase; error: Error }) => ReactNode
}

interface State {
  error: Error | null
}

export class NodeErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[renderNode] shell crashed', {
      type:           this.props.node.type,
      variant:        this.props.node.variant,
      error,
      componentStack: info.componentStack,
    })
  }

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback({ node: this.props.node, error })
      }
      return (
        <DefaultNodeErrorFallback
          error={error}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}