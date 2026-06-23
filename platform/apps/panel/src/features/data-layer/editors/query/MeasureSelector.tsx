import { useMemo } from 'react'
import { ChipInput } from './ChipInput'
import { useActiveProfile } from '../../../../discovery/useActiveProfile'
import { useSite } from '../../../../store/constructor.store'
import { measureOptions } from '../../../../discovery/cubeEnumOptions'

// ── MeasureSelector — cube-bound chip input for ObsQuery.measure (C3) ─────────
//
//  Each measure code becomes a deletable chip. Suggestions are the ACTIVE
//  dataset's REAL measures (from the cube profile) so the author picks rather
//  than types a raw code (Law 2 declarative authoring). When no dataset is bound
//  (or its profile is unavailable) it degrades to free-text entry — the field
//  stays usable (graceful degradation).
//

export interface MeasureSelectorProps {
  value:    string[]
  onChange: (codes: string[]) => void
}

export function MeasureSelector({ value, onChange }: MeasureSelectorProps) {
  const active = useActiveProfile()
  const locale = useSite().defaultLocale

  const options = useMemo<string[]>(() => {
    if (active.status !== 'ready') return []
    return measureOptions(active.profile, locale).map((o) => o.value)
  }, [active, locale])

  return (
    <ChipInput
      value={value}
      onChange={onChange}
      label="მაჩვენებლები (Measures)"
      placeholder="GDP_SVC"
      options={options}
    />
  )
}
