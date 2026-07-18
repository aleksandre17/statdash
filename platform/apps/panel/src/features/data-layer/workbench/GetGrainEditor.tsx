// ── GetGrainEditor — the governed head's read-level grain «წაკითხვის არე» (card 0087 §3.2) ─
//
//  The old query editor could author the read-level coordinate; unification is real only
//  when THAT power lives in the one workbench surface. The governed source head carries a
//  generic M2 grain — this compact disclosure edits its `where` PINS (a fixed coordinate:
//  `{ time: 2020 }` reads only 2020). OFFERED, never typed (P-OFFER): the dim is picked
//  from the source's governed columns (FieldPicker), the member from that column's actual
//  values (MemberPicker, single-select — a pin is one member, the engine head `where` is
//  scalar DimVal per dim). Grain-∅ = browse stays the DEFAULT (ADR-046 Addendum 2 — an
//  EMPTY grain is a meaningful state, never force one), so the disclosure starts collapsed
//  and pins are additive.
//
//  WCAG (Law 9): a labelled disclosure button (aria-expanded) + labelled controls.
//  Bilingual ka/en. Draft-over-canonical (the FilterStepForm pattern): an in-progress
//  empty pin row lives in local state; the canonical `where` only ever carries complete pins.
//
import { useEffect, useRef, useState } from 'react'
import { Box, Button, Chip, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import TuneIcon from '@mui/icons-material/Tune'
import type { DimVal } from '@statdash/engine'
import type { StepInputOffer } from '../pipeline-preview/stepInput'
import type { Locale } from '../../../types/constructor'
import { FieldPicker } from '../editors/query/steps/offer/FieldPicker'
import { MemberPicker } from '../editors/query/steps/offer/MemberPicker'

export interface GetGrainEditorProps {
  /** The governed head's current `where` pins (dim → single member). */
  where:    Partial<Record<string, DimVal>>
  onChange: (next: Partial<Record<string, DimVal>>) => void
  /** The source browse OFFER (governed columns + distinct member values). Absent ⇒ hidden
   *  (nothing to offer — the honest empty state, never a dead free-text grain). */
  input?:   StepInputOffer
  locale:   Locale
}

interface Pin { dim: string; value: DimVal | null }

function readPins(where: Partial<Record<string, DimVal>>): Pin[] {
  return Object.entries(where).map(([dim, value]) => ({ dim, value: value ?? null }))
}
function toWhere(pins: Pin[]): Partial<Record<string, DimVal>> {
  const out: Partial<Record<string, DimVal>> = {}
  for (const p of pins) {
    if (p.dim.trim() === '' || p.value === null || p.value === undefined) continue
    out[p.dim] = p.value
  }
  return out
}

export function GetGrainEditor({ where, onChange, input, locale }: GetGrainEditorProps) {
  const en = locale === 'en'
  const pinCount = Object.keys(where).length
  const [open, setOpen] = useState(false)
  const [pins, setPins] = useState<Pin[]>(() => readPins(where))
  const lastEmitted = useRef<Partial<Record<string, DimVal>>>(where)

  useEffect(() => {
    if (JSON.stringify(where) !== JSON.stringify(lastEmitted.current)) {
      lastEmitted.current = where
      setPins(readPins(where))
    }
  }, [where])

  const emit = (next: Pin[]) => {
    setPins(next)
    const w = toWhere(next)
    lastEmitted.current = w
    onChange(w)
  }
  const update = (i: number, next: Pin) => emit(pins.map((p, idx) => (idx === i ? next : p)))
  const add = () => emit([...pins, { dim: '', value: null }])
  const remove = (i: number) => emit(pins.filter((_p, idx) => idx !== i))

  if (!input) return null

  const label = (dim: string) => input.columns.find((c) => c.field === dim)?.label ?? dim

  return (
    <Box data-testid="get-grain" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Button
        size="small"
        startIcon={<TuneIcon fontSize="small" />}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="get-grain-toggle"
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        {en ? 'Read area' : 'წაკითხვის არე'}
        {pinCount > 0 && (
          <Chip size="small" label={pinCount} color="primary" sx={{ ml: 0.75, height: 18, '& .MuiChip-label': { px: 0.75, fontSize: 11 } }} />
        )}
      </Button>

      {open && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pl: 1 }}>
          {pins.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              {en ? 'No pins — the source browses the full grain.' : 'პინები არ არის — წყარო კითხულობს სრულ არეს.'}
            </Typography>
          )}
          {pins.map((pin, i) => (
            <Box
              key={i}
              sx={{ display: 'flex', flexDirection: 'column', gap: 0.5,
                border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.75 }}
            >
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FieldPicker
                  columns={input.columns}
                  value={pin.dim}
                  onChange={(dim) => update(i, { dim, value: null })}
                  label={en ? 'Dimension' : 'განზომილება'}
                  placeholder={en ? 'Pick a dimension' : 'აირჩიეთ განზომილება'}
                  sx={{ width: 160 }}
                />
                <Box sx={{ flex: 1 }} />
                <IconButton
                  size="small"
                  aria-label={en ? 'Remove pin' : 'პინის წაშლა'}
                  onClick={() => remove(i)}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              {pin.dim !== '' && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {en ? `Pin “${label(pin.dim)}” to:` : `დააფიქსირე „${label(pin.dim)}“:`}
                  </Typography>
                  <MemberPicker
                    offers={input.valuesFor(pin.dim)}
                    selected={pin.value === null ? [] : [pin.value]}
                    onChange={(next) => update(i, { dim: pin.dim, value: next[next.length - 1] ?? null })}
                    locale={locale}
                    single
                    ariaLabel={en ? 'Pin value' : 'პინის მნიშვნელობა'}
                  />
                </>
              )}
            </Box>
          ))}
          <Box>
            <Button size="small" startIcon={<AddIcon />} onClick={add}>
              {en ? 'Add pin' : 'პინის დამატება'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
