---
name: engine-react-locale-agnostic
description: A post-edit law hook blocks Georgian codepoints and 'ka'/'ka-GE' literals anywhere in engine/react (incl. tests)
metadata:
  type: feedback
---

`engine/react` must be locale-agnostic. A `post-edit-laws.py` hook hard-BLOCKS any file under `engine/react/` (including `.test.tsx`) that contains Georgian codepoints or the locale literals `'ka'` / `'ka-GE'`.

**Why:** Law 3 (Clean Architecture) — `@geostat/react` stays app-agnostic; Geostat/Georgian specifics belong in `plugins/` or the app i18n catalog. The hook enforces it mechanically, not by review.
**How to apply:** When writing engine/react code or tests that need to demonstrate LocaleString/locale behavior, use neutral placeholder locales like `'en'` and `'fr'` — never `'ka'` or Georgian text. (Real plugin metas DO use `ka`/Georgian, because they live in `engine/plugins`, which is outside the hook's scope.)
