---
name: law4-i18n-check
description: check-laws.sh Law-4 Georgian-text rule semantics — single-locale = violation, bilingual {ka,en} = compliant
metadata:
  type: project
---

`ops/scripts/check-laws.sh` Law-4 "No hardcoded Georgian text in engine" greps `packages/core/src` for Georgian syllable fragments (`გა|ვე|ება|ის|ობ`). Law 4 = "full benefit of the standard, not partial": it forbids a **single-locale hardcode**, NOT bilingual content.

The `check_ts` filter therefore exempts (in addition to comments and `.test.` files):
- lines containing an `en:` sibling (a compliant `LocaleString` / catalog pair `{ ka: '…', en: '…' }`), via `grep -vE "\ben\b[[:space:]]*:"`.
- `*-catalog.ts` files entirely (Self-Describing Module pattern: spec-catalog, ops-catalog) — their bilingual entries spread `ka:` across its own line, so the per-line `en:` check can't pair them.

A genuine single-locale Georgian hardcode (no `en:` pair, not a catalog) still fails — verified.

**Engine i18n standard:** locale labels in `packages/core` use `LocaleString` (`string | Record<string,string>`, from `packages/core/src/i18n/types.ts`). Consumers resolve via `resolveLocaleString` / the `useResolveLocale` hook. For app-agnostic, context-optional components (e.g. StatusBadge) use **`useResolveLocaleSafe`** (added in SiteContext) — it degrades gracefully outside `<SiteProvider>` instead of throwing.

**How to apply:** when adding user-facing labels to `packages/core`, write bilingual `{ ka, en }`, never a bare Georgian string. To resolve outside a guaranteed provider, use `useResolveLocaleSafe`.
