---
name: remote-dev-cli
description: The remote-dev system — how to run the panel/apps on the Linux dev server (192.168.1.199); it is the CLI, NOT local vite. Needs pwsh (PS7).
metadata:
  type: reference
---
**The remote-dev system (use THIS to show work on the server — do NOT reinvent with local vite):**
- Entry: `tools/statdash.ps1` → `ops/cli/statdash.ps1`/`.sh` → `kits/geostat-kit/cli/geostat.ps1` (kit dispatcher). Bash variant `ops/cli/statdash.sh` exists but routes `dev` back to PowerShell.
- Command: **`.\tools\statdash.ps1 dev up <alias> --mode remote`** — Mode ③ "Remote watch": rsync local branch SOURCE → the Linux server + a Vite dev container there (live reload). `deploy watch` = static dist build on server instead.
- Aliases (`geostat.ops.json`): `a`=api, `g`=geostat, `p`=panel. So the panel on the server = **`dev up p --mode remote`**.
- Target: `DEPLOY_SERVER=geostat-deploy` (`ops/config/deploy.env`) → SSH `administrator@192.168.1.199` (`ops/config/ssh/config` + gitignored `id_rsa`). This is the DEV server (192.168.1.199) — NOT prod. Modes: DEV-MODES.md (① local host · ② local docker · ③ remote watch · ④ hybrid).
- Ports on the server: nginx CSP allows `192.168.1.199:5171/5173` (dev vite). `192.168.1.199` is the SERVER, not this Windows box (this box LAN IP = 192.168.2.115).

**Toolchain (provisioned 2026-07-11):** the kit dev scripts need **pwsh 7** (5.1 can't parse them — ternary `? :` → brace-cascade) AND **rsync** (Mode ③ source sync) AND ssh. This Git-Bash shell originally had NONE. Installed this session:
- **pwsh 7.6.3** via `winget install Microsoft.PowerShell` → `C:\Users\Test-User\AppData\Local\Microsoft\WindowsApps\pwsh.exe` (WindowsApps alias, not on default PATH).
- **rsync 3.4.4** via `winget install MSYS2.MSYS2` then `/c/msys64/usr/bin/pacman -Sy --noconfirm rsync` → `/c/msys64/usr/bin/rsync.exe`.
- ssh = Git's OpenSSH 9.1 (already present).
To invoke the kit, PREPEND both to PATH: `export PATH="/c/msys64/usr/bin:/c/Users/Test-User/AppData/Local/Microsoft/WindowsApps:$PATH"`.

**rsync-over-ssh VALIDATED (2026-07-11) — the working recipe** (first naive attempt failed with `dup() in/out/err failed` = MSYS2 rsync could not use GIT's ssh — cross-runtime fd bug):
- Install MSYS2's OWN ssh: `/c/msys64/usr/bin/pacman -S --noconfirm openssh`.
- Then: `export PATH="/c/msys64/usr/bin:$PATH"; export HOME="/c/Users/Test-User"` and force rsync to use the MSYS2 ssh: `rsync -az -e "/c/msys64/usr/bin/ssh -F ops/config/ssh/config -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" <src> geostat-deploy:<dst>`.
- Local paths MUST be MSYS2-space `/c/...` (NOT Git-Bash `/tmp`, which ≠ MSYS2 `/tmp`, and NOT Windows `C:\`). SSH to the server works from this box (different subnet 192.168.2.115 → 192.168.1.199 is routed).
- **Kit integration — what it took (2026-07-11), and the last-mile wall:** to get the kit's `p dev bootstrap` rsync to succeed from this Git-Bash+MSYS2 shell required, in order: (1) MSYS2 rsync + MSYS2 openssh on PATH; (2) the server host-key accepted — the kit's rsync ssh does NOT pass `-F ops/config/ssh/config`, so put the `geostat-deploy` Host block (HostName/User/IdentityFile + `StrictHostKeyChecking no` + `UserKnownHostsFile /dev/null`) in **MSYS2 ssh's default config `/c/msys64/home/Test-User/.ssh/config`** (MSYS2 ssh reads its passwd-home `/home/Test-User`, NOT `$HOME` or `~/.ssh`); also added the two host-key lines to `ops/config/ssh/config`. Run env: `export PATH="/c/msys64/usr/bin:/c/Users/Test-User/AppData/Local/Microsoft/WindowsApps:$PATH"; export HOME="/c/msys64/home/Test-User"`. With that, `p dev bootstrap` **rsync succeeds** (source → `/home/administrator/statdash/panel/compose/dev/statdash-panel/`). **BUT the last mile fails:** bootstrap does ONLY the rsync (no docker compose up), and `p dev watch` produces NO output + creates NO container in this hybrid shell — the kit's container-orchestration step doesn't fire here. Live-watch toolchain is PROVEN (rsync works) but the kit's dev-container bring-up needs the kit's intended provisioned env (owner's terminal) or further kit-driver debugging. NOT pursued further (diminishing returns on a Frankenstein toolchain); the dev line is fully usable image-based at :3013. Also: kit orchestrator `Invoke-DevUp.ps1` had a runtime bug at `geostat.ps1:427` (param 'Command') on the `dev up … --mode remote` path; the per-module path `p dev bootstrap|watch` got further (only needed the missing `DEPLOY_HOST_PORT`, since set).

**Also (deployment gap, flagged):** the **panel/constructor is NOT in the dev/staging Docker compose** — `ops/compose/docker-compose.yml` says "geostat-app (+ panel in Phase 3)"; panel is a container only in `docker-compose.prod.yml` (:3003, untouchable). So on the server the panel is seen via the `dev up p` Vite container (remote watch), not a compose service. Related: [[server-deploy-build-context]], [[built-but-buried-audit]] (observe/use existing tooling, don't reinvent).
