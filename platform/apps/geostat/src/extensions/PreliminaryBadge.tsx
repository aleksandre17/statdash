import { useT } from '@statdash/react'

/**
 * PreliminaryBadge — inline badge shown when a data node is marked preliminary.
 * Rendered via the PANEL_TITLE_BADGE extension point.
 * Law 9: data integrity — ONS/IMF/Eurostat standard.
 */
export function PreliminaryBadge() {
  const t = useT('feedback')
  return (
    <span
      className="badge badge--preliminary"
      title={t('preliminary.title')}
      aria-label={t('preliminary.title')}
    >
      {t('preliminary.label')}
    </span>
  )
}
