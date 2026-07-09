// ── ExprTreeEditor — the tiny in-house visual expression-tree control (M3.0 T2) ──
//
//  AR-49 M3.0 (spec §3.2 advanced mode, §8). The whitelisted escape hatch: a
//  recursive, KEYBOARD-OPERABLE tree where every node is an operator (+ − × ÷), a
//  governed-metric operand, or a scalar literal — assembled from labelled menus,
//  NEVER a text/formula box (Law 2 / FF-CALC-EXPR-SANDBOXED). It emits a
//  `@statdash/expr` tree 1:1 with what the LIVE runtime evaluates — no schema fork,
//  no Blockly, ~one small component (spec §8's "cannon for a nail" ruling).
//
//  A node is one of: `{ op, left, right }` (operator), `{ $derived }` (operand ref),
//  or `{ $literal }` (scalar). The kind selector + operator/operand menus are all
//  native <Select>/<TextField> — focusable and operable without a pointer (Law 9).
//
import { Box, Stack, Select, MenuItem, FormControl, InputLabel, TextField, Typography } from '@mui/material'
import type { ExprVal } from '@statdash/expr'
import { CALC_OPS, OP_SYMBOL, inputRef } from './metricCalc'

type NodeKind = 'op' | 'operand' | 'literal'

/** Classify a raw expr node into its editable kind (defensive over any tree shape). */
function kindOf(node: unknown): NodeKind {
  if (node != null && typeof node === 'object') {
    const o = node as Record<string, unknown>
    if (typeof o['op'] === 'string') return 'op'
    if ('$derived' in o) return 'operand'
  }
  return 'literal'
}

function opOf(node: unknown): string {
  const o = node as Record<string, unknown>
  return typeof o?.['op'] === 'string' ? (o['op'] as string) : 'div'
}
function derivedOf(node: unknown): string {
  const o = node as Record<string, unknown>
  return typeof o?.['$derived'] === 'string' ? (o['$derived'] as string) : ''
}
function literalOf(node: unknown): number {
  if (typeof node === 'number') return node
  const o = node as Record<string, unknown>
  return typeof o?.['$literal'] === 'number' ? (o['$literal'] as number) : 0
}

export interface ExprTreeEditorProps {
  node:        ExprVal
  onChange:    (next: ExprVal) => void
  /** Declared operand names (a, b, …) — the operand menu options. */
  inputNames:  string[]
  /** name → display label for the operand menu (falls back to the raw name). */
  labelOf:     (name: string) => string
  en:          boolean
  /** Recursion depth — caps the tree at a sane bound + indents children. */
  depth?:      number
}

const MAX_DEPTH = 6

export function ExprTreeEditor({ node, onChange, inputNames, labelOf, en, depth = 0 }: ExprTreeEditorProps) {
  const kind = kindOf(node)

  const changeKind = (next: NodeKind) => {
    if (next === kind) return
    if (next === 'op') {
      const first: ExprVal = inputNames[0] ? inputRef(inputNames[0]) : ({ $literal: 0 } as ExprVal)
      onChange({ op: 'div', left: first, right: { $literal: 1 } } as ExprVal)
    } else if (next === 'operand') {
      onChange(inputRef(inputNames[0] ?? ''))
    } else {
      onChange({ $literal: literalOf(node) } as ExprVal)
    }
  }

  const kindLabel = en ? 'Node type' : 'კვანძის ტიპი'

  return (
    <Box
      sx={{
        pl: depth > 0 ? 1 : 0,
        borderLeft: depth > 0 ? '2px solid' : 'none',
        borderColor: 'divider',
        ml: depth > 0 ? 0.5 : 0,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ py: 0.25 }}>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel id={`node-kind-${depth}`}>{kindLabel}</InputLabel>
          <Select
            labelId={`node-kind-${depth}`}
            label={kindLabel}
            value={kind}
            onChange={(e) => changeKind(e.target.value as NodeKind)}
          >
            <MenuItem value="op">{en ? 'Operation' : 'ოპერაცია'}</MenuItem>
            <MenuItem value="operand">{en ? 'Metric' : 'მეტრიკა'}</MenuItem>
            <MenuItem value="literal">{en ? 'Number' : 'რიცხვი'}</MenuItem>
          </Select>
        </FormControl>

        {kind === 'op' && (
          <FormControl size="small" sx={{ minWidth: 96 }}>
            <InputLabel id={`node-op-${depth}`}>{en ? 'Operator' : 'ოპერატორი'}</InputLabel>
            <Select
              labelId={`node-op-${depth}`}
              label={en ? 'Operator' : 'ოპერატორი'}
              value={opOf(node)}
              onChange={(e) => onChange({ ...(node as object), op: e.target.value } as ExprVal)}
            >
              {CALC_OPS.map((op) => (
                <MenuItem key={op} value={op}>{OP_SYMBOL[op]} ({op})</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {kind === 'operand' && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id={`node-operand-${depth}`}>{en ? 'Operand' : 'ოპერანდი'}</InputLabel>
            <Select
              labelId={`node-operand-${depth}`}
              label={en ? 'Operand' : 'ოპერანდი'}
              value={derivedOf(node)}
              onChange={(e) => onChange(inputRef(e.target.value))}
            >
              {inputNames.length === 0 && (
                <MenuItem value="" disabled>{en ? 'Add an operand first' : 'ჯერ დაამატეთ ოპერანდი'}</MenuItem>
              )}
              {inputNames.map((n) => (
                <MenuItem key={n} value={n}>{n} — {labelOf(n)}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {kind === 'literal' && (
          <TextField
            size="small"
            type="number"
            label={en ? 'Number' : 'რიცხვი'}
            value={literalOf(node)}
            onChange={(e) => onChange({ $literal: Number(e.target.value) } as ExprVal)}
            sx={{ width: 120 }}
          />
        )}
      </Stack>

      {kind === 'op' && depth < MAX_DEPTH && (
        <Box sx={{ pl: 1 }}>
          <Typography variant="caption" color="text.secondary">{en ? 'Left' : 'მარცხენა'}</Typography>
          <ExprTreeEditor
            node={(node as { left: ExprVal }).left}
            onChange={(next) => onChange({ ...(node as object), left: next } as ExprVal)}
            inputNames={inputNames}
            labelOf={labelOf}
            en={en}
            depth={depth + 1}
          />
          <Typography variant="caption" color="text.secondary">{en ? 'Right' : 'მარჯვენა'}</Typography>
          <ExprTreeEditor
            node={(node as { right: ExprVal }).right}
            onChange={(next) => onChange({ ...(node as object), right: next } as ExprVal)}
            inputNames={inputNames}
            labelOf={labelOf}
            en={en}
            depth={depth + 1}
          />
        </Box>
      )}
    </Box>
  )
}
