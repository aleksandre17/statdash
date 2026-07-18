import { useEffect, useRef, useState } from 'react'
import { Box, Button, IconButton, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { DimVal, TransformStep } from '@statdash/engine'
import { useActiveLocales } from '../../../../../inspector/useActiveLocales'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { FieldPicker } from './offer/FieldPicker'
import { MemberPicker } from './offer/MemberPicker'

// ── FilterStepForm — op=filter: where conditions, OFFER-DRIVEN (P-OFFER · SPEC §3) ─
//
//  The engine `filter` step is `{ op:'filter', where: Record<field, FilterValue> }`
//  (keep rows where every condition holds — AND). The editor edits `where` directly:
//  one field=value row per condition.
//
//  P-OFFER (owner 2026-07-18): the author never TYPES an identifier. When the step's
//  INPUT offer is available (the workbench passes the SAME rows the grid renders):
//    • Column = a Select over the input's governed columns (FieldPicker) — never a
//      guessed column key.
//    • Value  = the column's ACTUAL distinct members, governed-labeled, as an Excel
//      AutoFilter checkbox list (MemberPicker). Checked set → the engine `where`
//      semantics UNCHANGED: one → the scalar, many → the IN-array. The engine filter
//      grammar is equality/IN only (`FilterValue = DimVal | DimVal[] | CtxRef | NeRef`)
//      — a numeric comparator row (>, <, between) is a LEDGERED follow-up, not invented
//      in the panel.
//  Honest fallback (Law 11): no offer (rows unavailable / legacy editor path), or a
//  value the offer can't represent (a `$ctx`/`$ne` object), degrades to free text —
//  never a dead control. Free text still coerces numbers + `,`-splits into an IN array.
//

type FilterStep = Extract<TransformStep, { op: 'filter' }>
type FilterVal = FilterStep['where'][string]

export interface FilterStepFormProps {
  step:     FilterStep
  onChange: (next: FilterStep) => void
  /** The step's input OFFER (columns + distinct member values). Absent ⇒ free text. */
  input?:   StepInputOffer
}

// ── The per-row draft (draft-over-canonical) ───────────────────────────────────────
//  A condition renders either as an offered member PICK (checked codes) or as free
//  TEXT — the two representations the engine `where` value can take through this form.
interface TextCond { field: string; kind: 'text'; raw: string }
interface PickCond { field: string; kind: 'pick'; codes: DimVal[] }
type Cond = TextCond | PickCond

function isScalar(v: unknown): v is DimVal {
  return typeof v === 'string' || typeof v === 'number'
}

/** A `where` value → its member CODES, or `null` when it can't be a member pick (a
 *  `$ctx`/`$ne` object) — those stay free text so the form never loses a stored ref. */
function toCodes(v: FilterVal): DimVal[] | null {
  if (Array.isArray(v)) return v.every(isScalar) ? (v as DimVal[]) : null
  if (v !== null && typeof v === 'object') return null
  return isScalar(v) ? [v] : null
}

function stringifyValue(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v === undefined || v === null ? '' : String(v)
}

function parseValue(raw: string): FilterVal {
  const trimmed = raw.trim()
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((s) => coerce(s.trim())) as FilterVal
  }
  return coerce(trimmed) as FilterVal
}

function coerce(s: string): string | number {
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s)
  return s
}

function readConds(step: FilterStep, input?: StepInputOffer): Cond[] {
  const offered = input ? new Set(input.columns.map((c) => c.field)) : null
  return Object.entries(step.where).map(([field, v]) => {
    if (offered?.has(field)) {
      const codes = toCodes(v)
      if (codes) return { field, kind: 'pick', codes }
    }
    return { field, kind: 'text', raw: stringifyValue(v) }
  })
}

function toStep(conds: Cond[]): FilterStep {
  const where: FilterStep['where'] = {}
  for (const c of conds) {
    if (c.field.trim() === '') continue
    if (c.kind === 'pick') {
      if (c.codes.length === 0) continue // an empty pick is no condition (Excel: nothing chosen)
      where[c.field] = c.codes.length === 1 ? c.codes[0] : c.codes
    } else {
      where[c.field] = parseValue(c.raw)
    }
  }
  return { op: 'filter', where }
}

export function FilterStepForm({ step, onChange, input }: FilterStepFormProps) {
  const locale = useActiveLocales()[0] ?? 'ka'
  const en = locale === 'en'

  // DRAFT-over-canonical (the controlled-form-over-record pattern): the UI keeps
  // in-progress rows (incl. EMPTY ones) in local state; the canonical step only ever
  // carries COMPLETE conditions (toStep drops empty fields / empty picks — correct for
  // config). Without the draft, an added empty row was projected away by toStep and
  // re-derived from the unchanged `where` → "add condition" did NOTHING (owner-caught,
  // 2026-07-18). External step changes (as-of switch, undo) reseed via lastEmitted.
  const [conds, setConds] = useState<Cond[]>(() => readConds(step, input))
  const lastEmitted = useRef<FilterStep['where']>(step.where)
  useEffect(() => {
    if (JSON.stringify(step.where) !== JSON.stringify(lastEmitted.current)) {
      lastEmitted.current = step.where
      setConds(readConds(step, input))
    }
  }, [step.where, step, input])

  const emit = (next: Cond[]) => {
    setConds(next)
    const s = toStep(next)
    lastEmitted.current = s.where
    onChange(s)
  }
  const updateCond = (index: number, next: Cond) =>
    emit(conds.map((c, i) => (i === index ? next : c)))

  // Changing the COLUMN resets the value (Excel: a fresh column, a fresh pick). The new
  // row's mode follows whether the input offers the chosen column.
  const changeField = (index: number, field: string) => {
    const offered = input?.columns.some((c) => c.field === field) ?? false
    updateCond(index, offered ? { field, kind: 'pick', codes: [] } : { field, kind: 'text', raw: '' })
  }

  const addCond = () => emit([...conds, { field: '', kind: 'text', raw: '' }])
  const removeCond = (index: number) => emit(conds.filter((_c, i) => i !== index))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conds.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'No conditions (every row passes)' : 'პირობები არ არის (ყველა სტრიქონი გაივლის)'}
        </Typography>
      )}
      {conds.map((cond, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <FieldPicker
            columns={input?.columns}
            value={cond.field}
            onChange={(field) => changeField(index, field)}
            label={en ? 'Column' : 'სვეტი'}
            placeholder={en ? 'Pick a column' : 'აირჩიეთ სვეტი'}
            sx={{ width: 160 }}
          />
          {cond.kind === 'pick' && input ? (
            <MemberPicker
              offers={input.valuesFor(cond.field)}
              selected={cond.codes}
              onChange={(codes) => updateCond(index, { field: cond.field, kind: 'pick', codes })}
              locale={locale}
            />
          ) : (
            <TextField
              size="small"
              label={en ? 'Value (comma = IN)' : 'მნიშვნელობა (მძიმით = IN)'}
              value={cond.kind === 'text' ? cond.raw : ''}
              onChange={(e) => updateCond(index, { field: cond.field, kind: 'text', raw: e.target.value })}
              sx={{ flex: 1 }}
            />
          )}
          <IconButton
            size="small"
            aria-label={en ? 'Remove condition' : 'პირობის წაშლა'}
            onClick={() => removeCond(index)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addCond}>
          {en ? 'Add condition' : 'პირობის დამატება'}
        </Button>
      </Box>
    </Box>
  )
}
