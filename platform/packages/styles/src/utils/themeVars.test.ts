// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import {
  cssVarName,
  buildThemeVars,
  themeOverridesCss,
  applyThemeOverrides,
  THEME_OVERRIDES_STYLE_ID,
} from './themeVars'

// themeVars — the ONE shared brand-apply mechanism (the Constructor canvas + the
// runner both consume it, so a site's portable brand renders identically each side).
afterEach(() => document.getElementById(THEME_OVERRIDES_STYLE_ID)?.remove())

describe('cssVarName — token key → CSS custom property (from TOKENS_CATALOG)', () => {
  it('maps a CSS-backed token to its raw custom-property name', () => {
    expect(cssVarName('color.accent')).toBe('--color-accent')
    expect(cssVarName('color.heading-display')).toBe('--color-heading-display')
  })
  it('returns null for a non-CSS / unknown token (skipped by buildThemeVars)', () => {
    expect(cssVarName('does.not.exist')).toBeNull()
  })
})

describe('buildThemeVars — layered token map → custom-property map', () => {
  it('turns a token map into a --var → value map', () => {
    expect(buildThemeVars({ 'color.accent': '#0080BE' })).toEqual({ '--color-accent': '#0080BE' })
  })
  it('later layers win; empty values fall through (author clears → base shows)', () => {
    expect(
      buildThemeVars({ 'color.accent': '#111111' }, { 'color.accent': '#0080BE' }),
    ).toEqual({ '--color-accent': '#0080BE' })
    expect(buildThemeVars({ 'color.accent': '#111111' }, { 'color.accent': '' })).toEqual({
      '--color-accent': '#111111',
    })
  })
  it('skips unknown / non-CSS tokens', () => {
    expect(buildThemeVars({ 'nope.nope': 'x', 'color.accent': '#0080BE' })).toEqual({
      '--color-accent': '#0080BE',
    })
  })
})

describe('themeOverridesCss — DARK-SAFE :root rule string', () => {
  it('emits a single :root selector (0,1,0) so [data-theme=dark] (0,2,0) still wins', () => {
    const css = themeOverridesCss({ 'color.accent': '#0080BE' })
    expect(css).toBe(':root{--color-accent:#0080BE}')
    // never :root:root (0,2,0) — that would tie/beat the mode cascade and freeze dark.
    expect(css).not.toMatch(/:root:root|\[data-theme/)
  })
  it('an empty / all-unknown map yields no rule', () => {
    expect(themeOverridesCss({})).toBe('')
    expect(themeOverridesCss({ 'nope.nope': 'x' })).toBe('')
  })
})

describe('applyThemeOverrides — one managed <style> in head', () => {
  it('injects the brand rule and is idempotent (updates, never stacks)', () => {
    applyThemeOverrides({ 'color.accent': '#0080BE' })
    applyThemeOverrides({ 'color.accent': '#123456' })
    const els = document.querySelectorAll(`#${THEME_OVERRIDES_STYLE_ID}`)
    expect(els).toHaveLength(1)
    expect(els[0].textContent).toBe(':root{--color-accent:#123456}')
  })
  it('an empty / undefined map removes any existing rule (brand-neutral default)', () => {
    applyThemeOverrides({ 'color.accent': '#0080BE' })
    expect(applyThemeOverrides({})).toBeNull()
    expect(document.getElementById(THEME_OVERRIDES_STYLE_ID)).toBeNull()
    expect(applyThemeOverrides(undefined)).toBeNull()
  })
})
