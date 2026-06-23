---
name: plugin-fieldconfig
description: FieldConfig.thresholds shape and resolveThresholdColor usage in engine/plugins
metadata:
  type: project
---

`FieldConfig.thresholds` is `Threshold[]` (flat array), NOT `{ steps: ThresholdDef[] }` as some brief specs suggest.

```ts
interface Threshold {
  value: number | null  // null = base color (always active)
  color: string
  label?: string
}
```

`resolveThresholdColor(value: number, thresholds: Threshold[]): string | undefined` is already exported from `@geostat/engine` — do NOT re-implement it.

**Why:** The brief for the gauge panel described a non-existent `{ steps: [] }` shape. The real type is in `engine/core/src/field/config.ts`.

**How to apply:** When a panel needs threshold coloring, import `resolveThresholdColor` from `@geostat/engine` and pass `def.thresholds ?? []` directly.
