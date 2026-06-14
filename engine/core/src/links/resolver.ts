// ── resolveDataLinks — runtime link resolution ────────────────────────────
//
//  Evaluates DataLinkDef[] against a clicked row + current filter params.
//  Returns ResolvedLink[] ready to render in a context menu or click handler.
//

import type { DimVal }        from '../sdmx'
import type { DataLinkDef, DataLinkParam, ResolvedLink } from './types'
import { resolveLocaleString } from '../i18n/types'

function resolveParam(
  param:        DataLinkParam,
  row:          Record<string, DimVal>,
  filterParams: Record<string, unknown>,
): string {
  if (typeof param === 'string') return param
  if ('$row' in param) return String(row[param.$row] ?? '')
  if ('$ctx' in param) return String(filterParams[param.$ctx] ?? '')
  return ''
}

function buildPageHref(
  page:         string,
  params:       Record<string, DataLinkParam> | undefined,
  row:          Record<string, DimVal>,
  filterParams: Record<string, unknown>,
  locale:       string,
): string {
  const base   = `/${locale}${page}`
  if (!params) return base
  const query  = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(resolveParam(v, row, filterParams))}`)
    .join('&')
  return query ? `${base}?${query}` : base
}

function buildUrlHref(
  url:          string,
  params:       Record<string, DataLinkParam> | undefined,
  row:          Record<string, DimVal>,
  filterParams: Record<string, unknown>,
): string {
  let result = url
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      result = result.split(`{${k}}`).join(resolveParam(v, row, filterParams))
    }
  }
  return result
}

export function resolveDataLinks(
  links:        DataLinkDef[],
  row:          Record<string, DimVal>,
  filterParams: Record<string, unknown>,
  locale:       string,
  fallbackLocale: string,
): ResolvedLink[] {
  return links.map((link): ResolvedLink | null => {
    const title  = resolveLocaleString(link.title, locale, fallbackLocale)
    const openIn = link.openIn ?? (link.target === 'external' ? 'tab' : 'self')

    if (link.target === 'page') {
      if (!link.page) return null
      return { title, target: 'page', href: buildPageHref(link.page, link.params, row, filterParams, locale), openIn }
    }

    if (link.target === 'url' || link.target === 'external') {
      if (!link.url) return null
      return { title, target: link.target, href: buildUrlHref(link.url, link.params, row, filterParams), openIn }
    }

    return null
  }).filter((l): l is ResolvedLink => l !== null)
}