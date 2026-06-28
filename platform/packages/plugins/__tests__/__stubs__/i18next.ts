// ── i18next test stub — the optional-peer seam for plugin shell tests ─────────
//
//  i18next is an OPTIONAL peer of @statdash/react (resolved only in the app tier,
//  apps/geostat). Plugin-package tests that render REAL shells pull `useT` (which
//  statically imports i18next), so the plugins vitest config aliases `i18next` to
//  this passthrough: `t(key)` returns the key's local part, enough for axe to see
//  non-empty label/aria text without standing up a real translation catalogue.
//
function t(key: string): string {
  const s = String(key)
  const colon = s.lastIndexOf(':')
  return colon === -1 ? s : s.slice(colon + 1)
}

const i18next = {
  t,
  language: 'en',
  init: () => Promise.resolve(t),
  use: () => i18next,
  changeLanguage: () => Promise.resolve(t),
  exists: () => true,
  // registerSlice injects each slice's `i18n` catalogue via these — no-ops here
  // (the stub `t` returns the key, so catalogue contents are irrelevant to axe).
  addResources: () => i18next,
  addResourceBundle: () => i18next,
}

export default i18next
export { t }
