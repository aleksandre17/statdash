// ── ValueMappingField — FieldControl: an ordered list of value-mapping rules ────
//
//  The authoring surface for a `ValueMapping[]` (EXP-06). A list of rules, each
//  edited by ValueMappingRuleEditor through the EXISTING generic Inspector — no
//  bespoke per-field form (the ADR mandate). Mirrors RowListEditor's list shape.
//
//  ORDER IS SEMANTIC: applyValueMap is first-match-wins, so the list is PRIORITY-
//  ordered. Reorder is exposed as ▲/▼ buttons (keyboard-operable, aria-labelled —
//  WCAG) rather than drag-only, so priority is changeable without a pointer.
//
import {
  Box, Button, IconButton, Paper, Typography,
} from '@mui/material'
import AddIcon              from '@mui/icons-material/Add'
import DeleteIcon           from '@mui/icons-material/Delete'
import ArrowUpwardIcon      from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon    from '@mui/icons-material/ArrowDownward'
import { useState }         from 'react'
import type { ValueMapping } from '@statdash/engine'
import type { FieldControlProps } from '../../fieldControl.types'
import { ValueMappingRuleEditor } from './ValueMappingRuleEditor'

let uidCounter = 0
const nextUid = () => `vm-${uidCounter++}`

const EMPTY_RULE: ValueMapping = { match: { kind: 'exact', value: '' } }

export function ValueMappingField({ value, onChange }: FieldControlProps<ValueMapping[] | undefined>) {
  const rules = value ?? []

  // Stable keys per rule — kept length-synced with `rules` (the React-sanctioned
  // "adjust state while rendering" pattern, same as RowListEditor/PipelineBuilder).
  const [uids, setUids] = useState<string[]>(() => rules.map(() => nextUid()))
  if (uids.length !== rules.length) {
    setUids((prev) =>
      prev.length < rules.length
        ? [...prev, ...Array.from({ length: rules.length - prev.length }, nextUid)]
        : prev.slice(0, rules.length),
    )
  }

  const commit = (next: ValueMapping[], nextUids: string[]) => {
    setUids(nextUids)
    onChange(next.length ? next : undefined)
  }

  const updateRule = (i: number, next: ValueMapping) =>
    onChange(rules.map((r, idx) => (idx === i ? next : r)))

  const removeRule = (i: number) =>
    commit(rules.filter((_r, idx) => idx !== i), uids.filter((_u, idx) => idx !== i))

  const addRule = () =>
    commit([...rules, EMPTY_RULE], [...uids, nextUid()])

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rules.length) return
    const r = [...rules]; const u = [...uids]
    ;[r[i], r[j]] = [r[j], r[i]]
    ;[u[i], u[j]] = [u[j], u[i]]
    commit(r, u)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rules.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          წესები არ არის — დაამატეთ ქვემოთ (პრიორიტეტი ზემოდან ქვემოთ)
        </Typography>
      )}

      {rules.map((rule, i) => (
        <Paper key={uids[i]} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              წესი {i + 1}{rule.match?.kind ? ` · ${rule.match.kind}` : ''}
            </Typography>
            <IconButton size="small" aria-label={`აწევა: წესი ${i + 1}`} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={`ჩამოწევა: წესი ${i + 1}`} disabled={i === rules.length - 1} onClick={() => move(i, 1)}>
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label={`წესის წაშლა ${i + 1}`} onClick={() => removeRule(i)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          <ValueMappingRuleEditor uid={uids[i]} rule={rule} onChange={(next) => updateRule(i, next)} />
        </Paper>
      ))}

      <Box>
        <Button size="small" startIcon={<AddIcon />} onClick={addRule}>
          წესის დამატება
        </Button>
      </Box>
    </Box>
  )
}
