import { defineShell, useNodeTemplate, useNodeStatusAggregate } from '@statdash/react/engine'
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
    const resolve = useNodeTemplate(ctx)
    // ── AR-40 — the page header is the ONE data-integrity subscriber ───────────
    //  Reads the page-wide preliminary fold the inner-page scope owns (panels
    //  publish up; this is the single summary). `null` when rendered outside a
    //  page scope (Postel) → no indicator.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const status = useNodeStatusAggregate()
    // title + badge are both i18n carriers (LocaleString / {year,range}); resolve BOTH
    // through the canonical seam so a raw { ka, en } bag never reaches the React child.
    const title  = resolve(def.title)
    const badge  = resolve(def.badge)
    // Crumb labels are i18n carriers too — resolve each to the active locale.
    const crumbs = (def.crumbs ?? ctx.navContext?.crumbs ?? []).map(c => ({ label: resolve(c.label), path: c.href }))
    return (
      <PageHeader
        title={title}
        badge={badge}
        crumbs={crumbs}
        homeLabel={t('home')}
        exportLabel={t('export')}
        breadcrumbLabel={t('breadcrumb')}
        preliminary={status?.preliminary === true}
        integrityLabel={t('preliminary-short')}
        integrityTitle={t('preliminary')}
        integrityAriaLabel={t('data-integrity')}
      />
    )
  },
})