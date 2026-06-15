# Project Laws — statdash-platform (root, binding)

> JSON/config-driven statistical dashboard platform. Phase 1: dashboard (JSON config → renderer). Phase 2: Constructor (generates JSON, no code). Per-module laws: `packages/CLAUDE.md`, `plugins/CLAUDE.md`. Enforcement rules: `.claude/rules/`.

1. **No privileged dimensions.** All dimensions are equal: `ctx.dims['time']`, never `ctx.year` / `ctx.regionId`. Generic `Record<K,V>`, never hardcoded dimension names.
2. **Config is declarative, logic lives in the renderer.** `DataSpec` carries data (indicator codes, ObsQuery, `$ctx` refs) — never `getRows:(ctx)=>…`, `val()`, `fetch`, or `if/switch`. A function in config is not Constructor-ready.
3. **Dependency arrow (Clean Architecture):** `packages/engine ← packages/react ← plugins ← src`. Never import against the arrow. `packages/react` stays app-agnostic (Geostat specifics → `plugins/`).
4. **The full benefit of standards, not partial.** Grammar of Graphics, SDMX, OLAP, Vega-Lite, Tidy Data — adopted whole, in their best form.
5. **API-readiness.** `src/data/` is pure data, separated from UI; swapping `DataStore` is one parameter. `fromSDMX` is the only adapter boundary.
6. **Best solution only.** works + agnostic + ISP-clean + extensible + tested. Every fix is root-cause (root cause → standard → fix), never a symptom patch.
7. **Architecture leads, code follows.** When new architecture conflicts with legacy code, the code migrates to the pattern (Strangler-Fig) — never bend the architecture to violations.
8. **Platform-level thinking (M-5).** After the minimal solution, ask "what makes this a reusable, Constructor-ready capability?" — open for extension (new discriminant = new capability, interface unchanged), balanced by YAGNI.
9. **Accessibility + data integrity** (ONS/IMF/Eurostat): WCAG 2.1 AA, preliminary/last-updated/methodology badges, export per section, URL = permalink.
