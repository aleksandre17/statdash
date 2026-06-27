// ── PerspectiveDefEditor — schema-driven authoring of ONE PerspectiveDef [P-final] ──
//
//  Renders ONE perspective (a PerspectiveDef) through the SAME generic Inspector
//  that authors node / panel / chrome / transform-step / ParamDef properties —
//  driven by perspectiveDefSchemaSource (label · icon · the registry-driven scope
//  fields). NO bespoke per-field form, NO second form engine (the ADR mandate / OCP).
//
//  The perspective is modeled as a CanvasNode: `{ type: 'perspective', props: def }`.
//  The Inspector reads each PropField off `props` (= the PerspectiveDef incl. its
//  nested `scope`) and emits a dot-path write (`label`, `icon`, `scope.timeBinding.dim`,
//  `scope.metric`, …); we apply it immutably with setAtPath and hand the next def up.
//  `id` is never in any schema → the identity is carried through untouched (immutable
//  in the editor, exactly the ParamDefEditor guarantee for `key`/`type`).
//
//  Beyond the scalar/scope fields, two VisibilityExpr OVERRIDES (escape-only,
//  FF-WHEN-IS-ESCAPE-ONLY) are authored through the recursive VisibilityBuilder —
//  the SAME builder the node "show when" uses, so a `perspective-is`/`-in` membership
//  rule or a D-GUARD availability rule is built without JSON:
//    • `when`      — the visibility override (default = identity perspective-is(id)).
//    • `available` — the availability guard ("offer this perspective only when …").
//  Both default OFF (a toggle adds a seed; clearing removes the key) — additive +
//  lossless: an unedited perspective never grows a `when`/`available` key.
//
import { Box, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import type { PerspectiveDef, VisibilityExpr } from '@statdash/engine'
import { Inspector } from '../../inspector'
import { setAtPath } from '../../inspector/showWhen'
import { perspectiveDefSchemaSource } from './perspectiveDefSchemaSource'
import { VisibilityBuilder, makeVisibilityExpr } from '../visibility'
import type { CanvasNode } from '../../types/constructor'

export interface PerspectiveDefEditorProps {
  /** The perspective being edited (carries its `id`). */
  def:      PerspectiveDef
  onChange: (next: PerspectiveDef) => void
}

export function PerspectiveDefEditor({ def, onChange }: PerspectiveDefEditorProps) {
  // Model the PerspectiveDef as the Inspector's element. `id` is stable so the
  // Inspector controls keep their identity across edits to the same perspective.
  const node: CanvasNode = {
    id:       `perspective-${def.id}`,
    type:     'perspective',
    props:    def as unknown as Record<string, unknown>,
    childIds: [],
  }

  const patch = (field: string, next: unknown) => {
    onChange(setAtPath(def, field, next) as PerspectiveDef)
  }

  // ── when / available — clear the key entirely when the toggle goes off ───────
  //  A null `next` removes the key (back to the default identity gate / always-
  //  available), so an unedited / cleared perspective stays byte-clean (the round-
  //  trip is lossless). A non-null `next` writes through the SAME setAtPath dual.
  const setOverride = (key: 'when' | 'available') => (next: VisibilityExpr | undefined) => {
    if (next == null) {
      const { [key]: _drop, ...rest } = def
      onChange(rest as PerspectiveDef)
    } else {
      onChange({ ...def, [key]: next })
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }} data-testid={`perspective-def-${def.id}`}>
      {/* Schema-driven label · icon · scope — the SAME generic Inspector. */}
      <Inspector node={node} onChange={patch} schemaSource={perspectiveDefSchemaSource} />

      <Divider />
      <OverrideSection
        labelKa="ჩვენების პირობა (override)"
        labelEn="Visibility override (when)"
        testid={`perspective-when-${def.id}`}
        value={def.when}
        onChange={setOverride('when')}
      />

      <Divider />
      <OverrideSection
        labelKa="ხელმისაწვდომობის პირობა"
        labelEn="Availability guard (available)"
        testid={`perspective-available-${def.id}`}
        value={def.available}
        onChange={setOverride('available')}
      />
    </Box>
  )
}

// ── OverrideSection — toggle-gated VisibilityExpr builder (when / available) ────
//  Mirrors the node-level VisibilitySection: a switch enables the override (seeds
//  a `perspective-is` leaf — the common membership rule), the recursive builder
//  authors the tree, and clearing removes the key entirely.
function OverrideSection({
  labelKa, labelEn, testid, value, onChange,
}: {
  labelKa: string
  labelEn: string
  testid:  string
  value:    VisibilityExpr | undefined
  onChange: (next: VisibilityExpr | undefined) => void
}) {
  const enabled = value != null
  const toggle = (on: boolean) => {
    if (on) onChange(value ?? makeVisibilityExpr('perspective-is'))
    else    onChange(undefined)
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={testid}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="overline" color="text.secondary">{labelKa}</Typography>
      </Stack>
      <FormControlLabel
        control={<Switch size="small" checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          inputProps={{ 'aria-label': labelEn }} />}
        label={<Typography variant="body2">{labelEn}</Typography>}
      />
      {enabled && value && (
        <VisibilityBuilder path={testid} expr={value} onChange={(next) => onChange(next)} />
      )}
    </Box>
  )
}
