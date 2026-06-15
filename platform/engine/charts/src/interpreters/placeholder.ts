// ── Placeholder Interpreter ───────────────────────────────────────────

import type { ChartType } from '@geostat/engine'
import type { ChartDef, ChartOutput } from '../types'
import type { ChartInterpreter } from '../registry'
import { placeholderOutput } from '../interpret'

class PlaceholderInterpreter implements ChartInterpreter {
  constructor(readonly type: ChartType) {}
  interpret(def: ChartDef): ChartOutput { return placeholderOutput(def) }
}

export { PlaceholderInterpreter }
