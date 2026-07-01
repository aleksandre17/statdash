---
name: chrome-shells-clean-state
description: Outcome of the holistic chrome/** shell cleanup sweep — which shells are clean and why, so future passes don't re-churn them
metadata:
  type: project
---

After a DEPTH sweep of every shell in `packages/plugins/chrome/**`, the directory is essentially clean. Findings (so future passes skip re-auditing):

- **The shared node primitives mostly DON'T apply to chrome shells**: chrome shells are zero-prop, registry-dispatched, and have NO `RenderContext` / `placement` / `vs`. So `useNodeTemplate`/`resolveNodeTemplate` (RenderContext-bound), `mergePlacement`, `useCollapsible`/`useDisclosure` (boolean-disclosure) have no call site here. Chrome localizes via `useResolveLocale()` (`t(LocaleString)`), NOT the node-template `{...}` seam. Do not force-fit them.
- `accentStyle(color)` DOES apply: it was adopted in `inner-sidebar/SidebarNavSection.tsx` (was inline `{ '--sc': color } as CSSProperties`). `NavEntry.color` is a required non-empty hex, so the swap is byte-identical.
- The sidebar accordion uses `useState<string>(openSection)` (single-open key across N entries) — NOT a boolean, so `useDisclosure` is the wrong tool. Leave it.
- `inner-sidebar` `is-active`/`open` modifier-class joins and `locale-switcher__btn--active` are RUNTIME-state classes, not authored `def.variants`. The FF-NO-VARIANT-CLASS gate is section-scoped only, so per YAGNI + byte-identical they stay (see [[variant-spine-vs-runtime-state]]). The locale-switcher one is also redundant-with-`aria-current` but converting it changes DOM/CSS (not byte-identical) — deferred, not churned.
- `useSidebarNav` `sec.navMode!` non-null assertion was killed by binding `const targetMode = sec.navMode` and branching on its truthiness (TS narrows the const, runtime identical).
- app-header `data-surface` variant projection, InnerSidebar navIcons registry + useSidebarScroll/useSidebarNav (SPA-router, no `window.location` hard-nav) from the prior pass are sound — verified, no hard-nav anti-pattern remains.

**How to apply:** chrome/** is a low-yield target for primitive-adoption churn — the real adoption surface is the NODE shells (section/page-header/geograph/panels) which carry RenderContext.
