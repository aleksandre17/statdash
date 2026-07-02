# Golden fixtures — static-era dataset (pre-platform-migration snapshot)

These JSON files are the **known-correct, pre-regression datasets** captured from the
static era of the Geostat app, before the config-driven / clean-architecture pipeline
migration. They are the **reference** the data-parity sweep (board item `0055`) asserts
against: "today's pipeline must output the SAME data as it was."

> These fixtures are the KNOWN-CORRECT reference, NEVER a target to hardcode the pipeline
> toward. No hardcode-to-golden. (Standing DoD, item `0054`.)

## Provenance

| field          | value                                                          |
| -------------- | -------------------------------------------------------------- |
| source commit  | `191bc0eaf86d8a5e534168ba7021178aae5234c6` (short `191bc0e`)    |
| commit subject  | `chore: initial commit — pre-platform migration snapshot`      |
| commit date    | 2026-06-14 12:08:15 +0400                                       |
| extracted on   | 2026-07-02                                                      |
| extracted by   | board item `0054` (`work/items/0054-golden-fixtures-static-era-extract.md`) |

### Source files (read-only, from git history)

| domain     | source file (`@ 191bc0e`)                    | exported constants captured                       |
| ---------- | -------------------------------------------- | ------------------------------------------------- |
| `gdp`      | `apps/geostat/src/data/gdp/raw.ts`           | `GDP_FACTS`, `GDP_CLASSIFIERS`, `GDP_DISPLAY`      |
| `accounts` | `apps/geostat/src/data/accounts/raw.ts`      | `ACCOUNTS_FACTS`, `ACCOUNTS_CLASSIFIERS`, `ACCOUNTS_DISPLAY` |
| `regional` | `apps/geostat/src/data/regional/raw.ts`      | `REGIONAL_FACTS`, `REGIONAL_CLASSIFIERS`, `REGIONAL_DISPLAY` |

## Extraction method

The three `raw.ts` modules were checked out from `191bc0e` and **evaluated with `tsx`**,
then their exported constants were serialized verbatim to JSON. Evaluation (not text
scraping) is required because the tidy layer is derived at runtime:

- `ACCOUNTS_FACTS` is built via `ACCOUNTS_2025.data.observations.map(...)` — so the golden
  `facts` are the **tidy-rows / observation layer** (the same layer today's pipeline emits),
  carrying full float precision. Values are preserved exactly, not reformatted or rounded.
- `GDP_DISPLAY` is built via `Object.fromEntries(...)`.

Modules import only TypeScript types (`import type ...`), which `tsx`/esbuild strips, so no
engine-package runtime resolution was needed.

## File shape

Each `<domain>.static-191bc0e.json` is inert data (no logic/functions):

```jsonc
{
  "_provenance": { "sourceCommit": "191bc0e", "sourceFile": "apps/geostat/src/data/<domain>/raw.ts" },
  "facts":       [ /* tidy observation rows */ ],
  "classifiers": { /* structural codelists per dimension */ },
  "display":     { /* UI overlay: labels / colors / fullLabels per dimension */ }
}
```

## Coverage (row counts as extracted)

| domain     | facts (obs rows) | classifier dims          | display dims               |
| ---------- | ---------------- | ------------------------ | -------------------------- |
| `gdp`      | 367              | `time`, `measure`, `approach` | `measure`             |
| `accounts` | 279              | `time`, `aggregates`, `account` | `aggregates`, `account` |
| `regional` | 1485             | `geo`, `sector`, `time`  | `geo`, `sector`, `time`    |

### Spot-check values (for eyeballing)

- `gdp` — `GDP` @ 2024 = **93022.3** (`A`); `GDP_PER_CAPITA` @ 2014 = **4829.9** (`A`)
- `accounts` — `P1`/production/side `R` @ 2025 = **178837.27566923446** (derived float, `A`)
- `regional` — `GVA` geo `1` / sector `1` @ 2010 = **33.31**
