import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { DimVal, TransformStep } from '@statdash/engine'
import { useActiveLocales } from '../../../../../inspector/useActiveLocales'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { FieldPicker } from './offer/FieldPicker'
import { MemberPicker } from './offer/MemberPicker'

// ── FilterStepForm — op=filter: where conditions, OFFER-DRIVEN + FULL PARITY (card 0087) ─
//
//  The engine `filter` step is `{ op:'filter', where: Record<field, FilterValue> }`
//  (keep rows where every condition holds — AND). The editor edits `where` directly.
//  The engine `FilterValue = DimVal | DimVal[] | CtxRef | NeRef | NeCtxRef` — this form
//  OFFERS all of it (P-OFFER: the author never TYPES an identifier). When the step's
//  INPUT offer is present, each condition picks a COLUMN (FieldPicker) + a MODE:
//    • «კონკრეტული» (specific)        — the Excel AutoFilter checkbox list. Checked set →
//      `where` UNCHANGED: one → scalar, many → the IN-array.
//    • «მიჰყევი გვერდის არჩევანს» (follow) — emits `{$ctx: <dim>}`: the value tracks the
//      page's selection of that dimension at render (the Retool/Power BI field=parameter
//      class). Empty selection ⇒ the engine treats it as a wildcard (all rows pass).
//    • «ყველა, გარდა…» (except)        — emits `{$ne: v}`: keep everything EXCEPT one member
//      (incl. members that appear in tomorrow's data — the agnostic complement, Law 1).
//      Toggle "also follow page selection" ⇒ `{$ne: v, $ctx: <dim>}` (NeCtxRef): exclude
//      AND restrict to the page's selection. The engine `$ne` is a SINGLE DimVal, so the
//      exclusion picker is single-select (a multi-member exclusion is a ledgered engine
//      extension — array-$ne — not invented in the panel, Law 2).
//  Honest fallback (Law 11): no offer (legacy editor path), or a genuinely unrepresentable
//  stored shape, degrades to free text — never a dead control. A stored `$ctx`/`$ne` value
//  now renders as its MODE (no more free-text fallback for those two — card 0087).
//

type FilterStep = Extract<TransformStep, { op: 'filter' }>
type FilterVal = FilterStep['where'][string]

export interface FilterStepFormProps {
  step:     FilterStep
  onChange: (next: FilterStep) => void
  /** The step's input OFFER (columns + distinct member values). Absent ⇒ free text. */
  input?:   StepInputOffer
}

// ── The per-row draft (draft-over-canonical) — one Cond per stored condition ────────
//  A condition renders in one of four MODES — the shapes the engine `where` value takes.
interface TextCond     { field: string; kind: 'text';     raw: string }
interface SpecificCond { field: string; kind: 'specific'; codes: DimVal[] }
interface FollowCond   { field: string; kind: 'follow' }
interface ExceptCond   { field: string; kind: 'except';   exclude: DimVal | null; follow: boolean }
type Cond = TextCond | SpecificCond | FollowCond | ExceptCond
type Mode = Cond['kind']

function isScalar(v: unknown): v is DimVal {
  return typeof v === 'string' || typeof v === 'number'
}

/** A pure `{$ctx}` follow ref (no `$ne`). */
function asFollowRef(v: FilterVal): { $ctx: string } | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && '$ctx' in v && !('$ne' in v)
    ? (v as { $ctx: string }) : null
}
/** An exclusion ref (`{$ne}` or `{$ne,$ctx}`). */
function asExceptRef(v: FilterVal): { $ne: DimVal; $ctx?: string } | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && '$ne' in v
    ? (v as { $ne: DimVal; $ctx?: string }) : null
}

/** A `where` value → its member CODES, or `null` when it is not a plain literal / IN-array. */
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
  return Object.entries(step.where).map(([field, v]): Cond => {
    // Ref shapes render as their MODE when the workbench offer is present (card 0087).
    if (input) {
      if (asFollowRef(v)) return { field, kind: 'follow' }
      const ne = asExceptRef(v)
      if (ne) return { field, kind: 'except', exclude: ne.$ne, follow: '$ctx' in ne }
      if (offered?.has(field)) {
        const codes = toCodes(v)
        if (codes) return { field, kind: 'specific', codes }
      }
    }
    return { field, kind: 'text', raw: stringifyValue(v) }
  })
}

function toStep(conds: Cond[]): FilterStep {
  const where: FilterStep['where'] = {}
  for (const c of conds) {
    if (c.field.trim() === '') continue
    switch (c.kind) {
      case 'specific':
        if (c.codes.length === 0) continue // an empty pick is no condition (Excel: nothing chosen)
        where[c.field] = c.codes.length === 1 ? c.codes[0] : c.codes
        break
      case 'follow':
        where[c.field] = { $ctx: c.field } // track the page's selection of this dimension
        break
      case 'except':
        if (c.exclude === null || c.exclude === undefined) continue // nothing excluded ⇒ no condition
        where[c.field] = c.follow ? { $ne: c.exclude, $ctx: c.field } : { $ne: c.exclude }
        break
      case 'text':
        where[c.field] = parseValue(c.raw)
        break
    }
  }
  return { op: 'filter', where }
}

/** The empty draft for a freshly-chosen MODE (a column's fresh pick, Excel-style). */
function emptyForMode(field: string, mode: Mode): Cond {
  switch (mode) {
    case 'specific': return { field, kind: 'specific', codes: [] }
    case 'follow':   return { field, kind: 'follow' }
    case 'except':   return { field, kind: 'except', exclude: null, follow: false }
    case 'text':     return { field, kind: 'text', raw: '' }
  }
}

export function FilterStepForm({ step, onChange, input }: FilterStepFormProps) {
  const locale = useActiveLocales()[0] ?? 'ka'
  const en = locale === 'en'

  // DRAFT-over-canonical (the controlled-form-over-record pattern): the UI keeps
  // in-progress rows (incl. EMPTY ones) in local state; the canonical step only ever
  // carries COMPLETE conditions (toStep drops empty fields / empty picks). Without the
  // draft, an added empty row was projected away by toStep and re-derived from the
  // unchanged `where` → "add condition" did NOTHING (owner-caught 2026-07-18). External
  // step changes (as-of switch, undo) reseed via lastEmitted.
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

  // Changing the COLUMN resets the value (Excel: a fresh column, a fresh pick). An offered
  // column starts in specific mode; a non-offered one falls to free text.
  const changeField = (index: number, field: string) => {
    const offered = input?.columns.some((c) => c.field === field) ?? false
    updateCond(index, emptyForMode(field, offered ? 'specific' : 'text'))
  }
  const changeMode = (index: number, mode: Mode) =>
    updateCond(index, emptyForMode(conds[index].field, mode))

  const addCond = () => emit([...conds, { field: '', kind: 'text', raw: '' }])
  const removeCond = (index: number) => emit(conds.filter((_c, i) => i !== index))

  const columnLabel = (field: string) =>
    input?.columns.find((c) => c.field === field)?.label ?? field

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {conds.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'No conditions (every row passes)' : 'პირობები არ არის (ყველა სტრიქონი გაივლის)'}
        </Typography>
      )}
      {conds.map((cond, index) => (
        <Box
          key={index}
          sx={{ display: 'flex', flexDirection: 'column', gap: 0.75,
            border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FieldPicker
              columns={input?.columns}
              value={cond.field}
              onChange={(field) => changeField(index, field)}
              label={en ? 'Column' : 'სვეტი'}
              placeholder={en ? 'Pick a column' : 'აირჩიეთ სვეტი'}
              sx={{ width: 160 }}
            />
            {/* The MODE toggle — offered whenever the condition is one of the projected
                modes (an offered column). A free-text condition (non-offered / unrepresentable)
                shows no toggle: the honest fallback. */}
            {cond.kind !== 'text' && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={cond.kind}
                onChange={(_e, v: Mode | null) => v && changeMode(index, v)}
                aria-label={en ? 'Filter mode' : 'ფილტრის რეჟიმი'}
              >
                <ToggleButton value="specific" data-testid="filter-mode-specific">
                  {en ? 'Specific' : 'კონკრეტული'}
                </ToggleButton>
                <ToggleButton value="follow" data-testid="filter-mode-follow">
                  {en ? 'Follow page selection' : 'მიჰყევი გვერდის არჩევანს'}
                </ToggleButton>
                <ToggleButton value="except" data-testid="filter-mode-except">
                  {en ? 'All except…' : 'ყველა, გარდა…'}
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              aria-label={en ? 'Remove condition' : 'პირობის წაშლა'}
              onClick={() => removeCond(index)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* The mode-specific control. */}
          {cond.kind === 'specific' && input && (
            <MemberPicker
              offers={input.valuesFor(cond.field)}
              selected={cond.codes}
              onChange={(codes) => updateCond(index, { field: cond.field, kind: 'specific', codes })}
              locale={locale}
            />
          )}

          {cond.kind === 'follow' && (
            <Typography variant="caption" color="text.secondary" data-testid="filter-follow-note">
              {en
                ? `Tracks the page's “${columnLabel(cond.field)}” selection.`
                : `მიჰყვება გვერდის „${columnLabel(cond.field)}“ არჩევანს.`}
            </Typography>
          )}

          {cond.kind === 'except' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {en ? 'Keep everything except:' : 'დატოვე ყველა, გარდა:'}
              </Typography>
              {input ? (
                <MemberPicker
                  offers={input.valuesFor(cond.field)}
                  selected={cond.exclude === null ? [] : [cond.exclude]}
                  onChange={(next) =>
                    updateCond(index, { ...cond, kind: 'except', exclude: next[next.length - 1] ?? null })}
                  locale={locale}
                  single
                  ariaLabel={en ? 'Value to exclude' : 'გამოსარიცხი მნიშვნელობა'}
                />
              ) : (
                <TextField
                  size="small"
                  label={en ? 'Value to exclude' : 'გამოსარიცხი მნიშვნელობა'}
                  value={cond.exclude === null ? '' : String(cond.exclude)}
                  onChange={(e) =>
                    updateCond(index, { ...cond, kind: 'except', exclude: e.target.value === '' ? null : coerce(e.target.value) })}
                />
              )}
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={cond.follow}
                    onChange={(e) => updateCond(index, { ...cond, kind: 'except', follow: e.target.checked })}
                    data-testid="filter-except-follow"
                  />
                }
                label={
                  <Typography variant="caption">
                    {en ? 'Also follow page selection' : 'ასევე მიჰყევი გვერდის არჩევანს'}
                  </Typography>
                }
              />
            </Box>
          )}

          {cond.kind === 'text' && (
            <TextField
              size="small"
              label={en ? 'Value (comma = IN)' : 'მნიშვნელობა (მძიმით = IN)'}
              value={cond.raw}
              onChange={(e) => updateCond(index, { field: cond.field, kind: 'text', raw: e.target.value })}
            />
          )}
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
