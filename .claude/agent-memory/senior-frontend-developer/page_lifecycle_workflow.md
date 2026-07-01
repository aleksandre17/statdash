---
name: page-lifecycle-workflow
description: Constructor draft→publish workflow in apps/panel — lifecycle store slice, api-action thunks, PageWorkflowBar UI, and where save-guard/403 surface
metadata:
  type: project
---

The usable draft→publish product workflow over the proven author→render loop lives in `platform/apps/panel`.

**Server FSM is reflected, never reimplemented.** Page lifecycle (draft/published/archived) is owned by the API (`config.page.status` + `page_version.is_published`). The panel mirrors it.

**Lifecycle is modelled SEPARATELY from CanvasPage.** Adding lifecycle fields to `CanvasPage` would break the lossless canvasPageAdapter round-trip (the e2e fitness `stableStringify(fromNodePageConfig(toNodePageConfig(x))) ≡ x`). So lifecycle state lives in its own store slice keyed by page id:
- `store/constructor.lifecycle.ts` — `PageLifecycle` (status/versionNumber/latestPublished/dirty), `SaveStatus` (guard issues/error/saved), `PublishStatus` (forbidden/error), all `Record<pageId, …>` + pure reducers. Wired into the store via thin actions `reflectLifecycle/markPageDirty/setSaveStatus/setPublishStatus` (NOT pushed to history — server/UI state isn't undoable). Read-side hooks `usePageLifecycle/useSaveStatus/usePublishStatus` in `store/constructor.selectors.ts`.

**api-action thunks** (`store/api-actions.ts`): `openPage` (GET/:id → fromApiPage hydrate + reflect FSM + setActive), `savePage` (runs C5 guard BEFORE PUT; records issues to saveStatus on block — returns `{ok,issues}` so no caller try/catch; on success reflects status:draft + new version + latestPublished:false since a new version supersedes the published one), `publishPage` (POST/:id/publish; ApiError 403 → `publishStatus.forbidden=true`, status NOT flipped), `fetchVersions`, `createPage` (reflects clean draft v1).

**API client** (`lib/api.ts`): added `configApi.pages.versions` + `.publish`; `PageDetailRow.is_published`; `PageVersionRow`, `PublishResult` types. Exported `ApiError` (api-actions discriminates 403 on it).

**UI** (`features/page-workflow/`): `PageWorkflowBar` (the toolbar mounted at top of PageStep — Pages browser / status badge / History / Save draft / Publish), `PageBrowser` (list/open/create dialog), `PageStatusBadge` (server FSM, WCAG text-not-color-only), `SaveIssueList` (groups SaveIssue[] by the 4 checks, deep-links nodeId via onSelectNode), `VersionHistoryDialog`. Publish is disabled while `dirty` (the latest VERSION publishes, not the editor buffer). PageStep marks `markPageDirty` on drop/patchProp/delete; its old stubbed "export Phase 2.5" save button was removed.

**Store bloat ceiling (400 hard).** Adding the slice pushed constructor.store.ts over 400 → split: page-node reducers extracted to `store/constructor.pages.ts` (pure, mirrors constructor.chrome pattern), selectors to `store/constructor.selectors.ts` (re-exported from the store via `export *` for import stability). Keep the store as thin wiring only.

**Tests** (mock `globalThis.fetch`, drive real thunks + real api client so ApiError/403/envelope are exercised): `store/pageWorkflow.test.ts` (save-blocks-no-PUT, save-success-reflects, publish-403-forbidden, open→hydrate→edit→save round-trip, create), `features/page-workflow/PageWorkflowBar.test.tsx` (inline issue list, 403 alert, badge reflects FSM, publish-disabled-while-dirty), `canvas/paletteCompleteness.test.ts` (palette === registry placeable set; text+gauge present). Baseline 97 → 111.

**Palette completeness is architectural (OCP), not curated:** `getPaletteEntries()` derives from `nodeRegistry.list()`; `setupCanvasRegistry` registers all `@plugins/{panels,nodes,...}` via Object.values. text+gauge appear automatically because they're now in the `packages/plugins/panels/index.ts` barrel (see [[text_gauge_panels_not_in_barrel]] — now fixed by the plugins owner).
