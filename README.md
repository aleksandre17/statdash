# statdash-platform

A JSON/config-driven statistical dashboard platform. A declarative `DataSpec` config drives a generic renderer (**Phase 1**); a no-code Constructor authors that config (**Phase 2**). Reference-grade for statistical agencies (ONS/IMF/Eurostat standards: SDMX, Grammar of Graphics, Tidy Data).

## Repository layout

```
platform/            The monorepo (pnpm) — all application + engine code
  packages/          Engine, along the dependency arrow (inner → outer):
                     contracts ← expr ← core ← charts ← react ← plugins
  apps/geostat       The live dashboard app (Georgia national accounts)
  apps/panel         The Constructor / authoring app (Phase 2)
  apps/api           Data provisioning + serving API
  tests/  work/  docs/
ops/                 Scripts + Docker compose (check-laws, validate, deploy)
kits/geostat-kit     Manifest-driven ops orchestration toolkit
docs/architecture/decisions/   Architecture Decision Records (ADRs)
.claude/             The agent operating system (kit, agents, memory, hooks)
CLAUDE.md            Binding project laws (also per-module CLAUDE.md files)
```

## Quick start

All commands run from `platform/` (pnpm workspace root):

```bash
cd platform
pnpm install
pnpm dev            # run the geostat dashboard (Vite)
pnpm build          # production build
pnpm test           # vitest
pnpm lint           # eslint (enforces the dependency arrow)
pnpm typecheck      # tsc project references
pnpm check-laws     # project-law enforcement gate
pnpm compose:up     # local stack via Docker (see ops/compose)
```

## Governance

- **Laws:** `CLAUDE.md` (root) + `platform/packages/CLAUDE.md`, `platform/packages/plugins/CLAUDE.md`.
- **Decisions:** `docs/architecture/decisions/` (ADRs).
- **Enforcement:** `.claude/kit/hooks/` + `platform/eslint.config.js` (`no-restricted-imports`).
