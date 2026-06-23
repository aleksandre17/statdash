// ── DiagnosticBadge — chart-local rule diagnostic display ─────────────
//
//  Renders a compact severity-coloured badge for a RuleDiagnostic.
//  Chart-plugin-local: not a shared @statdash/react component.
//  WCAG 2.1 AA: role="status" + aria-label carry meaning beyond color.
//

import type { RuleDiagnostic } from '../ruleUtils'

interface DiagnosticBadgeProps {
  diagnostic: RuleDiagnostic
}

const SEVERITY_CLASS: Record<RuleDiagnostic['severity'], string> = {
  error:   'diag-badge diag-badge--error',
  warning: 'diag-badge diag-badge--warning',
  info:    'diag-badge diag-badge--info',
}

export function DiagnosticBadge({ diagnostic }: DiagnosticBadgeProps) {
  const cls = SEVERITY_CLASS[diagnostic.severity]
  return (
    <span
      className={cls}
      role="status"
      aria-label={`${diagnostic.severity}: ${diagnostic.label}`}
    >
      {diagnostic.label}
    </span>
  )
}
