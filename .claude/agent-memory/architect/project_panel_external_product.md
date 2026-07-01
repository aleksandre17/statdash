---
name: panel-external-product
description: Panel (geostat-builder-engine) is the platform product that will ship EXTERNALLY; engine packages are the published contract — reframes publication strategy
metadata:
  type: project
---

The product mental model (confirmed 2026-06-14 architecture session): **engine = the library, panel = THE platform product that goes external.** Panel (apps/panel, "geostat-builder-engine") is a standalone Constructor that assembles sites; it will eventually live in its own repo (e.g. github.com/geostat/panel). apps/geostat is the **reference consumer / dogfooding site** that proves the engine+panel stack. Pattern mirror: Builder.io (visual editor + runtime + sites), Sanity (Studio + GROQ/API + delivery), Grafana (builder + plugin engine + dashboards).

```
engine (published libs) ← panel (external Constructor)  → generates JSON config
engine (published libs) ← apps/geostat (interprets + renders JSON)
```

**Why:** panel going external changes the meaning of the engine packages — a **published npm package becomes the contract** between engine and external panel deployments. This is NOT just a monorepo-tidiness question anymore; it's a product-boundary / API-compatibility (SemVer) question. engine/plugins is the **shared vocabulary** between panel (the palette it shows) and runtime (the registry geostat interprets) — so it must publish too and become @geostat/plugins.

**How to apply:** Treat engine/* packages as **public API surfaces** (SemVer discipline, additive changes, no source-only `exports` once published). Architect apps/panel as if already in its own repo — own devDeps, own CI, depends on engine ONLY through the published-shaped package boundary (no reaching into engine/*/src by relative path). The monorepo is **temporary incubation for panel, permanent home for geostat**. When recommending workspace/publish changes, respect the latent install-breaker in [[geostat-alias-resolution]] (workspace:* under npm) and the seam history in [[apps-monorepo-migration]]. Split trigger = first external panel consumer needs a versioned engine release.
