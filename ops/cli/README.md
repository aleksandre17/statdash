# ops/cli — Canonical CLI entry

Forwards to `kits/geostat-kit/cli/geostat.ps1` (the kit runtime).

```
tools/statdash.ps1          ← user-facing shim (project root)
  └─ ops/cli/statdash.ps1   ← canonical project entry (this dir)
       └─ kits/geostat-kit/cli/geostat.ps1  ← kit dispatcher
```

**Do not put logic here** — this is a pass-through only. All CLI logic lives in the kit.
