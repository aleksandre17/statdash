// ── EnumRefField — governed semantic-catalog branch (AR-49 M0 item 8) ─────────
//
//  Proves the third source family: when a field's enum-ref source is
//  'metrics'/'dimensions' (isSemanticSource), EnumRefField resolves options from
//  the semantic catalog via the pure resolvers and renders them in the SAME
//  <select> — gated on the catalog being 'ready'. The catalog hook is mocked so
//  the branch is tested in isolation (the live describeApp() load is exercised by
//  the store's own tests). FF-METRIC-REF-GOVERNED: the control emits only
//  registered ids (a metric-id / dimension-id), never free text (Law 2).
//
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'
import type { MetricDef } from '@statdash/engine'
import type { MetricCatalog } from '../../discovery/useMetricCatalog'
import type { CatalogDimension } from '../../discovery/semanticCatalogOptions'
import type { FieldControlProps } from '../fieldControl.types'
import type { PropField } from '@statdash/react/engine'

// The branch under test depends on the catalog hook — mock it so we drive the
// status transitions deterministically (idle | ready | error).
let mockCatalog: MetricCatalog = { status: 'idle' }
vi.mock('../../discovery/useMetricCatalog', () => ({
  useMetricCatalog: () => mockCatalog,
}))

// Imported AFTER the mock is registered.
import { EnumRefField } from './EnumRefField'

const metrics: Record<string, MetricDef> = {
  'gdp.level':      { code: 'B1GQ',    label: { ka: 'მშპ', en: 'GDP' }, unit: { ka: 'მლნ ₾', en: 'mln GEL' } },
  'gdp.realGrowth': { code: 'B1GQ_GR', label: { ka: 'მშპ · ზრდა', en: 'GDP · growth' } },
}
const dimensions: Record<string, CatalogDimension> = {
  region: { code: 'REGION', label: { ka: 'რეგიონი', en: 'Region' }, conceptRole: 'geo' },
}

const readyCatalog: MetricCatalog = { status: 'ready', metrics, dimensions }

function renderField(field: PropField, value = '') {
  const onChange = vi.fn<(v: unknown) => void>()
  const props: FieldControlProps = {
    field, id: 'insp-metric', value, locales: ['ka', 'en'], locale: 'ka', onChange,
  }
  const utils = render(<EnumRefField {...props} />)
  return { onChange, select: utils.container.querySelector('select')!, ...utils }
}

const metricField: PropField = {
  field: 'value.measure', type: 'enum-ref', source: 'metrics',
  label: { ka: 'მეტრიკა', en: 'Metric' }, required: true,
}

beforeEach(() => { mockCatalog = readyCatalog })

describe('EnumRefField — semantic metrics source', () => {
  it('renders governed metric options (label + unit hint) from the catalog', () => {
    const { select } = renderField(metricField)
    const labels = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(labels).toContain('მშპ · მლნ ₾')          // label + unit
    expect(labels).toContain('მშპ · ზრდა')            // unit-less metric → label only
  })

  it('emits ONLY registered metric-ids on change (governed — Law 2)', () => {
    const { select, onChange } = renderField(metricField)
    // Every option value is a registered metric-id (required field → no blank option).
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(values.sort()).toEqual(['gdp.level', 'gdp.realGrowth'])

    fireEvent.change(select, { target: { value: 'gdp.realGrowth' } })
    expect(onChange).toHaveBeenCalledWith('gdp.realGrowth')
  })
})

describe('EnumRefField — semantic dimensions source', () => {
  it('renders governed dimension options from the catalog', () => {
    const dimField: PropField = {
      field: 'sliceBy', type: 'enum-ref', source: 'dimensions', label: { ka: 'განზომილება', en: 'Dimension' },
    }
    const { select } = renderField(dimField)
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)
    expect(values).toContain('region')
  })
})

describe('EnumRefField — semantic source gate', () => {
  it('shows the loading hint and no real options until the catalog is ready', () => {
    mockCatalog = { status: 'idle' }
    const { select } = renderField(metricField)
    const options = within(select).getAllByRole('option')
    // Non-ready → only the disabled hint option (no governed ids leak through).
    expect(options).toHaveLength(1)
    expect(options[0]).toBeDisabled()
    expect(options[0].textContent).toBe('catalog loading…')
  })

  it('never crashes on an error catalog (fail-soft)', () => {
    mockCatalog = { status: 'error', message: 'boom' }
    expect(() => renderField(metricField)).not.toThrow()
  })
})
