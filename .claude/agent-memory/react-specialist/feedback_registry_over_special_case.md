---
name: registry-over-special-case
description: A generic renderer/engine layer must iterate an open registry, never special-case named concerns — relocating a smell to a typed field is rejected
metadata:
  type: feedback
---

A "typed field" refactor that merely RELOCATES imperative special-casing is rejected. When a generic renderer in `packages/react` handles named concerns (color, crumbs, theme, …), the bar is: the renderer must end up knowing NOTHING about any specific concern. Presentation/behavior must flow ONLY through a generic registry loop, and adding a future concern must require ZERO edits to the renderer.

**Why:** ADR-0029 v1 (a typed `PageConfigBase.presentation` slot read imperatively in SiteRenderer) was REJECTED for exactly this — `vars['_pageColor']` → `presentation['color']` still left a `typeof`-narrow + `isCrumbs`-guard + two hardcoded targets in the shared renderer. The repo's OCP discipline (`registerStoreBuilder`/`registeredKinds`, `FieldControlRegistry`, `middlewareRegistry`, command bus) is the standard; the escapee concern must be brought home to it.

**How to apply:** When asked to make a shared renderer extensible: (1) define a thin contract (key + schema + evaluate + project), (2) an open registry mirroring `storeManifest.ts` exactly (register/list/propSchema), (3) a generic sink the renderer applies blindly (cssVars on wrapper, nav patch merged), (4) concrete units register at app boot in `setupRegistrations.ts` + `setupCanvasRegistry.ts` (both — geostat AND panel), (5) a fitness test asserting the renderer source contains NO concern literal and references only the generic loop. The structural type that's part of the generic `RenderContext` contract (e.g. `Crumb` for `navContext.crumbs`) STAYS in engine; only the per-concern runtime guard + projection move to the registered unit in plugins. See [[project-presentation-registry]].
