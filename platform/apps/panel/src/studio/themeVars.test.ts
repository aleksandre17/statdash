import { describe, it, expect } from 'vitest'
import { cssVarName, buildThemeVars } from './themeVars'

// themeVars is the live-preview engine: token DATA → inline custom properties.
describe('themeVars — token key → CSS custom property', () => {
  it('maps a CSS-backed token key to its raw custom-property name', () => {
    expect(cssVarName('color.accent')).toBe('--color-accent')
    expect(cssVarName('radii.card')).toBe('--radius-card')
    expect(cssVarName('color.heading-display')).toBe('--color-heading-display')
  })

  it('returns null for non-CSS tokens (literal-value only) and unknown keys', () => {
    expect(cssVarName('breakpoints.md')).toBeNull() // has `value`, no `cssVar`
    expect(cssVarName('does.not.exist')).toBeNull()
  })
})

describe('buildThemeVars — layered override → inline style object', () => {
  it('turns a token map into an inline custom-property style object', () => {
    expect(buildThemeVars({ 'color.accent': '#123456' })).toEqual({ '--color-accent': '#123456' })
  })

  it('later layers win (author overrides beat the base preset)', () => {
    const style = buildThemeVars({ 'color.accent': '#000000' }, { 'color.accent': '#ffffff' })
    expect(style).toEqual({ '--color-accent': '#ffffff' })
  })

  it('skips empty values so a cleared field falls back to the layer beneath', () => {
    const style = buildThemeVars({ 'color.accent': '#111111' }, { 'color.accent': '' })
    expect(style).toEqual({ '--color-accent': '#111111' })
  })

  it('skips unknown / non-CSS token keys', () => {
    expect(buildThemeVars({ 'breakpoints.md': '900', 'nope': 'x' })).toEqual({})
  })
})
