// @vitest-environment jsdom
//
// ── PropSchemaForm — schema-driven property form fitness test (Pattern D) ───
//
//  Pins the framework contract: a property form is RENDERED FROM a PropSchema,
//  not hand-written per node type. Covers every PropFieldType renderer branch,
//  controlled onChange, required marking, dot-path read, showWhen gating, and
//  the raw-JSON fallback for rich types.
//
//  Engine-agnostic (Law 3): defines its own PropSchema — no plugin/app imports.
//

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { createElement }              from 'react'
import { PropSchemaForm }             from './PropSchemaForm'
import type { PropSchema }            from '../engine/types'

afterEach(cleanup)

const SCHEMA: PropSchema = [
  { field: 'title',       type: 'string',  label: { en: 'Title', fr: 'Titre' }, required: true },
  { field: 'count',       type: 'number',  label: { en: 'Count' } },
  { field: 'visible',     type: 'boolean', label: { en: 'Visible' } },
  { field: 'accent',      type: 'color',   label: { en: 'Accent' } },
  { field: 'mode',        type: 'string',  label: { en: 'Mode' },
    options: [{ value: 'bar', label: { en: 'Bar' } }, { value: 'line', label: { en: 'Line' } }] },
  { field: 'view.width',  type: 'string',  label: { en: 'Width' } },               // dot-path
  { field: 'spec',        type: 'DataSpec', label: { en: 'Spec' } },               // json fallback
  { field: 'barOnly',     type: 'string',  label: { en: 'Bar only' }, showWhen: "mode === 'bar'" },
]

function renderForm(value: Record<string, unknown>, onChange = vi.fn()) {
  const utils = render(createElement(PropSchemaForm, { schema: SCHEMA, value, onChange, locale: 'en' }))
  return { ...utils, onChange }
}

describe('PropSchemaForm — schema-driven rendering', () => {
  it('renders a labelled, accessible control per field (label[htmlFor] → input id)', () => {
    const { getByText, container } = renderForm({})
    const label = getByText('Title') as HTMLLabelElement
    expect(label.htmlFor).toBe('psf-title')
    expect(container.querySelector('#psf-title')).toBeTruthy()
  })

  it('marks required fields', () => {
    const { getByText } = renderForm({})
    // The required asterisk lives inside the Title label.
    expect(getByText('Title').textContent).toContain('*')
  })

  it('resolves LocaleString labels for the active locale', () => {
    const { getByText } = render(
      createElement(PropSchemaForm, { schema: SCHEMA, value: {}, onChange: vi.fn(), locale: 'fr' }),
    )
    expect(getByText('Titre')).toBeTruthy()
  })

  it('renders a number input and emits a numeric value', () => {
    const { container, onChange } = renderForm({})
    const input = container.querySelector('#psf-count') as HTMLInputElement
    expect(input.type).toBe('number')
    fireEvent.change(input, { target: { value: '42' } })
    expect(onChange).toHaveBeenCalledWith('count', 42)
  })

  it('renders a checkbox and emits a boolean', () => {
    const { container, onChange } = renderForm({ visible: false })
    const cb = container.querySelector('#psf-visible') as HTMLInputElement
    expect(cb.type).toBe('checkbox')
    fireEvent.click(cb)
    expect(onChange).toHaveBeenCalledWith('visible', true)
  })

  it('renders a color input', () => {
    const { container } = renderForm({ accent: '#0080BE' })
    const c = container.querySelector('#psf-accent') as HTMLInputElement
    expect(c.type).toBe('color')
    expect(c.value).toBe('#0080be')
  })

  it('renders a <select> when options are present and emits the chosen value', () => {
    const { container, onChange } = renderForm({})
    const sel = container.querySelector('#psf-mode') as HTMLSelectElement
    expect(sel.tagName).toBe('SELECT')
    fireEvent.change(sel, { target: { value: 'line' } })
    expect(onChange).toHaveBeenCalledWith('mode', 'line')
  })

  it('reads dot-path field values off the value object', () => {
    const { container } = renderForm({ view: { width: 'full' } })
    const input = container.querySelector('#psf-view-width') as HTMLInputElement
    expect(input.value).toBe('full')
  })

  it('falls back to a raw-JSON textarea for rich types and parses on blur', () => {
    const { container, onChange } = renderForm({})
    const ta = container.querySelector('#psf-spec') as HTMLTextAreaElement
    expect(ta.tagName).toBe('TEXTAREA')
    fireEvent.blur(ta, { target: { value: '{"type":"query"}' } })
    expect(onChange).toHaveBeenCalledWith('spec', { type: 'query' })
  })

  it('hides a field whose showWhen condition is unmet, shows it when met', () => {
    const { container: hidden } = renderForm({ mode: 'line' })
    expect(hidden.querySelector('#psf-barOnly')).toBeNull()

    cleanup()
    const { container: shown } = renderForm({ mode: 'bar' })
    expect(shown.querySelector('#psf-barOnly')).toBeTruthy()
  })

  it('renders an empty group for an empty schema (caller uses raw JSON editor)', () => {
    const { container } = render(
      createElement(PropSchemaForm, { schema: [], value: {}, onChange: vi.fn() }),
    )
    expect(container.querySelector('.psf')?.children.length).toBe(0)
  })
})
