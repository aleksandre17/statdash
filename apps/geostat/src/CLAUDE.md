# src/ — Application Layer Orientation

> ავტოლოადი src/-ის ნებისმიერ ფაილზე მუშაობისას.
> **Layer orientation only** — fromSDMX / DataSpec / Phase 1 constants → `.claude/rules/data.md` (when in `src/data/**`);
> page config JSON shape → `.claude/rules/pages.md` (when in `src/pages/**`).
>
> src/ = outermost layer — knows everything. Only here can app-specific code live.

---

## manifest.ts — Phase 1 / 2 Seam

```ts
// Phase 1 (now):   return { datasources: DATASOURCE_CONFIGS, pages: pagesRecord(), ... }
// Phase 2 (later): return fetch('/api/site').then(r => r.json())
// ONE line change. Everything else stays.
```

Full Phase contract → `.claude/individual/context/identity.md` §"Phase 1 → Phase 2: The Single Switch"
