// ── templates — "never start blank" starters + data-first generate (V7·R3) ───
//
//  Public surface of the templates feature: the gallery UI, the page starters
//  (REGISTERED declarations on presetRegistry — ADR-050 R3, not a fixture), the
//  pure data-first generator, and the load/persist bridge.
//
export { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery'
export { PAGE_STARTERS, registerPageStarters, pageStarterList, isPageStarter, seedToPageConfig } from './pageStarters'
export { generatePageFromProfile } from './generatePage'
export { createFromTemplate, hydrateTemplate, slugify } from './loadTemplate'
