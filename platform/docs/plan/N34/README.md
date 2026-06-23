# N34 — Async Data Lifecycle Contract (Design)

> Status: **design-only** (no source changed). Implementation split into N34a–N34d (see `08-roadmap.md`).
> Root cause: `interpretSpec()` and `DataStore.query()` are synchronous and `StoreCaps.streaming` is hardcoded `false` everywhere — so the platform has no loading state, no per-node error state, no polling, no streaming, no network-live queries. ~8 cross-cutting gaps share this single root.

## Document map (one concern per file — `05`/`09` hygiene)

| File | Concern |
|---|---|
| `00-current-state.md` | What async infra **already exists** — do NOT design over it |
| `01-queryresult.md` | The `QueryResult` + `ResultMeta` contract (§1) |
| `02-datastore.md` | Updated `DataStore` interface + the chosen approach vs alternatives (§2) |
| `03-migration.md` | Expand-contract path; existing stores keep working (§3) |
| `04-rendercontext.md` | `RenderContext.rows` evolution; `useNodeRows` as the async boundary (§4) |
| `05-shell-contract.md` | Shell rendering contract — zero async code in shells (§5) |
| `06-ssr-fastlane.md` | SSR / snapshot synchronous fast-lane (§6) |
| `07-streaming.md` | Polling / streaming `subscribe` extension (§7) |
| `08-roadmap.md` | N34a–N34d sub-tasks: scope, files, tests, size (§8) |
| `09-risk-adr.md` | Risk assessment + ADR summary (§9) |

## The one central decision

**`interpretSpec` stays synchronous over `querySync`.** Async is a **React-layer concern** owned by `useNodeRows`, feeding the *already-present* Suspense / skeleton / ErrorBoundary scaffolding (`renderNode.ts:288-301`). SSR keeps a synchronous fast-lane gated by `caps.sync`; async-only stores warm-then-read. Everything else follows from this. See `02-datastore.md` and `09-risk-adr.md`.
