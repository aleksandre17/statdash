---
name: chrome-accessible-name-i18n
description: The accessible-name i18n class (0093) — [object Object] aria from a LocaleString in a bare-string slot; useTSafe for context-optional chrome; the render-leak gate must scan aria attributes not just textContent
metadata:
  type: project
---

Card 0093 (commit 37062e5) closed the chrome accessible-name / EN-on-KA integrity class. The
non-obvious, durable facts:

**The [object Object] ROOT is a TYPE, not a render bug.** `SocialLinkDef.label` was typed bare
`string`; provisioning authored a `{ka,en}` LocaleString into it; `aria-label={social.label}`
flattened the object. Fix at the contract: widen the field to `LocaleString` + `coverage:'localized'`
in the item schema (mirror `FooterLinkDef`, which was already correct) and resolve at the render seam
`aria-label={t(social.label)}` (useResolveLocale). Never `.toString()`. Same seam as body copy — see
[[i18n-map]] AR-26.

**The render-leak gate had a BLIND SPOT: it scanned `container.textContent` only.** An aria-label /
title / alt lives in an ATTRIBUTE, which never appears in textContent — so `FF-RENDER-NO-LOCALE-LEAK`
(`apps/geostat/src/data/i18n-full-sync.fitness.test.tsx`) rendered the offending header but never SAW
the `[object Object]`. The fix that closes the CLASS: also collect the accessible-name attributes
(`aria-label`,`title`,`alt`,`placeholder`,`aria-description`) across every page×locale and assert no
`[object Object]` + no leaked Georgian on `/en`. Negative-proven (revert resolution → 8 red). The
`.locale-switcher` subtree is excluded from BOTH text and attr scans (it renders endonyms by design).

**`useTSafe` — the non-throwing useT twin (added to `packages/react/.../SiteContext.tsx`).** `useT`
calls `useLocale` which THROWS outside `<SiteProvider>`. `NodeErrorBoundary` is the last line of
defense — it can fire ABOVE or without a provider (boot crash / isolated story), so its localized
fallback needs a safe resolver. `useTSafe(ns)` reads locale from context when present, else lets
i18next resolve its own language; the ns catalog is global in i18next either way. Symmetric with the
existing `useResolveLocaleSafe`. Any context-optional chrome that shows i18n strings must use it, not
`useT`. (A test asserting the boundary's hardcoded English literal had to migrate to a STRUCTURAL
assertion — `.node-error`/`.node-error__retry` present — since the string is now locale-dependent.)

**Control i18n:** a filter control gives a bilingual DEFAULT accessible-name via `FilterControlMeta.i18n`
(registers under the `controlType` namespace); the shell reads `useT('year-select')('label')` as the
fallback when no explicit `config.label` is authored. Was a hardcoded `'Year'`.

**Studio topbar (`apps/panel/.../PageWorkflowBar.tsx`)** localizes via the panel's own seam — a local
`T = {key:{ka,en}}` map + `useActiveLocales()[0]` — NOT the plugin useT/registerSlice path (that's the
runtime chrome). Same pattern as `PageBrowser`. The MUI topbar sat in English beside the Georgian rail.

**Dark table-header contrast (WCAG 1.4.3):** `.data-table th` used `--color-text-faint`, which was
tuned for `--color-surface`, but the header sits on the LIGHTER `--color-surface-raised` → 4.28:1 dark.
`--color-text-muted` is the right mode-aware pair (5.09:1 dark / 5.28:1 light). Rule of thumb: a muted
label ON a raised/sunken surface needs `-muted`, not `-faint`; `-faint` only clears AA on base surface.
See [[dark-mode-completeness-and-fitness]].

**Deploy topology gotcha (bit the live-verify):** portal :3012 serves BUILT assets — any
`packages/*` / `apps/geostat` / provisioning change needs a portal build+deploy to go live. Studio
:3013 bakes `packages/*` AS SOURCE (only `apps/panel/src` is bind-mounted via
`dev-watch-panel.sh --once`) — so a panel-src change (PageWorkflowBar) live-proves after one rsync, but
a `packages/react`/`packages/plugins` change on :3013 needs the whole-src tar-sync + restart
([[dev-line-panel-3013]]). Flag both deploys rather than trigger (shared infra). Acceptance probe:
`platform/work/probe-0093-chrome-a11y.mjs`.
