// ── CalcBuilder — the visual measure-algebra builder (AR-49 M3.0, spec §3) ───────
//
//  The Steward composes a DERIVED metric by PICKING governed metrics as operands and
//  a small algebra vocabulary — never typing a formula (Law 2). Two progressive modes
//  (spec §3.2.3):
//    • Template (default, non-programmer): pick a shape (Ratio / Percentage /
//      Difference / Sum / Weighted) + assign operands → the @statdash/expr tree is
//      GENERATED. Form-based, the most accessible path.
//    • Advanced (power-steward escape hatch): a tiny visual expression tree
//      (ExprTreeEditor) that emits the same whitelisted @statdash/expr 1:1.
//
//  Output is a pure `ManifestMetricCalc{inputs, expr}` (FF-CALC-AUTHORING-SERIALIZABLE)
//  the runtime evaluates through the ONE `evalExpr` seam — no second dialect, no eval
//  (FF-CALC-EXPR-SANDBOXED). A live bracketed-formula preview (`aria-live`) is the WCAG
//  text alternative (spec §3.4): the steward hears "GDP divided by population".
//
import { useMemo, useState } from 'react'
import {
  Box, Stack, Select, MenuItem, FormControl, InputLabel, FormLabel, IconButton,
  Typography, Button, ToggleButtonGroup, ToggleButton, TextField, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { ManifestMetric, ManifestMetricCalc, ManifestMetricInput } from '@statdash/contracts'
import type { ExprVal } from '@statdash/expr'
import type { Locale } from '../../types/constructor'
import { readCatalogLabel } from '../../discovery/semanticCatalogOptions'
import {
  CALC_TEMPLATES, getCalcTemplate, buildTemplateExpr, nextInputName,
  orderedInputs, exprToFormula,
} from './metricCalc'
import { ExprTreeEditor } from './ExprTreeEditor'

export interface CalcBuilderProps {
  calc:           ManifestMetricCalc
  /** The governed-metric operand universe (self excluded by the picker). */
  catalogMetrics: ManifestMetric[]
  /** This metric's own id — excluded from the operand picker (no self-reference). */
  selfId:         string
  locale:         Locale
  onChange:       (calc: ManifestMetricCalc) => void
}

export function CalcBuilder({ calc, catalogMetrics, selfId, locale, onChange }: CalcBuilderProps) {
  const en = locale === 'en'
  const [mode, setMode] = useState<'template' | 'advanced'>('template')
  const [templateId, setTemplateId] = useState<string>('ratio')
  const [literalK, setLiteralK] = useState<number>(1)

  const inputs = orderedInputs(calc)
  const inputNames = inputs.map(([name]) => name)

  // name → operand display label (its picked governed metric's label; falls back to id).
  const metricById = useMemo(
    () => new Map(catalogMetrics.map((m) => [m.id, m])),
    [catalogMetrics],
  )
  const labelOf = (name: string): string => {
    const measure = calc.inputs[name]?.measure
    if (!measure) return name
    const m = metricById.get(measure)
    return m ? readCatalogLabel(m.label, locale, m.id) : measure
  }

  const operandOptions = catalogMetrics.filter((m) => m.id !== selfId)

  // Commit new inputs, regenerating the template expr when in template mode so the
  // preview stays in lockstep with the operand assignment (advanced edits are kept).
  const commitInputs = (nextInputs: Record<string, ManifestMetricInput>) => {
    const names = Object.keys(nextInputs)
    let expr: ExprVal = calc.expr as ExprVal
    if (mode === 'template') {
      const built = buildTemplateExpr(templateId, names, literalK)
      if (built) expr = built
    }
    onChange({ inputs: nextInputs, expr })
  }

  const addOperand = () => {
    const name = nextInputName(inputNames)
    commitInputs({ ...calc.inputs, [name]: { measure: '' } })
  }
  const setOperandMeasure = (name: string, measure: string) => {
    commitInputs({ ...calc.inputs, [name]: { ...calc.inputs[name], measure } })
  }
  const removeOperand = (name: string) => {
    const next = { ...calc.inputs }
    delete next[name]
    commitInputs(next)
  }

  const applyTemplate = (nextTemplateId: string, nextLiteral: number) => {
    setTemplateId(nextTemplateId)
    setLiteralK(nextLiteral)
    const built = buildTemplateExpr(nextTemplateId, inputNames, nextLiteral)
    if (built) onChange({ ...calc, expr: built })
  }

  const changeMode = (next: 'template' | 'advanced' | null) => {
    if (!next) return
    setMode(next)
    // Entering template mode re-applies the current shape so the tree reflects it.
    if (next === 'template') {
      const built = buildTemplateExpr(templateId, inputNames, literalK)
      if (built) onChange({ ...calc, expr: built })
    }
  }

  const template = getCalcTemplate(templateId)
  const formula = exprToFormula(calc.expr, labelOf)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── Operands — pick governed metrics (never type a code, Law 2) ── */}
      <Box>
        <FormLabel component="legend" sx={{ fontSize: 12 }}>
          {en ? 'Operands (governed metrics)' : 'ოპერანდები (მართული მეტრიკები)'}
        </FormLabel>
        <Stack spacing={0.75} sx={{ mt: 0.5 }}>
          {inputs.map(([name, input]) => (
            <Stack key={name} direction="row" spacing={1} alignItems="center">
              <Chip label={name.toUpperCase()} size="small" color="primary" variant="outlined" sx={{ minWidth: 40 }} />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel id={`operand-${name}`}>{en ? 'Metric' : 'მეტრიკა'}</InputLabel>
                <Select
                  labelId={`operand-${name}`}
                  label={en ? 'Metric' : 'მეტრიკა'}
                  value={input.measure}
                  onChange={(e) => setOperandMeasure(name, e.target.value)}
                >
                  {operandOptions.length === 0 && (
                    <MenuItem value="" disabled>{en ? 'No governed metrics available' : 'მართული მეტრიკები არ არის'}</MenuItem>
                  )}
                  {operandOptions.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{readCatalogLabel(m.label, locale, m.id)} ({m.id})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size="small" aria-label={`${en ? 'Remove operand' : 'ოპერანდის წაშლა'} ${name}`} onClick={() => removeOperand(name)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button size="small" variant="text" startIcon={<AddIcon />} onClick={addOperand} sx={{ alignSelf: 'flex-start' }}>
            {en ? 'Add operand' : 'ოპერანდის დამატება'}
          </Button>
        </Stack>
      </Box>

      {/* ── Compose the algebra — Template (default) or Advanced tree ── */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <FormLabel component="legend" sx={{ fontSize: 12 }}>
            {en ? 'Composition' : 'კომპოზიცია'}
          </FormLabel>
          <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => changeMode(v)}
            aria-label={en ? 'Composition mode' : 'კომპოზიციის რეჟიმი'}>
            <ToggleButton value="template">{en ? 'Template' : 'შაბლონი'}</ToggleButton>
            <ToggleButton value="advanced">{en ? 'Advanced' : 'დამატებითი'}</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {mode === 'template' ? (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="calc-template">{en ? 'Algebra shape' : 'ალგებრის ფორმა'}</InputLabel>
              <Select
                labelId="calc-template"
                label={en ? 'Algebra shape' : 'ალგებრის ფორმა'}
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value, literalK)}
              >
                {CALC_TEMPLATES.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{en ? t.label.en : t.label.ka}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {template?.literal && (
              <TextField
                size="small" type="number" sx={{ width: 120 }}
                label={en ? 'Factor (k)' : 'კოეფიციენტი (k)'}
                value={literalK}
                onChange={(e) => applyTemplate(templateId, Number(e.target.value))}
              />
            )}
          </Stack>
        ) : (
          <ExprTreeEditor
            node={calc.expr as ExprVal}
            onChange={(next) => onChange({ ...calc, expr: next })}
            inputNames={inputNames}
            labelOf={labelOf}
            en={en}
          />
        )}
      </Box>

      {/* ── Live formula preview — the WCAG text alternative (aria-live, spec §3.4) ── */}
      <Box
        role="status"
        aria-live="polite"
        aria-label={en ? 'Formula preview' : 'ფორმულის გადახედვა'}
        sx={{ p: 1, borderRadius: 1, bgcolor: 'action.hover', fontFamily: 'monospace' }}
      >
        <Typography variant="caption" color="text.secondary" component="div">
          {en ? 'Formula' : 'ფორმულა'}
        </Typography>
        <Typography variant="body2" component="div">{formula}</Typography>
      </Box>
    </Box>
  )
}
