---
name: buildstaticcontext-not-a-smell
description: buildStaticContext per-field defaulting is NOT the closed-switch smell — defaulted fields are RenderContext infrastructure, not extensible presentation concerns; a field-default registry rejected as YAGNI
metadata:
  type: project
---

ADR-0029 §6 "everywhere lens" item 2 (`buildStaticContext` per-field defaulting "should derive from projector `schema().default`") was investigated (2026-06) and resolved to: **NOT the smell — do not build a registry. Case (B), already fine, no code change.**

**Where:** `platform/packages/react/src/engine/targets/html.tsx` — `buildStaticContext(input) → StaticRenderContext` (lines ~129–171).

**What it actually does:** Plain per-field default assignment (`x ?? defaultX`) over a FIXED set of `StaticRenderContext` fields, plus ONE computed default (`mode` derived from `sectionCtx.timeMode`). The defaulted fields are `filterParams ?? {}`, `vars ?? {}`, `locale ?? 'en'`, `fallbackLocale ?? 'en'`, `timeModeKey ?? 'mode'`, `mode ?? {...}`, `effects ?? []`. The rest (`pageStoreKey`, `color`, `crumbs`, `presentation`, `navContext`, `theme`, `auth`, `snapshotClassName`) are pure passthrough.

**Why the architect's `schema().default` hypothesis does NOT hold:**
1. The defaulted fields are NOT presentation concerns. They are the serializable mirror of `RenderContext` infrastructure (i18n config, time-mode key, filter/mode/effect runtime state). None is — or could be — in `listPresentationProjectors()`. Deriving `locale`'s default from `schema().default` is a category error: there is no projector for `locale`. (`PropField.default?` exists, but projectors carry presentation concerns only.)
2. `color`/`crumbs` — the only two fields that ARE presentation concerns — already route through the registry: folded into the generic `presentation` bag by the input-adapter spread (html.tsx ~136–141) and projected by `projectPresentation`. They get NO per-concern default in the builder (`color: input.color` is passthrough; the color projector owns `pageColorFallback`). The presentation concerns are already home.
3. No closed switch over named extensible concerns. Adding a presentation concern = register a projector, ZERO `buildStaticContext` edits. Adding an infrastructure field is the same additive shape as growing `RenderContext`/`RenderTarget` — a bounded mirror, not an open extension axis.

**How to apply:** A "static-context-field registry" would force `locale`/`timeModeKey`/`mode`/`effects` defaults through ceremony with zero OCP gain AND couple `RenderContext` infrastructure to the presentation-projector contract — a layering inversion the ADR avoids. Same situation as AppChrome: the property the presentation reshape had to CREATE (zero per-concern branches), `buildStaticContext` already HAS for the presentation axis (folded into the registry) and correctly does NOT need for the infrastructure axis (closed mirror). Hold this line if asked to "apply the presentation reshape to buildStaticContext". No fitness test added — there is no concern-switch to guard against regressing; existing `buildStaticContext.test.ts` already locks the default values. This closes the last code-level §6 item. See [[frame-system-not-a-smell]], [[project-presentation-registry]], [[registry-over-special-case]].
