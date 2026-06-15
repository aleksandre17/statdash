// ── Built-in ChartInterpreters (registration) ──────────────────────────
//
//  Import and register all interpreters onto chartRegistry as a side effect.
//  This ensures all 13 built-in interpreters are available when the charts
//  package is imported.
//

import { BarInterpreter, LineInterpreter, AreaInterpreter } from './interpreters/cartesian'
import { PieInterpreter } from './interpreters/radial'
import {
  WaterfallInterpreter, ComboInterpreter, TreemapInterpreter,
  HBarDivergingInterpreter, ContributionInterpreter,
} from './interpreters/special'
import { PlaceholderInterpreter } from './interpreters/placeholder'
import { chartRegistry } from './registry'

// ── Register all built-in chart interpreters ───────────────────────────

chartRegistry
  .registerChart(new BarInterpreter('bar'))
  .registerChart(new BarInterpreter('hbar'))
  .registerChart(new HBarDivergingInterpreter())
  .registerChart(new LineInterpreter())
  .registerChart(new AreaInterpreter())
  .registerChart(new PieInterpreter('pie'))
  .registerChart(new PieInterpreter('donut'))
  .registerChart(new WaterfallInterpreter())
  .registerChart(new ContributionInterpreter())
  .registerChart(new ComboInterpreter())
  .registerChart(new TreemapInterpreter())
  .registerChart(new PlaceholderInterpreter('map'))
  .registerChart(new PlaceholderInterpreter('sankey'))
