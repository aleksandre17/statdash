import { useMemo, useState } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Box,
  FormControl, InputLabel, MenuItem, Select, TextField, Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { DataSpec } from '@statdash/engine'
import { SPEC_CATALOG, resolveSpecAuthoring } from '@statdash/engine'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { getSpecEditor, type SpecEditor } from './specEditorRegistry'
import { specSchemaSource } from './specSchemaSource'
import type { CanvasNode } from '../../types/constructor'

// ── DataSpecEditor — type picker + GENERIC authoring surface (ADR-049 P1) ─────
//
//  Top: Select over SPEC_CATALOG (the DataSpec bind-kinds). Changing the type
//  seeds a fresh spec via the kind's engine-declared `make()` factory.
//  Below: the GENERIC renderer — it reads the kind's authoring contract from the
//  engine and dispatches: a declared `schema` → the SAME generic Inspector every
//  node/param/transform-step uses (specSchemaSource); a declared `editorKey` → the
//  boot-registered rich editor (specEditorRegistry). NO `switch (spec.type)`, no
//  per-kind editor import — a new bind-kind is one SPEC_CATALOG declaration, zero
//  edits here (FF-NO-DATASPEC-SWITCH). The steward raw-JSON editor stays only as a
//  last-resort disclosure (a kind that declares neither surface — never the default).
//  Bottom: collapsible JSON preview of the live spec.
//

type SpecType = DataSpec['type']

export interface DataSpecEditorProps {
  value:    DataSpec | null
  onChange: (spec: DataSpec) => void
}

export function DataSpecEditor({ value, onChange }: DataSpecEditorProps) {
  const currentType = value?.type ?? ''

  const handleTypeChange = (type: SpecType) => {
    if (type === value?.type) return
    const seed = resolveSpecAuthoring(type)?.make()
    if (seed) onChange(seed)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <FormControl size="small" fullWidth>
        <InputLabel id="dataspec-type-label">სპეც-ის ტიპი</InputLabel>
        <Select
          labelId="dataspec-type-label"
          label="სპეც-ის ტიპი"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as SpecType)}
        >
          {Object.entries(SPEC_CATALOG).map(([key, desc]) => (
            <MenuItem key={key} value={key}>
              {desc.label.ka} <Box component="span" sx={{ color: 'text.disabled', ml: 1 }}>({key})</Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {value && <SpecBody value={value} onChange={onChange} />}

      {value && (
        <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2" fontWeight={600}>JSON გამოსავალი</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="pre"
              sx={{
                m: 0, p: 1.5, bgcolor: 'action.hover', color: 'text.primary', borderRadius: 1,
                fontSize: 12, overflow: 'auto', fontFamily: 'monospace',
              }}
            >
              {JSON.stringify(value, null, 2)}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}

// ── SpecBody — the GENERIC authoring dispatch (no per-type branch) ────────────
//
//  Reads the kind's authoring contract from the engine and dispatches by DECLARATION,
//  never by a `switch (value.type)`:
//    editorKey (+ a registered editor) → the boot-registered rich editor
//    schema                            → the generic Inspector (specSchemaSource)
//    neither / unresolved              → the steward raw-JSON last-resort disclosure
//  A new bind-kind reaches its surface with ZERO edit here (FF-NO-DATASPEC-SWITCH).
//
//  Exported (ADR-051 DU3): the workbench co-locates THIS generic dispatch as its own
//  fallback lane for kinds the three panes can't yet shape — the ONE editing surface.
//  It carries NO kind <Select> (that stays the DataSpecEditor picker), so a pipeline
//  spec can never trip the picker's out-of-range warning through this lane.
//
export function SpecBody({ value, onChange }: { value: DataSpec; onChange: (spec: DataSpec) => void }) {
  const authoring = resolveSpecAuthoring(value.type)

  if (authoring?.editorKey) {
    const Editor = getSpecEditor(authoring.editorKey)
    // Pass the registry-resolved editor as a PROP to the slot (never render the
    // call-result inline) — the Inspector/ValueAuthoringControl precedent that keeps
    // the generic dispatch static-component-clean (react-hooks/static-components).
    if (Editor) return <SpecEditorSlot Editor={Editor} value={value} onChange={onChange} />
  }
  if (authoring?.schema && authoring.schema.length > 0) {
    return <SpecSchemaBody value={value} onChange={onChange} />
  }
  return <JsonFallback value={value} onChange={onChange} />
}

// ── SpecEditorSlot — render a registry-resolved rich editor (passed as a prop) ─
function SpecEditorSlot(
  { Editor, value, onChange }: { Editor: SpecEditor; value: DataSpec; onChange: (spec: DataSpec) => void },
) {
  return <Editor value={value} onChange={onChange} />
}

// ── SpecSchemaBody — a schema-arm DataSpec authored by the generic Inspector ──
//
//  The DataSpec is modeled as the Inspector's element `{ type, props: spec }` (the
//  SAME shape ParamDefEditor/TransformStepEditor use), its schema resolved through
//  specSchemaSource. `type` is in no schema, so the discriminant is carried through
//  untouched; each field write is applied immutably with setAtPath.
//
function SpecSchemaBody({ value, onChange }: { value: DataSpec; onChange: (spec: DataSpec) => void }) {
  const node: CanvasNode = useMemo(
    () => ({
      id:      `spec-${value.type}`,
      type:    value.type,
      props:   value as unknown as Record<string, unknown>,
      childIds: [],
    }),
    [value],
  )
  const handleChange = (field: string, next: unknown) =>
    onChange(setAtPath(value as unknown as Record<string, unknown>, field, next) as unknown as DataSpec)

  return <Inspector node={node} onChange={handleChange} schemaSource={specSchemaSource} />
}

// ── JsonFallback — textarea editor for not-yet-visual spec types ──────────────
function JsonFallback({ value, onChange }: { value: DataSpec; onChange: (spec: DataSpec) => void }) {
  const [draft, setDraft] = useState(() => safeStringify(value))
  const [error, setError] = useState<string | null>(null)

  const handleChange = (text: string) => {
    setDraft(text)
    try {
      const parsed = JSON.parse(text) as DataSpec
      if (parsed.type !== value.type) { setError('ტიპის შეცვლა აქ დაუშვებელია'); return }
      setError(null)
      onChange(parsed)
    } catch {
      setError('არასწორი JSON')
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        ვიზუალური რედაქტორი ამ ტიპისთვის ჯერ არ არის — დაარედაქტირეთ JSON
      </Typography>
      <TextField
        size="small" multiline minRows={6}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        error={error !== null}
        helperText={error ?? undefined}
        slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
      />
    </Box>
  )
}

function safeStringify(spec: DataSpec): string {
  return JSON.stringify(spec, null, 2)
}
