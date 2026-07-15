// @vitest-environment jsdom
//
// ── FF-KPI-CARD-THRESHOLD — the value RECOLOURS + carries its glyph in the DOM ──
//
//  The RENDER-application half of the threshold proof (the engine-wiring half is
//  FF-KPI-THRESHOLD). Given the KpiDef presentation fields interpretKpi resolves, the
//  KpiCard MUST:
//    • colour the VALUE span with the token, resolved through the spine (tokenCssVar →
//      a `var(--…)` reference — never a literal hex, Law 2/3);
//    • render the directional glyph (aria-hidden — decoration) BEFORE the value;
//    • carry the state label as sr-only text — the accessible name, so the signal is
//      never colour-only (WCAG 1.4.1);
//    • and, ADDITIVELY (Law 8), render byte-identically when the fields are absent.
//
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup }                 from '@testing-library/react'
import { tokenCssVar }                     from '@statdash/styles'
import KpiCard                             from './KpiCard'

afterEach(() => cleanup())

describe('FF-KPI-CARD-THRESHOLD — threshold presentation reaches the DOM', () => {
  it('the value span is coloured by the token (via the spine) + shows the glyph + sr label', () => {
    const { container, getByText } = render(
      <KpiCard
        label="GDP growth" value="-3.2" trend="flat"
        valueToken="status.negative-fg" valueGlyph="down" valueStateLabel="Below target"
      />,
    )
    const valueEl = container.querySelector('.kpi-value') as HTMLElement
    // Coloured through the token spine — a `var(--…)`, NOT a literal hex.
    expect(valueEl.style.color).toBe(tokenCssVar('status.negative-fg'))
    expect(valueEl.style.color).toMatch(/^var\(--/)
    // The directional glyph (↘) renders as aria-hidden decoration.
    const glyph = container.querySelector('.kpi-value-glyph') as HTMLElement
    expect(glyph).not.toBeNull()
    expect(glyph.textContent).toBe('↘')
    expect(glyph.getAttribute('aria-hidden')).toBe('true')
    // The accessible name for the colour — the non-colour channel (WCAG 1.4.1).
    expect(getByText('Below target')).toBeTruthy()
  })

  it('ADDITIVE (Law 8) — with no threshold fields, the value is uncoloured + glyph-free', () => {
    const { container } = render(<KpiCard label="GDP" value="1 200" trend="flat" />)
    const valueEl = container.querySelector('.kpi-value') as HTMLElement
    expect(valueEl.style.color).toBe('')                 // no threshold colour applied
    expect(container.querySelector('.kpi-value-glyph')).toBeNull()
  })
})
