# Panel Sizing — canonical cqi-bounded model + section height-consistency
> PRIMARY next-session build (owner-authorized 2026-06-28). Replaces the interim `56vh` band.
> Doctrine: best market concept, beautiful+correct, NO squeeze / hardcode / antipattern / degradation, ever.

## The model (container-query bounded sizing — the best concept)
`height: clamp(var(--size-panel-h-floor,380px), <~60cqi>, var(--size-panel-h-cap,560px))`
- `cqi` = the panel's OWN container inline-size → height is PROPORTIONAL to the panel's width
  (aspect-ratio's good intent) but BOUNDED by a legible floor + a sane cap (what aspect-ratio lacked,
  and without the aspect-ratio↔max-height contradiction). No arbitrary viewport (`vh`) coupling.
- Requires `container-type: inline-size` on the panel ancestor. AUDIT every panel's container context
  before flipping (a985 flag: maps render outside a container — handle as the documented exception).
- Tokens only (extend `--size-panel-h-*` spine); zero magic. a985 already staged `56vh → 64cqi`.

## Section height-consistency (NEW owner observation — fix WITH the cqi work)
Across EVERY page, in sections — PAIRED (two-up) AND SINGLE panels — heights currently DON'T match each
other, and in places the CHART doesn't FILL its panel area. Requirement, under ONE common concept:
1. **Sibling panels in a row align in height** (a two-up row's left/right panels equal height) — via the
   shared sizing concept (e.g. the row stretches children, or both resolve the same cqi band), not per-panel
   magic. No mismatched/ragged heights.
2. **The chart FILLS its panel body** — the `height:100%` chain from `.panel__body` → chart renderer is
   intact at every width; no collapse, no letterbox/empty area, no overflow. (Apex/treemap/map all fill.)
3. Single panels and paired panels read as one coherent system (consistent rhythm), beautiful at every
   resolution, nothing squeezed.

## Verification (mandatory before declaring done)
Real-browser, full ladder × every page (landing/gdp/accounts/regional) × every layout (single + paired
sections): heights match across siblings, charts fill, no overflow/squeeze/letterbox, geostat unchanged
except the intended consistency. This is the canonical replacement of the interim band — build it whole.
