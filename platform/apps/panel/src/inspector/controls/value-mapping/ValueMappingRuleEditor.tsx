// ── ValueMappingRuleEditor — schema-driven authoring of ONE value-mapping rule ──
//
//  Renders ONE ValueMapping through the generic Inspector (schema-driven, no bespoke
//  form) — mirrors RowSpecEditor exactly. The rule is modeled as a CanvasNode whose
//  `props` are the rule; the Inspector reads each PropField off `props` and emits a
//  dot-path write (match.kind, match.from, text, token, …) applied immutably.
//
import type { ValueMapping } from '@statdash/engine'
import { Inspector } from '../../../inspector'
import { setAtPath } from '../../showWhen'
import { valueMappingSchemaSource, VALUE_MAPPING_RULE_KEY } from './valueMappingSchemaSource'
import type { CanvasNode } from '../../../types/constructor'

export interface ValueMappingRuleEditorProps {
  uid:      string
  rule:     ValueMapping
  onChange: (next: ValueMapping) => void
}

export function ValueMappingRuleEditor({ uid, rule, onChange }: ValueMappingRuleEditorProps) {
  const node: CanvasNode = {
    id:      `vmap-${uid}`,
    type:    VALUE_MAPPING_RULE_KEY,
    props:   rule as unknown as Record<string, unknown>,
    childIds: [],
  }

  const handleChange = (field: string, next: unknown) => {
    onChange(setAtPath(rule, field, next) as ValueMapping)
  }

  return (
    <Inspector
      node={node}
      onChange={handleChange}
      schemaSource={valueMappingSchemaSource}
    />
  )
}
