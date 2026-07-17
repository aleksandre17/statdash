---
name: dev-mode-never-prod
description: Standing guardrail — all work runs against the dev/staging server, never touch prod
metadata:
  type: feedback
---

All hands-on work (server, DB, deploys, verification) runs against the **dev/staging**
environment — **never touch prod**. The owner reaffirmed this on 2026-07-10.

**Why:** prod is a live LAN demo (per VISION-forward-northstar: a :3002/:3003 LAN demo);
the AR-49 arc is live-verified only on an isolated staging twin and is NOT merged to main.
A prod-side action is a real-server one-way door.

**How to apply:** design/build/verify on dev (panel dev = `vite` in `platform/apps/panel`,
API on `:3001`, `VITE_API_URL=http://localhost:3001`). Dev admin credentials come from the
(gitignored) `apps/api/.env` bootstrap fallback (`ADMIN_USERNAME`/`ADMIN_PASSWORD`; the
committed `.env.example` shows `admin` / `change-me-strong-password`). Any prod merge/deploy
is an explicit, owner-gated step (backup-first, per-service) — never a side effect of routine work.
Relates to [[project_live_provisioning]].
