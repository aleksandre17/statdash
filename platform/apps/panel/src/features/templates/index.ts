// ── templates — "never start blank" starters + data-first generate (V7) ──────
//
//  Public surface of the templates feature: the gallery UI, the committed
//  starters, the pure data-first generator, and the load/persist bridge.
//
export { TemplateGallery, type TemplateGalleryProps } from './TemplateGallery'
export { STARTER_TEMPLATES, type StarterTemplate } from './starterTemplates'
export { generatePageFromProfile } from './generatePage'
export { createFromTemplate, hydrateTemplate, slugify } from './loadTemplate'
