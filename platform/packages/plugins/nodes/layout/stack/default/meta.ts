import type { NodeSliceMeta } from '@statdash/react/engine'
import { StackSchema, StackDefaults, StackSlots, StackGroups } from './StackNode'

export const META: NodeSliceMeta = {
  sliceType:       'node',
  type:            'stack',
  variant:         'default',
  label:           { ka: 'სტეკი', en: 'Stack' },
  icon:            'layout-stack',
  category:        'layout',
  schema:          StackSchema,
  defaults:        StackDefaults,
  slots:           StackSlots,
  groups:          StackGroups,
  canHaveChildren: true,
  // `nav-transparent` (descend-for-nav): the stack is the page-body composition
  // primitive (InnerPageShell), so sections arranged in a stack must surface in
  // the page nav — same container contract as columns/grid.
  // `flow` (placement capability) added: a stack is flow content, admissible in a section.
  caps:            ['nav-transparent', 'flow'],
  version:         1,
}
