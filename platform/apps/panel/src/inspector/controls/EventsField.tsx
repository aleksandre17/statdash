// ── EventsField — the EVENTS facet control (PropFieldType 'events') ──────────────
//
//  The fourth FACET control (sibling of StyleField / DataFacetField): it authors an
//  element's whole `on: NodeEventHandler[]` in place — the un-burying of Gap 2's
//  interaction half (SPEC-deep-authorability-completion, slice 4). Registered in
//  FieldControlRegistry under `type:'events'`, so the generic Inspector dispatches the
//  EVENTS facet's `contract` field to it (genericity in the DISPATCH — a rich facet
//  resolves to a rich editor, exactly like Webflow/Framer project an Interactions tab).
//
//  It is the AUTHORING side of the loop AR-42 built: a user now DECLARES a
//  filter/highlight/drill on a trigger from the panel, and the EXISTING
//  `useNodeInteractions`/`applySelection` spine interprets it at runtime (build →
//  declare → runs). The authored value is a valid `NodeEventHandler[]` spec — pure data
//  (Law 2), the same shape the render side already consumes.
//
//  Structure (a bounded, constant-weight editor — no raw JSON, FF-NO-RAW-JSON-DEFAULT):
//    • a list of HANDLERS, each { event: <trigger>, actions: [<action>] };
//    • per handler — a TRIGGER picker (the declared NodeEventTrigger vocabulary);
//    • per action  — an ARM picker (filter/highlight/drill) + the arm's PARAMS projected
//      through a NESTED generic Inspector over ACTION_ARM_SCHEMAS[type] (a drill's
//      `dimension` is an enum-ref over the governed dimension catalog — Law 1/2).
//
//  Controlled component: value in (the current NodeEventHandler[] | undefined), onChange
//  out (the next whole array). WCAG 2.1 AA: labelled selects, keyboard-reachable buttons.
//
import { useState } from 'react'
import { Box, Button, IconButton, MenuItem, Select, Typography, Paper, Divider } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { NodeEventHandler, NodeEventTrigger, NodeAction } from '@statdash/react/engine'
import type { FieldControlProps } from '../fieldControl.types'
import { Inspector } from '../Inspector'
import { readLocale } from '../localeString'
import { fixedSchemaSource } from './nestedItemControl.helpers'
import type { CanvasNode } from '../../types/constructor'
import {
  TRIGGER_LABELS, ACTION_ARM_LABELS, ACTION_ARM_SCHEMAS,
  NODE_EVENT_TRIGGERS, NODE_ACTION_TYPES,
  addHandler, removeHandler, setHandlerTrigger,
  addAction, removeAction, setActionType, setActionParam,
} from './eventsFacetModel'

export function EventsField({ id, value, locale, onChange }: FieldControlProps) {
  const handlers = (value as NodeEventHandler[] | undefined) ?? []
  const en = locale === 'en'
  const [addTrigger, setAddTrigger] = useState<NodeEventTrigger>(NODE_EVENT_TRIGGERS[0]!)

  return (
    <Box
      className="insp-events"
      data-testid="events-field"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {handlers.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {en
            ? 'No interactions yet. Add a handler: a gesture (e.g. point click) → actions (filter / highlight / drill).'
            : 'ინტერაქციები ჯერ არაა. დაამატეთ ჰენდლერი: ჟესტი (მაგ. წერტილზე დაჭერა) → ქმედებები.'}
        </Typography>
      )}

      {handlers.map((handler, hIndex) => (
        <Paper
          key={hIndex}
          variant="outlined"
          data-testid="events-handler"
          sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {/* ── Handler header — the TRIGGER picker + remove ──────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>
              {en ? 'When' : 'როცა'}
            </Typography>
            <Select
              size="small"
              value={handler.event}
              aria-label={en ? 'Trigger gesture' : 'ჟესტი'}
              onChange={(e) =>
                onChange(setHandlerTrigger(handlers, hIndex, e.target.value as NodeEventTrigger))}
              sx={{ flex: 1 }}
            >
              {NODE_EVENT_TRIGGERS.map((t) => (
                <MenuItem key={t} value={t}>{readLocale(TRIGGER_LABELS[t], locale)}</MenuItem>
              ))}
            </Select>
            <IconButton
              size="small"
              aria-label={en ? 'Remove handler' : 'ჰენდლერის წაშლა'}
              onClick={() => onChange(removeHandler(handlers, hIndex))}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* ── Actions of this trigger ──────────────────────────────────────── */}
          {handler.actions.map((action, aIndex) => {
            const armSchema = ACTION_ARM_SCHEMAS[action.type]
            const actionNode: CanvasNode = {
              id: `${id}-h${hIndex}-a${aIndex}`,
              type: 'event-action',
              props: action as unknown as Record<string, unknown>,
              childIds: [],
            }
            return (
              <Box
                key={aIndex}
                data-testid="events-action"
                sx={{ pl: 1.5, borderLeft: '2px solid', borderColor: 'divider',
                      display: 'flex', flexDirection: 'column', gap: 0.75 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44 }}>
                    {en ? 'Do' : 'გააკეთე'}
                  </Typography>
                  <Select
                    size="small"
                    value={action.type}
                    aria-label={en ? 'Action type' : 'ქმედების ტიპი'}
                    onChange={(e) =>
                      onChange(setActionType(handlers, hIndex, aIndex, e.target.value as NodeAction['type']))}
                    sx={{ flex: 1 }}
                  >
                    {NODE_ACTION_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>{readLocale(ACTION_ARM_LABELS[t], locale)}</MenuItem>
                    ))}
                  </Select>
                  <IconButton
                    size="small"
                    aria-label={en ? 'Remove action' : 'ქმედების წაშლა'}
                    onClick={() => onChange(removeAction(handlers, hIndex, aIndex))}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
                {/* The arm's PARAMS — projected through the SAME generic Inspector. */}
                <Inspector
                  node={actionNode}
                  schemaSource={fixedSchemaSource(armSchema, [])}
                  onChange={(field, next) =>
                    onChange(setActionParam(handlers, hIndex, aIndex, field, next))}
                  idPrefix={`${id}-h${hIndex}-a${aIndex}`}
                />
              </Box>
            )
          })}

          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => onChange(addAction(handlers, hIndex, NODE_ACTION_TYPES[0]!))}
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
          >
            {en ? 'Add action' : 'ქმედების დამატება'}
          </Button>
        </Paper>
      ))}

      <Divider />

      {/* ── Add-handler row — pick a trigger, add ───────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Select
          size="small"
          value={addTrigger}
          aria-label={en ? 'New handler trigger' : 'ახალი ჰენდლერის ჟესტი'}
          onChange={(e) => setAddTrigger(e.target.value as NodeEventTrigger)}
          sx={{ flex: 1 }}
        >
          {NODE_EVENT_TRIGGERS.map((t) => (
            <MenuItem key={t} value={t}>{readLocale(TRIGGER_LABELS[t], locale)}</MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => onChange(addHandler(handlers, addTrigger))}
          sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          {en ? 'Add handler' : 'ჰენდლერის დამატება'}
        </Button>
      </Box>
    </Box>
  )
}
