// ── DataSpecEditor — the generic binding-axis composer (ADR-049 P1) ───────────
//
//  Proves the DoD: a NEW bind-kind is authorable by ONE registry declaration with
//  ZERO edit to DataSpecEditor. The test registers a FAKE kind (agnostic — not a
//  Geostat type) into SPEC_CATALOG + one rich editor under its editorKey, then
//  renders the composer and asserts the fake editor fires — the generic editorKey
//  arm dispatched to it with no per-kind branch. It also proves the built-in rich
//  editors are wired (editorKey → a registered editor), and that the schema arm
//  (ratio-list) routes to a schema, never a bespoke editor.
//
//  Note the ONLY files this test touches to add a kind: SPEC_CATALOG (engine
//  declaration) + registerSpecEditor (boot registry). DataSpecEditor is NEVER
//  edited — that IS the ADR-049 P1 guarantee.
//
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import type { DataSpec, SpecDescriptor } from '@statdash/engine'
import { SPEC_CATALOG, resolveSpecAuthoring } from '@statdash/engine'

vi.mock('../../inspector/useActiveLocales', () => ({ useActiveLocales: () => ['ka', 'en'] }))

import { DataSpecEditor } from './DataSpecEditor'
import { registerSpecEditor, getSpecEditor } from './specEditorRegistry'
import { registerSpecEditors } from './registerSpecEditors'

const FAKE_KIND = 'fake-sensor-feed'
const FAKE_KEY  = 'fake-sensor-editor'

/** Controlled harness — mirrors DataSpecEditor's owned-state contract. */
function Harness({ initial }: { initial: DataSpec }) {
  const [spec, setSpec] = useState<DataSpec>(initial)
  return <DataSpecEditor value={spec} onChange={setSpec} />
}

afterEach(() => {
  cleanup()
  delete SPEC_CATALOG[FAKE_KIND]
})

describe('DataSpecEditor — generic binding-axis composer (ADR-049 P1)', () => {
  it('a NEW bind-kind is authorable by ONE declaration + one registered editor — zero composer edit', () => {
    // A brand-new kind the composer has never heard of, declared entirely externally.
    const fakeSpec = { type: FAKE_KIND, sensorId: '' } as unknown as DataSpec
    SPEC_CATALOG[FAKE_KIND] = {
      label:            { ka: 'ფიქტიური სენსორი', en: 'Fake sensor feed' },
      description:      { ka: '—', en: 'Test-only bind-kind.' },
      constructorReady: true,
      fields:           [],
      example:          '{ "type": "fake-sensor-feed" }',
      make:             () => fakeSpec,
      editorKey:        FAKE_KEY,
    } satisfies SpecDescriptor
    registerSpecEditor(FAKE_KEY, () => <div data-testid="fake-editor">FAKE-KIND-EDITOR</div>)

    render(<Harness initial={resolveSpecAuthoring(FAKE_KIND)!.make()} />)

    // The generic editorKey arm dispatched to the fake editor — no per-kind branch.
    expect(screen.getByTestId('fake-editor')).toHaveTextContent('FAKE-KIND-EDITOR')
  })

  it('the built-in rich editors are wired to their editorKeys (they still fire where declared)', () => {
    registerSpecEditors()
    for (const kind of ['query', 'row-list', 'timeseries', 'growth', 'transform', 'pivot', 'metric']) {
      const key = resolveSpecAuthoring(kind)!.editorKey!
      expect(getSpecEditor(key), `${kind} editorKey '${key}' has a registered editor`).toBeTypeOf('function')
    }
  })

  it('ratio-list routes to the SCHEMA arm — a schema, never a bespoke editor', () => {
    const d = resolveSpecAuthoring('ratio-list')!
    expect(d.editorKey).toBeUndefined()
    expect(Array.isArray(d.schema) && d.schema.length > 0).toBe(true)
  })
})
