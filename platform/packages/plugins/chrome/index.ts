// ── Chrome plugins — flat per-variant registration ────────────────────
//
//  Each export = one ChromeSliceExport { Shell, META } registered independently.
//  New variant:  add one line here + create the folder. Zero other changes.
//  New slot:     add one line here. Zero other changes.
//  Constructor:  list() + listVariants() on chromeRegistry discovers all entries.
//

export * as appHeaderDefault      from './app-header/default'
export * as appHeaderTransparent  from './app-header/transparent'
export * as appHeaderHidden       from './app-header/hidden'
export * as appFooterDefault      from './app-footer/default'
export * as appFooterHidden       from './app-footer/hidden'
export * as localeSwitcherDefault from './locale-switcher/default'
export * as themeSwitcherDefault  from './theme-switcher/default'
export * as appBannerHidden       from './app-banner/hidden'
export * as innerSidebarDefault   from './inner-sidebar/default'
export * as innerSidebarHidden    from './inner-sidebar/hidden'