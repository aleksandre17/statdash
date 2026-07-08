---
name: panel-dataprovider-typing
description: react-admin v5 DataProvider methods take TWO args (resource, params) — single-arg arrows mistype params as string; irresolvable generic returns need an `as never` cast
metadata:
  type: project
---

`apps/panel/src/providers/dataProvider.ts` (React Admin v5 + MUI v6 + Emotion v11,
the Phase-2 Constructor admin UI): DataProvider methods take TWO arguments —
`(resource: string, params: XParams)`. A single-arg arrow (`params => ...`) mistypes
`params` as `string`. Always write `(_resource, params) => ...`.

For methods with irresolvable generic return types (`create`, `getOne`, `delete`), an
`as never` cast on the return is the correct, sanctioned escape hatch — not a type
hole to "fix" later.
