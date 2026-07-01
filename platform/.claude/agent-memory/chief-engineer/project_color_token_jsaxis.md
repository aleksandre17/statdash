---
name: project-color-token-jsaxis
description: Color-token SSOT is enforced on the CSS axis + plugins/react JS, but charts/core JS is unscanned — where the geostat brand #0080BE leaks
metadata:
  type: project
---

The color-token cohesion guard `packages/plugins/nodes/__tests__/token-cohesion.fitness.test.ts`
(FF-TOKEN-ONLY) scans `packages/plugins/**` + `packages/react/src/**` and fails on any hex/rgb/hsl literal
that isn't `cssVar('--token', fallback)`. It is strong AND well-respected: every chart/apex/donut/geo color
literal is a sanctioned `cssVar()` call (runtime-themed). Do NOT flag those as leaks.

**The gap (verified 2026-06-28):** FF-TOKEN-ONLY roots ONLY at plugins + react/src. `packages/charts` and
`packages/core` are NOT scanned. Bare literals live there:
- `packages/charts/src/colors.ts:16` `DEFAULT_ACCENT_COLOR = '#0080BE'` — the EXACT geostat brand accent
  (`apps/geostat/.../index.css --color-accent:#0080BE`), in a file whose header calls its colors "neutral".
  A non-geostat tenant with color-less rows renders geostat blue. Genuine brand leak, unguarded.
- `packages/core/src/registry/resolvers.ts:214` growth green/red `#00A896`/`#E76F51` re-typed inline, not
  in any SSOT (DRY/SSOT gap).
- `colors.ts` SERIES `#6B7B8D` / TOTAL `#E53E3E` are legit renderer-agnostic wire-seeds (ChartOutput is JSON,
  var() invalid) but unguarded alongside the leak.

**Why:** ChartOutput is renderer-agnostic JSON, so charts/core legitimately need literal wire-seeds → the team
relaxed the guard there → a brand value rode in as a "neutral default".

**Tenant identity also leaks on axes regex guards don't model:** `no-tenant-content.fitness.test.ts` matches
only the token `/geostat/i`, not brand VALUES (#0080BE, brand font names). Pair name-scans with value-scans.

**How to apply:** when auditing brand-neutrality or color SSOT, scan charts+core too, not just the
FF-TOKEN-ONLY surface. The fix is to extend FF-TOKEN-ONLY's roots to charts/src+core/src with a narrow,
documented allowlist for true neutral seeds — then the brand-accent default fails until fixed. Full inventory:
`platform/work/HUNT-violations-inventory.md` §2/§3. [[project-platform-maturity]]