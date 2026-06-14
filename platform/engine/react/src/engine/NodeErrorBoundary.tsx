import { Component, type ReactNode, type ErrorInfo } from 'react'
import type { NodeBase }                             from './types'

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
        <div className="node-error">
          <div className="node-error__icon">⚠</div>
          <p className="node-error__title">Failed to load component</p>
          <p className="node-error__body">{error.message}</p>
          <button
            className="node-error__retry"
            onClick={() => this.setState({ error: null })}
            type="button"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}