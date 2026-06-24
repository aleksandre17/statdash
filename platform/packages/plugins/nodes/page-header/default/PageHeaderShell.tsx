import { defineShell, useNodeTemplate } from '@statdash/react/engine'
import { useT }                      from '@statdash/react'
import type { PageHeaderNode }       from './PageHeaderNode'
import PageHeader                    from './components/PageHeader'

export const PageHeaderShell = defineShell<PageHeaderNode>({
  render({ def, ctx }) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const t      = useT('page-header')
    // useNodeTemplate binds no hooks (the `use` prefix is ergonomic only); the
    // disable mirrors the useT line above — render() is a shell method, not a component.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const badge  = useNodeTemplate(ctx)(def.badge)
    const crumbs = (def.crumbs ?? ctx.navContext?.crumbs ?? []).map(c => ({ label: c.label, path: c.href }))
    return (
      <PageHeader
        title={def.title}
        badge={badge}
        crumbs={crumbs}
        homeLabel={t('home')}
        exportLabel={t('export')}
      />
    )
  },
})