# Local Run and Debug (VS Code / Cursor)

**რომელი რეჟიმი როდის (ლოკალური / Docker / remote)?** → **[DEV-MODES.md](DEV-MODES.md)** — მთავარი გზამკვლევი.

პაკეტი გენერირებს **`.vscode/launch.json`** და **`tasks.json`** manifest-იდან — paths აღარ არის hardcoded `frontend/` / `backend/`.

## გენერაცია

```powershell
.\tools\geostat.ps1 vscode-gen          # მხოლოდ აკლებული ფაილები
.\tools\geostat.ps1 vscode-gen --force  # გადაწერა
```

`geostat init` — ავტომატურად უშვებს `vscode-gen` (თუ `.vscode` ფაილები არ არსებობს).

## რა იქმნება

| Driver | Launch config | რა იწყება |
|--------|---------------|-----------|
| `node-vite` | `npm run dev` | Vite ლოკალურად (`modules.<id>.path`) |
| `java-boot` | Java: Spring Boot | `mainClass` + `projectName` (ან auto-detect) |
| — | `geostat: stack` | compose stack dev |
| — | `geostat: fe/be check` | ops smoke |

**Compound:** `Full stack (local)` — API + UI ერთად (Run and Debug → compound).

**Hybrid ④:** `Hybrid: infra tunnel + API + UI` — `preLaunchTask` = SSH tunnel (`stack.infra.services` manifest-ში); საჭიროა `ops/config/deploy.env` + `ops/config/infra/.env.dev`. Remote infra: `geostat infra remote up` (task ან ხელით).

## Manifest (ოფციური დეტალები)

```json
"vscode": {
  "folder": ".vscode",
  "geostatScript": "tools/geostat.ps1"
},
"modules": {
  "backend": {
    "type": "java-boot",
    "path": "apps/backend",
    "debug": {
      "java": {
        "mainClass": "com.example.Application",
        "projectName": "my-gradle-root"
      }
    }
  },
  "frontend": {
    "type": "node-vite",
    "debug": { "npmScript": "dev", "label": "UI: Vite" }
  }
}
```

თუ `debug.java` არ არის — პაკეტი ეძებს `*Application.java` და `settings.gradle` `rootProject.name`.

## საჭირო extensions (Cursor / VS Code)

| Stack | Extension |
|-------|-----------|
| Java/Spring | Extension Pack for Java |
| Node/Vite | ჩვეულებრივ built-in terminal (`node-terminal`) |

## Tasks პანელი

`tasks.json` — `geostat stack`, `compose-gen`, `validate`, `fe/be compose up`, checks.

გაშვება: **Terminal → Run Task** ან launch-ში preLaunchTask (თუ ხელით დაამატებ).

## რეჟიმები — launch.json და tasks.json

| რეჟიმი | Run and Debug (launch) | Tasks Panel |
|--------|------------------------|-------------|
| ① ლოკალური, Docker-ის გარეშე | `frontend: npm run dev`, `chat-api: Spring Boot`, **Full stack (local)** | — |
| ② ლოკალური Docker | `geostat: stack (compose dev)` | `geostat: stack dev`, `fe/be/ret/ing compose up` |
| ③ Remote + Docker | **launch-ში არ არის** | `geostat: <alias> dev watch (remote)`, `geostat: dev up <alias> --mode remote` |
| ④ Hybrid | **Hybrid: infra tunnel + API + UI** | `geostat: dev up <alias>`, `geostat: infra tunnel`, `geostat: infra remote up` |

სრული ცხრილი, commands და `dev watch` vs `deploy watch`: **[DEV-MODES.md](DEV-MODES.md)**.

## დაკავშირებული

- [DEV-MODES.md](DEV-MODES.md) — ლოკალური vs Docker vs remote
- [STARTER.md](STARTER.md)
- [MATURITY.md](MATURITY.md)
- [REMOTE-DEV-DOCKERFILE-FLOW.md](REMOTE-DEV-DOCKERFILE-FLOW.md)
