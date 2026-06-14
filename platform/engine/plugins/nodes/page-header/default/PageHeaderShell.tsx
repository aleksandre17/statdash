import { resolveTemplate }  from '@geostat/engine'
import { defineShell }      from '@geostat/react/engine'
import type { PageHeaderNode } from './PageHeaderNode'
import PageHeader              from './components/PageHeader'

export const PageHeaderShell = defineShell<PageHeaderNode>({
  render({ def, ctx }) {
    const badge  = def.badge ? resolveTemplate(def.badge, ctx.sectionCtx) : undefined
    const crumbs = (def.crumbs ?? ctx.crumbs ?? []).map(c => ({ label: c.label, path: c.href }))
    return <PageHeader title={def.title} badge={badge} crumbs={crumbs} />
  },
})