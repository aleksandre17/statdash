# src/ — Application Layer Orientation (PURE GENERIC RUNNER)

> **Layer orientation only.** This app is a de-tenanted SDUI runner (ADR-0028):
> it carries NO tenant content (no pages, no datasets, no brand). All content
> comes from the API at boot.
>
> src/ = outermost layer — knows everything. Only here can app-tier (non-content)
> wiring live: registrations, extension contributions, i18n machinery, the
> bootstrap client.

---

## site-manifest.ts — the boot seam

```ts
// Primary:  manifest = GET /api/bootstrap;  stores = config.data_source rows.
// Fallback: emptyManifest() (brand-free "site unavailable" page) when the API
//           is unreachable/unconfigured — the runner always boots fail-soft.
```

- No compiled-in pages/nav/chrome/datasets — those were extracted to
  `apps/api/provisioning/geostat.provisioning.json` (config) and
  `ops/seed-data/geostat/` (data), then deleted.
- `emptyManifest()` MUST stay tenant-agnostic (Law 1) + en-only.
- `feedback.ts` ships only the en UI-chrome baseline; tenant locales arrive via
  the manifest i18n catalog at boot.
