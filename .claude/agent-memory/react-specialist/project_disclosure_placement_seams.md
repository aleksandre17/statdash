---
name: disclosure-placement-seams
description: useDisclosure (minimal toggle hook) + mergePlacement (typed layout-item style merge) added to react engine; resolveNodeTemplate gained string-input overload
metadata:
  type: project
---

Two new shared shell-layer seams landed in `packages/react/src/engine` (SectionShell holistic clean-up), plus a template-resolver type fix.

- **`useDisclosure(initial=false)`** — `hooks/useDisclosure.ts`, exported from BOTH `@statdash/react/engine` and `@statdash/react`. The minimal open/close/toggle/show disclosure primitive for ANY shell (methodology panel, popover, info flyout). Deliberately NOT the base of `useCollapsible` — collapse owns a richer state contract (`canCollapse` gating + `defaultOpen ?? true` seed + keyboard/ARIA head props), so they stay siblings, not layered.
- **`mergePlacement(panelStyle, placement)`** — lives in `engine/layoutItemContext.tsx` (placement's React home, beside `useLayoutItem`), returns `CSSProperties | undefined`. The ONE typed home for folding a panel `style` (`Record<string,string>`) with layout-item `placement` (`Record<string,string|number>` — `order` is a number) → placement wins. The `as CSSProperties` is an unavoidable open-style→React-CSSProperties boundary cast, now confined to one helper and HONEST about the string|number union (the old SectionShell cast `placement as Record<string,string>` LIED, dropping order's number type).

**Why:** SectionShell was the ONLY shell hand-merging placement (others spread `{...vs.panel}` and silently drop it) and the only one with the `infoOpen` raw `useState(false)` second-disclosure smell.

**How to apply:** any shell needing a simple toggle → `useDisclosure`; any shell wanting layout-item placement on its root → `mergePlacement(vs.panel.style, placement)`. A full framework-fold of placement into `vs.panel` inside `defineShell` was REJECTED: it would change every `{...vs.panel}` shell's output (not byte-identical) and is architect-tier render-pipeline scope.

- **`resolveNodeTemplate` / `useNodeTemplate` overloads** (`hooks/useNodeTemplate.ts`): a definite `string|{year,range}` input now returns `string` (not `string|undefined`); optional/absent stays `string|undefined`. Sound because `resolveTemplate` returns `string` and the no-`{` short-circuit returns the input string. This kills `resolve(def.title)!` non-null assertions where the field is a required string (e.g. SectionNode.title). Bound resolver type is `NodeTemplateResolver`.

Also fixed in SectionShell: read `merged.defaultOpen`/`merged.noCollapse` (not raw `def.view`) per the "never read def.view raw" contract (byte-identical — VIEW_DEFAULTS omits both keys); dropped the redundant `{...vs.body} style={vs.body.style as CSSProperties}` double-write down to just `{...vs.body}` (matches TableShell/ChartShell convention).
