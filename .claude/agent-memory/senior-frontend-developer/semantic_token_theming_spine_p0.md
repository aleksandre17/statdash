---
name: semantic-token-theming-spine-p0
description: P0 of the semantic-token/theming spine landed — 3-tier tokens, brand-neutral default theme in @statdash/styles, [data-tenant] override seam, --sc fallback rebase. Shells still hold literals (P1-P5 tokenize them).
metadata:
  type: project
---

P0 of the semantic-token/theming spine (architect ADR [[adr-semantic-token-theming-spine]]) is implemented and green (1054 tests).

**What P0 landed (pure addition, byte-identical):**
- Tier-1 PRIMITIVE ramps `--blue-50..900` (neutral slate) + `--teal-50..900` (neutral teal) in `packages/styles/src/css/tokens.css` `:root`. NOT cataloged (like the gray ramp — primitives are referenced only by the semantic tier).
- Tier-2 SEMANTIC roles in same `:root`: text {primary,secondary,muted,faint,inverse}, surface {_,raised,sunken,frame}, border {_,subtle,frame,strong,interactive}, accent {_,hover,muted,bg,secondary,ring}, chart-frame. Default values = brand-NEUTRAL (neutrals = the live render; `--color-accent` default = `var(--blue-600)`, NOT the tenant teal). `--color-accent-ring` = `color-mix(... var(--color-accent) 15% ...)` so it derives from whatever accent is active.
- Mirrored new roles into `tokens/color.ts` COLOR (only added keys, removed none) + `catalog/color.ts` descriptors (Constructor picker).
- Geostat tenant theme: `apps/geostat/src/shared/styles/index.css` — replaced the dead `:root { --color-primary… --chart-* }` set (consumed by NOBODY; `@apply`/utility classes resolve through `tailwind.config.js` theme, not those vars) with `[data-tenant="geostat"] { --color-accent:#0080BE; -hover:#006A9E; -muted:#E6F3FA; -bg:#EEF3F4; -secondary:#00A896 }`.
- Scope set in `apps/geostat/src/main.tsx`: `document.documentElement.dataset.tenant = 'geostat'` (composes with data-theme; runtime-injection-ready).
- `--sc` fallback rebased `var(--sc, #0080BE)` → `var(--sc, var(--color-accent))` in 7 shell files (section-card.css, feedback.css, inner-sidebar.css, data-table.css, section.css, filter-bar.css, chart-placeholder.css). Under data-tenant=geostat resolves to #0080BE → byte-identical.
- FF-THEME-COMPLETE added to `packages/styles/src/tokens.parity.test.ts`: parses the FIRST `:root` block only (brace-depth walk) and asserts every `--color-*` ref in the token registry is bound by the DEFAULT theme (no role defined only in dark/tenant layer).

**GOTCHA:** `packages/{react,styles}` are scanned by `no-tenant-content.fitness.test.ts` for `/geostat/i` — allowlist is intentionally EMPTY. Comments in those packages MUST NOT name the tenant ("geostat") OR its brand hex by tenant name. Write seam comments generically ("a tenant theme rebinds this family").

**Still TODO (P1-P5):** shells still hold ~377 literals (untouched in P0, expected). P1=packages/react, P2=plugins/chrome, P3=plugins/nodes, P4=plugins/panels, P5=plugins/pages. Pfinal flips FF-TOKEN-ONLY warn→error and deletes the stale `--color-accent:#005a9c` (already replaced in P0) remnants. FF-TENANT-OVERRIDE comes later too.

**UPDATE 2026-06-24 — Pfinal DONE (spine complete, gate flipped to ERROR).** All stragglers tokenized; both fitness gates live and green (1104 tests). See [[semantic_token_spine_complete]] for the full role inventory, the cssVar() chart-fill util, the DonutChart split, and the gate locations. There is NO stale `--color-accent:#005a9c` — the only `#005a9c` left is `--chart-color-1` (legit categorical palette, consumed) + its catalog hint + story fixtures.
