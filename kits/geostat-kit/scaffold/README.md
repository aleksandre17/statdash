# Project scaffold (geostat-kit)

ფაილები და ფოლდერები, რომლებიც **არ არის** პაკეტის `lib/`, `toolkit/`, `drivers/` ნაწილი, მაგრამ **აუცილებელია** repo root-ზე, რომ `geostat` სრულად იმუშაოს.

## სწრაფი გამოყენება (რეკომენდებული)

```powershell
.\tools\geostat.ps1 init
```

```bash
./tools/geostat.sh init
```

## ხელით (მხოლოდ ხე)

```powershell
powershell -ExecutionPolicy Bypass -File kits\geostat-kit\scaffold\apply-scaffold.ps1
```

## სრული ხე (v2 layout)

```text
your-app/
├── geostat.ops.json          # version 2
├── apps/frontend, apps/backend
├── kits/geostat-kit/         # vendor/submodule (არა scaffold-ში)
├── ops/
│   ├── config/               # was secrets/
│   ├── compose/catalog.json
│   ├── compose/stack/        # compose-gen output
│   ├── cli/geostat.ps1
│   └── ci/
├── tools/geostat.ps1         # shim → ops/cli
└── docs/
```

**გენერირდება** `compose-gen`-ით:  
`apps/*/docker-compose*.yml`, `ops/compose/stack/*.yml`, `apps/backend/ops.modules`.

## შემდეგი ნაბიჯები

1. `geostat init` — scaffold + seed + compose-gen + checklist
2. შეავსე `ops/config/deploy.env`, env ფაილები
3. [docs/ADOPTION-LINE.md](../docs/ADOPTION-LINE.md)

`ops/compose/catalog.full.json` — სრული stack; `catalog.minimal.json` — მხოლოდ API (`init -MinimalCatalog`).
