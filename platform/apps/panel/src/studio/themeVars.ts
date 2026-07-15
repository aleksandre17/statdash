// ── themeVars — the panel's re-export of the shared brand-theme mechanism ─────
//
//  The tokenKey→CSS-var transform used to live HERE, but the geostat runner needs
//  the SAME transform to apply `manifest.themeOverrides` at boot — and neither app
//  may import the other (Law 3). The SSOT now lives in the token-owning package
//  (`@statdash/styles`), so the Constructor canvas and the runner apply an identical
//  brand map identically ("the canvas never lies"). This module re-exports it so the
//  panel's existing importers (StudioShell, muiTheme, the Style editor) are unchanged.
export { cssVarName, buildThemeVars } from '@statdash/styles'
