// ── Placeholder Interpreter ───────────────────────────────────────────

import type { ChartType } from '@statdash/engine'
import type { ChartDef, ChartOutput } from '../types'
import type { ChartInterpreter } from '../registry'
import { placeholderOutput } from '../interpret'

class PlaceholderInterpreter implements ChartInterpreter {
  readonly type: ChartType
  constructor(type: ChartType) { this.type = type }
  interpret(def: ChartDef): ChartOutput { return placeholderOutput(def) }
}

export { PlaceholderInterpreter }
