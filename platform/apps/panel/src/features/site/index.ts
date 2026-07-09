// ── site feature barrel ───────────────────────────────────────────────────────
//
//  Site identity + navigation authoring, extracted from the wizard's SiteStep so
//  the SAME controls serve both the wizard and the Studio Pages&Site surface
//  (AR-49 M1.3 — no fork). Neutral home (not under features/wizard) so it survives
//  the wizard's eventual deletion (M1.3b).
export { SiteIdentityEditor } from './SiteIdentityEditor'
export { NavEditor } from './NavEditor'
export type { NavEditorProps } from './NavEditor'
