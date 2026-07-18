// ── TransformStepEditor — the GENERIC ROLE-PROJECTING step editor (card 0087) ──────
//
//  The Authoring Canon's P-OFFER projection (owner 2026-07-18: «მთელ პაიპლაინზე
//  ვრცელდებოდეს შემოთავაზებები … არაფერი გამორჩეს»). ONE generic editor renders ANY
//  transform op by reading the op's PropSchema (carried in the engine step-registry) and
//  PROJECTING each field to an OFFERED control by its declared `role`:
//    • field   → FieldPicker (single) / a column checklist (array) — pick input columns
//    • member  → MemberPicker (Excel AutoFilter) over the `memberOf` column's values
//    • newName → free text (the produced name does not exist yet — nothing to offer)
//    • expr    → ExprAutocompleteInput, scope EXTENDED by the input columns + a LIVE
//                per-row preview through the ONE evaluator (applyStep / @statdash/expr)
//    • literal → typed input (a select when options are declared)
//  Composite fields (aggregate.aggregations, group.by) carry an itemSchema — the projector
//  RECURSES, so each item's sub-fields get their own offered controls. No bespoke per-op
//  form, no raw JSON staring back (Refusal #4). Agnostic: every offer derives from the
//  step's LIVE input rows, so tomorrow's new dimension appears with zero code change (Law 1).
//
//  Honest fallback (Law 11): with no input offer (rows unavailable / legacy path) every
//  control degrades to free text — never a dead control. A field with no role falls back to
//  a typed literal input (FF-ROLE-COVERAGE keeps that set empty for the built-in inventory).
//
import { useMemo } from 'react'
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import type { DimVal, PropField, TransformStep } from '@statdash/engine'
import { getTransformStepSchema } from '@statdash/engine'
import { getAtPath, setAtPath } from '../../../../../inspector/showWhen'
import { useActiveLocales } from '../../../../../inspector/useActiveLocales'
import type { Locale } from '../../../../../types/constructor'
import type { StepInputOffer } from '../../../pipeline-preview/stepInput'
import { exprScopeSuggestions, previewStep } from '../../../pipeline-preview/exprStepScope'
import { ExprAutocompleteInput } from '../../../../../inspector/controls/binding/ExprAutocompleteInput'
import { ChipInput } from '../ChipInput'
import { FieldPicker } from './offer/FieldPicker'
import { MemberPicker } from './offer/MemberPicker'

export interface TransformStepEditorProps {
  step:     TransformStep
  onChange: (next: TransformStep) => void
  /** The step's INPUT offer (columns + distinct members + sample rows). Drives the
   *  pick-don't-type controls + the live expr preview; absent ⇒ the free-text fallback. */
  input?:   StepInputOffer
}

// ── LocaleString → display string ───────────────────────────────────────────────────
function lbl(value: unknown, locale: Locale): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    const bag = value as Record<string, string>
    return bag[locale] ?? bag['en'] ?? Object.values(bag)[0] ?? ''
  }
  return String(value)
}

const asStr = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// ── The projector ────────────────────────────────────────────────────────────────
export function TransformStepEditor({ step, onChange, input }: TransformStepEditorProps) {
  const locale = (useActiveLocales()[0] ?? 'ka') as Locale
  const schema = getTransformStepSchema(step.op) ?? []
  if (schema.length === 0) return null // StepForm's RawStepForm covers the schema-less ops

  const patch = (fieldPath: string, value: unknown) =>
    onChange(setAtPath(step as unknown as Record<string, unknown>, fieldPath, value) as unknown as TransformStep)

  return (
    <Box data-testid="transform-step-editor" sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {(schema as PropField[]).map((f) => (
        <RoleField
          key={f.field}
          field={f}
          fieldPath={f.field}
          idBase={`step-${f.field}`}
          value={getAtPath(step as unknown as Record<string, unknown>, f.field)}
          onChange={(v) => patch(f.field, v)}
          step={step}
          input={input}
          locale={locale}
        />
      ))}
    </Box>
  )
}

// ── RoleField — the ONE role→control dispatch ───────────────────────────────────────
interface RoleFieldProps {
  field:     PropField
  /** Dot-path of THIS field within the step (for sibling reads like `memberOf`). */
  fieldPath: string
  idBase:    string
  value:     unknown
  onChange:  (v: unknown) => void
  step:      TransformStep
  input?:    StepInputOffer
  locale:    Locale
}

function RoleField(props: RoleFieldProps) {
  const { field, value, onChange, input, locale } = props
  const { type, role } = field
  const label = lbl(field.label, locale) + (field.required ? ' *' : '')

  // ── Containers ────────────────────────────────────────────────────────────────
  if (type === 'array' && field.itemSchema && field.itemSchema.length > 0) {
    return <StructuredListField {...props} label={label} />
  }
  if (type === 'array') {
    if (role === 'member') return <MemberArrayField {...props} label={label} />
    if (role === 'field')  return <ColumnChecklistField {...props} label={label} />
    // newName / literal arrays → a free chip list (join fields, metrics, …).
    return (
      <FieldBlock label={label}>
        <ChipInput label="" value={asArr(value).map(asStr)} onChange={(next) => onChange(next)} />
      </FieldBlock>
    )
  }
  if (type === 'object') {
    if (role === 'field') return <KeyValueMapField {...props} label={label} />
    return <JsonObjectField {...props} label={label} />
  }

  // ── Scalars by role ───────────────────────────────────────────────────────────
  switch (role) {
    case 'field':
      return (
        <FieldBlock label={label}>
          <FieldPicker
            columns={input?.columns}
            value={asStr(value)}
            onChange={onChange}
            label=""
            id={props.idBase}
            placeholder={locale === 'en' ? 'Pick a column' : 'აირჩიეთ სვეტი'}
            sx={{ width: '100%' }}
          />
        </FieldBlock>
      )
    case 'member':
      return <MemberScalarField {...props} label={label} />
    case 'expr':
      return <ExprField {...props} label={label} />
    case 'newName':
      return (
        <TextField
          size="small" label={label} value={asStr(value)}
          onChange={(e) => onChange(e.target.value)}
          slotProps={{ htmlInput: { id: props.idBase } }}
        />
      )
    case 'literal':
    default:
      return <LiteralField {...props} label={label} />
  }
}

// ── FieldBlock — a labeled wrapper for controls that are not native TextFields ──────
function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {children}
    </Box>
  )
}

// ── LiteralField — a constant / enum: select (options) · number · boolean · text ───
function LiteralField({ field, value, onChange, idBase, locale, label }: RoleFieldProps & { label: string }) {
  if (field.options && field.options.length > 0) {
    return (
      <TextField
        select size="small" label={label} value={asStr(value)}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ htmlInput: { id: idBase } }}
      >
        {field.options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{lbl(o.label, locale)}</MenuItem>
        ))}
      </TextField>
    )
  }
  if (field.type === 'number') {
    return (
      <TextField
        size="small" type="number" label={label}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        slotProps={{ htmlInput: { id: idBase } }}
      />
    )
  }
  if (field.type === 'boolean') {
    return (
      <FormControlLabel
        control={<Checkbox size="small" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />}
        label={label}
      />
    )
  }
  return (
    <TextField
      size="small" label={label} value={asStr(value)}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ htmlInput: { id: idBase } }}
    />
  )
}

// ── ColumnChecklistField — pick MANY input columns (groupBy, select.fields, …) ──────
function ColumnChecklistField({ value, onChange, input, label, locale }: RoleFieldProps & { label: string }) {
  const selected = asArr(value).map(asStr)
  if (!input || input.columns.length === 0) {
    return (
      <FieldBlock label={label}>
        <ChipInput label="" value={selected} onChange={(next) => onChange(next)} />
      </FieldBlock>
    )
  }
  const toggle = (fieldKey: string, checked: boolean) =>
    onChange(checked ? [...selected.filter((s) => s !== fieldKey), fieldKey] : selected.filter((s) => s !== fieldKey))
  return (
    <FieldBlock label={label}>
      <Box
        role="group" aria-label={label}
        sx={{ display: 'flex', flexDirection: 'column', maxHeight: 180, overflowY: 'auto',
          border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}
      >
        {input.columns.map((c) => (
          <FormControlLabel
            key={c.field}
            control={<Checkbox size="small" checked={selected.includes(c.field)}
              onChange={(e) => toggle(c.field, e.target.checked)} />}
            label={<Typography variant="body2">{c.label}</Typography>}
            sx={{ m: 0 }}
          />
        ))}
      </Box>
      {selected.filter((s) => !input.columns.some((c) => c.field === s)).map((extra) => (
        <Typography key={extra} variant="caption" color="text.secondary">
          {locale === 'en' ? `kept: ${extra}` : `დატოვებული: ${extra}`}
        </Typography>
      ))}
    </FieldBlock>
  )
}

// ── MemberArrayField — pick MANY members of the `memberOf` column (rollup.of) ────────
function MemberArrayField({ field, value, onChange, step, input, label, locale }: RoleFieldProps & { label: string }) {
  const column = field.memberOf
    ? asStr(getAtPath(step as unknown as Record<string, unknown>, field.memberOf))
    : ''
  const codes = asArr(value).filter((v) => v !== '*') as DimVal[]
  if (!input || !column) {
    return (
      <FieldBlock label={label}>
        <ChipInput label="" value={asArr(value).map(asStr)} onChange={(next) => onChange(next)} />
      </FieldBlock>
    )
  }
  return (
    <FieldBlock label={label}>
      <MemberPicker offers={input.valuesFor(column)} selected={codes}
        onChange={(next) => onChange(next)} locale={locale} />
    </FieldBlock>
  )
}

// ── MemberScalarField — a single member of the `memberOf` column ─────────────────────
function MemberScalarField({ field, value, onChange, step, input, label, locale }: RoleFieldProps & { label: string }) {
  const column = field.memberOf
    ? asStr(getAtPath(step as unknown as Record<string, unknown>, field.memberOf))
    : ''
  if (!input || !column) {
    return (
      <TextField size="small" label={label} value={asStr(value)} onChange={(e) => onChange(e.target.value)} />
    )
  }
  return (
    <FieldBlock label={label}>
      <MemberPicker
        offers={input.valuesFor(column)}
        selected={value === undefined || value === '' ? [] : [value as DimVal]}
        onChange={(next) => onChange(next[next.length - 1])}
        locale={locale}
      />
    </FieldBlock>
  )
}

// ── ExprField — the Power-Query Custom-Column moment (autocomplete + live preview) ──
function ExprField({ value, onChange, step, input, idBase, label, locale }: Omit<RoleFieldProps, 'field'> & { label: string }) {
  const en = locale === 'en'
  const scope = useMemo(() => exprScopeSuggestions(input?.columns ?? [], locale), [input, locale])
  // The produced column = the sibling newName (`as`) OR legacy `name`; the preview reads it.
  const rec = step as unknown as Record<string, unknown>
  const target = asStr(rec['as'] ?? rec['name'])
  const preview = useMemo(
    () => previewStep(step, target, input?.sampleRows ?? [], locale),
    [step, target, input, locale],
  )
  const labelCol = input?.columns[0]?.field

  return (
    <FieldBlock label={label}>
      <ExprAutocompleteInput
        id={idBase}
        value={asStr(value)}
        onChange={(next) => onChange(next)}
        vocabulary={scope}
        placeholder={en ? 'formula — e.g. value / total * 100' : 'ფორმულა — მაგ. value / total * 100'}
      />
      {/* Live per-row preview (bounded sample) — the value the formula produces, per row. */}
      {preview.error && (
        <Typography variant="caption" color="warning.main">{preview.error}</Typography>
      )}
      {!preview.error && preview.rows.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25,
          border: '1px dashed', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {en ? 'Preview (sample rows)' : 'გადახედვა (ნიმუში სტრიქონები)'}
          </Typography>
          {preview.rows.slice(0, 6).map((r, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              {labelCol && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
                  {asStr(r.input[labelCol])}
                </Typography>
              )}
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {asStr(r.value)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </FieldBlock>
  )
}

// ── KeyValueMapField — a field→value map keyed by input columns (rename / cast / where) ─
function KeyValueMapField({ value, onChange, input, label, locale }: Omit<RoleFieldProps, 'field'> & { label: string }) {
  const en = locale === 'en'
  const entries = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>) : []

  const emit = (next: Array<[string, unknown]>) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of next) if (k.trim() !== '') out[k] = v
    onChange(out)
  }
  const updateKey = (i: number, key: string) =>
    emit(entries.map((e, idx) => (idx === i ? [key, e[1]] : e)))
  const updateVal = (i: number, val: string) =>
    emit(entries.map((e, idx) => (idx === i ? [e[0], val] : e)))
  const add = () => emit([...entries, ['', '']])
  const remove = (i: number) => emit(entries.filter((_e, idx) => idx !== i))

  return (
    <FieldBlock label={label}>
      {entries.map(([k, v], i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FieldPicker
            columns={input?.columns} value={k} onChange={(key) => updateKey(i, key)}
            label="" placeholder={en ? 'column' : 'სვეტი'} sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.secondary">→</Typography>
          <TextField size="small" value={asStr(v)} onChange={(e) => updateVal(i, e.target.value)} sx={{ flex: 1 }} />
          <IconButton size="small" aria-label={en ? 'Remove' : 'წაშლა'} onClick={() => remove(i)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box><Button size="small" startIcon={<AddIcon />} onClick={add}>{en ? 'Add' : 'დამატება'}</Button></Box>
    </FieldBlock>
  )
}

// ── JsonObjectField — the honest fallback for a genuinely-opaque object (lookup.from …) ─
function JsonObjectField({ value, onChange, idBase, label, locale }: RoleFieldProps & { label: string }) {
  const text = value === undefined ? '' : JSON.stringify(value, null, 2)
  return (
    <FieldBlock label={label}>
      <TextField
        size="small" multiline minRows={2} defaultValue={text}
        onChange={(e) => {
          try { onChange(JSON.parse(e.target.value)) } catch { /* keep last valid */ }
        }}
        slotProps={{ htmlInput: { id: idBase }, input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
        helperText={locale === 'en' ? 'JSON' : 'JSON'}
      />
    </FieldBlock>
  )
}

// ── StructuredListField — a list of items, each authored by its itemSchema (aggregations) ─
function StructuredListField({ field, value, onChange, step, input, idBase, label, locale }: RoleFieldProps & { label: string }) {
  const en = locale === 'en'
  const items = asArr(value)
  const sub = field.itemSchema ?? []

  const updateItem = (i: number, next: unknown) =>
    onChange(items.map((it, idx) => (idx === i ? next : it)))
  const add = () => onChange([...items, {}])
  const remove = (i: number) => onChange(items.filter((_it, idx) => idx !== i))

  return (
    <FieldBlock label={label}>
      {items.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {en ? 'None yet' : 'ჯერ არაფერია'}
        </Typography>
      )}
      {items.map((item, i) => {
        const rec = (item ?? {}) as Record<string, unknown>
        return (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 1,
            border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, position: 'relative' }}>
            {(sub as PropField[]).map((sf) => (
              <RoleField
                key={sf.field}
                field={sf}
                fieldPath={sf.field}
                idBase={`${idBase}-${i}-${sf.field}`}
                value={rec[sf.field]}
                onChange={(v) => updateItem(i, setAtPath(rec, sf.field, v))}
                step={step}
                input={input}
                locale={locale}
              />
            ))}
            <IconButton size="small" aria-label={en ? 'Remove' : 'წაშლა'} onClick={() => remove(i)}
              sx={{ position: 'absolute', top: 2, right: 2 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )
      })}
      <Box><Button size="small" startIcon={<AddIcon />} onClick={add}>{en ? 'Add' : 'დამატება'}</Button></Box>
    </FieldBlock>
  )
}
