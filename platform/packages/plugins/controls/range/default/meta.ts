// Per-slice i18n CATALOG for the range control (AR-37). Catalog-class (bilingual
// { ka, en } language content) lives in meta.ts — the tenant-content gate excludes
// per-slice meta catalogs (see tests/no-tenant-content.fitness.test.ts), the same
// home the chrome slices use for their i18n.
//
// From→to template connector words. Three positional slots wrap the two selectors
// so ONE template renders both reading conventions:
//   ka (postposition): [from] დან [to] მდე  → lead='', mid='დან', trail='მდე'
//   en (preposition):  from [x] to [y]       → lead='from', mid='to', trail=''
// Empty slots render nothing (the shell guards on a non-empty string).
export const rangeI18n = {
  ka: { 'range-lead': '',     'range-mid': 'დან', 'range-trail': 'მდე' },
  en: { 'range-lead': 'from', 'range-mid': 'to',  'range-trail': ''    },
} as const
