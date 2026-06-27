// ── VisibilityBuilder — recursive "show when" condition builder [V4] ───────────
//
//  The Appsmith/Retool show/hide condition pattern: an author builds a node's
//  `view.visibleWhen` boolean tree WITHOUT JSON — "Show this when [region is GE]
//  AND [mode is year]". It renders a VisibilityExpr (Composite pattern) recursively:
//
//    • LEAF op (eq/neq/in/isset/mode-*) → an op picker + the schema-driven
//      VisibilityLeafEditor (the SAME generic Inspector — no bespoke form).
//    • and / or → a GROUP: an AND/OR toggle, the ordered child conditions (each a
//      nested VisibilityBuilder), "+ condition" (add a leaf) and "+ group" (nest).
//    • not → a single NEGATED child (a nested VisibilityBuilder).
//
//  Every edit produces a NEW VisibilityExpr handed up via onChange (immutable,
//  unidirectional — Flux). The tree round-trips losslessly into view.visibleWhen
//  and evalVisibility agrees (the panel round-trip fitness).
//
//  OCP: a new VisibilityExpr op is authorable the moment it registers a leaf
//  schema (→ rendered here through the Inspector) or a composite marker (→ handled
//  by the group/not branches) — zero ad-hoc edits to this component for new leaves.
//
import {
  Box, Paper, Stack, IconButton, MenuItem, Select, Typography, ToggleButton,
  ToggleButtonGroup, Tooltip, Button,
} from '@mui/material'
import AddIcon    from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { VisibilityExpr } from '@statdash/engine'
import { VisibilityLeafEditor, type VisibilityLeaf } from './VisibilityLeafEditor'
import {
  makeVisibilityExpr,
  VISIBILITY_LEAF_OPS, type VisibilityOpId,
} from './visibilityFactory'

// Human labels for the op picker (kept bilingual-friendly; concise).
const OP_LABELS: Record<VisibilityOpId, string> = {
  'eq':       'param = value',
  'neq':      'param ≠ value',
  'in':       'param in […]',
  'isset':    'param is set',
  'perspective-is':  'perspective is',
  'perspective-in':  'perspective in […]',
  'perspective-not': 'perspective is not',
  'mode-is':  'mode is',
  'mode-in':  'mode in […]',
  'mode-not': 'mode is not',
  'and':      'ALL of (AND)',
  'or':       'ANY of (OR)',
  'not':      'NOT',
}

export interface VisibilityBuilderProps {
  /** Stable path segment (for nested keys / control identity). */
  path:     string
  /** The condition sub-tree at this position. */
  expr:     VisibilityExpr
  /** Hand the edited sub-tree up. */
  onChange: (next: VisibilityExpr) => void
  /** Remove THIS node from its parent (undefined at the root → no remove button). */
  onRemove?: () => void
}

export function VisibilityBuilder({ path, expr, onChange, onRemove }: VisibilityBuilderProps) {
  // Changing the op reseeds the node to a valid shape of the new op (the author's
  // partial value for the old op is intentionally dropped — a different op has
  // different fields; keeping stale fields would produce an invalid union member).
  const changeOp = (op: VisibilityOpId) => onChange(makeVisibilityExpr(op))

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
           data-testid={`vis-node-${path}`}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Select
          size="small"
          value={expr.op}
          onChange={(e) => changeOp(e.target.value as VisibilityOpId)}
          inputProps={{ 'aria-label': 'condition type' }}
          sx={{ minWidth: 160 }}
        >
          {([...VISIBILITY_LEAF_OPS, 'and', 'or', 'not'] as VisibilityOpId[]).map((op) => (
            <MenuItem key={op} value={op}>{OP_LABELS[op]}</MenuItem>
          ))}
        </Select>
        <Box sx={{ flex: 1 }} />
        {onRemove && (
          <Tooltip title="წაშლა">
            <IconButton size="small" color="error" aria-label="remove condition" onClick={onRemove}>
              <DeleteIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* ── Body: composite group / negation / leaf form ──────────────────── */}
      {expr.op === 'and' || expr.op === 'or'
        ? <GroupBody path={path} expr={expr} onChange={onChange} />
        : expr.op === 'not'
          ? <NotBody path={path} expr={expr} onChange={onChange} />
          : (
            <VisibilityLeafEditor
              path={path}
              leaf={expr as VisibilityLeaf}
              onChange={(next) => onChange(next)}
            />
          )}
    </Paper>
  )
}

// ── GroupBody — and / or: a list of child conditions + AND/OR toggle ───────────

function GroupBody({
  path, expr, onChange,
}: {
  path: string
  expr: Extract<VisibilityExpr, { op: 'and' | 'or' }>
  onChange: (next: VisibilityExpr) => void
}) {
  const setExprs = (exprs: VisibilityExpr[]) => onChange({ op: expr.op, exprs })

  // The AND/OR toggle flips the combinator while keeping the children (so an
  // author can switch "all of" ↔ "any of" without rebuilding the list).
  const setOp = (op: 'and' | 'or') => onChange({ op, exprs: expr.exprs })

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={expr.op}
        onChange={(_e, v) => { if (v) setOp(v as 'and' | 'or') }}
        aria-label="combinator"
      >
        <ToggleButton value="and" aria-label="all of">ALL (AND)</ToggleButton>
        <ToggleButton value="or"  aria-label="any of">ANY (OR)</ToggleButton>
      </ToggleButtonGroup>

      {expr.exprs.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          პირობები არ არის — დაამატეთ ქვემოთ.
        </Typography>
      )}

      {expr.exprs.map((child, i) => (
        <VisibilityBuilder
          key={`${path}.${i}`}
          path={`${path}.${i}`}
          expr={child}
          onChange={(next) => setExprs(expr.exprs.map((c, j) => (j === i ? next : c)))}
          onRemove={() => setExprs(expr.exprs.filter((_, j) => j !== i))}
        />
      ))}

      <Stack direction="row" spacing={1}>
        <Button size="small" startIcon={<AddIcon />}
          onClick={() => setExprs([...expr.exprs, makeVisibilityExpr('isset')])}>
          პირობა
        </Button>
        <Button size="small" startIcon={<AddIcon />}
          onClick={() => setExprs([...expr.exprs, makeVisibilityExpr('and')])}>
          ჯგუფი
        </Button>
      </Stack>
    </Box>
  )
}

// ── NotBody — not: a single negated child ─────────────────────────────────────

function NotBody({
  path, expr, onChange,
}: {
  path: string
  expr: Extract<VisibilityExpr, { op: 'not' }>
  onChange: (next: VisibilityExpr) => void
}) {
  return (
    <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
      <VisibilityBuilder
        path={`${path}.not`}
        expr={expr.expr}
        onChange={(next) => onChange({ op: 'not', expr: next })}
      />
    </Box>
  )
}
