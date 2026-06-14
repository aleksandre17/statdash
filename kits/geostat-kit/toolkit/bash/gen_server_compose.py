#!/usr/bin/env python3
"""Normalize module compose for per-service server deploy (paths -> ./)."""
from __future__ import annotations

import argparse
import copy
import os
import re
import sys

try:
    import yaml
except ImportError:
    print("ERROR: python3-yaml required", file=sys.stderr)
    sys.exit(1)

SECRETS_RE = re.compile(r"(?:\.\./)+secrets/", re.I)


def _rewrite_host_path(host: str) -> str:
    host = host.strip()
    if not host or host.startswith("/") and "secrets" not in host:
        return host
    if "secrets" in host or host.startswith("../") or host.startswith("./.."):
        base = os.path.basename(host.rstrip("/"))
        if not base or base in (".", ".."):
            return host
        if base == "logs" or host.endswith("/logs"):
            return "./logs"
        return f"./{base}"
    if host in ("./logs", "logs"):
        return "./logs"
    return host


def _normalize_volumes(volumes: list) -> list:
    out = []
    for v in volumes or []:
        if isinstance(v, str):
            if ":" in v:
                host, rest = v.split(":", 1)
                out.append(f"{_rewrite_host_path(host)}:{rest}")
            else:
                out.append(v)
        else:
            out.append(v)
    return out


def normalize_service(svc_cfg: dict, environment: str) -> dict:
    cfg = copy.deepcopy(svc_cfg)
    cfg.pop("build", None)
    if "image" not in cfg and "container_name" in cfg:
        cfg["image"] = cfg["container_name"]
    # Server deploy uploads ./Dockerfile + ./app.jar — build locally, do not pull from registry.
    cfg["build"] = {"context": ".", "dockerfile": "Dockerfile"}
    # Stack services reach API via Docker DNS (geostat-chat-ai-api:8090). Omit host ports so
    # legacy containers (e.g. geostat-chat-api on :8090) can stay up during P6 transition.
    if "ports" in cfg:
        cfg.pop("ports", None)

    cfg["env_file"] = [f".env.{environment}"]

    if "volumes" in cfg:
        cfg["volumes"] = _normalize_volumes(cfg.get("volumes") or [])

    return cfg


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--src", required=True)
    p.add_argument("--service", required=True)
    p.add_argument("--environment", required=True, choices=("dev", "prod"))
    p.add_argument("--out", required=True)
    args = p.parse_args()

    with open(args.src, encoding="utf-8") as f:
        src = yaml.safe_load(f)

    if not src or "services" not in src or args.service not in src["services"]:
        print(f"ERROR: service '{args.service}' not in {args.src}", file=sys.stderr)
        return 1

    svc_cfg = normalize_service(src["services"][args.service], args.environment)

    named_vols: dict = {}
    if "volumes" in src:
        for v in svc_cfg.get("volumes", []):
            if isinstance(v, str) and ":" in v:
                vol_name = v.split(":")[0]
                if not vol_name.startswith(".") and not vol_name.startswith("/"):
                    if vol_name in src.get("volumes", {}):
                        named_vols[vol_name] = src["volumes"][vol_name] or {}

    out: dict = {"services": {args.service: svc_cfg}}
    if named_vols:
        out["volumes"] = named_vols

    if "networks" in svc_cfg:
        nets = svc_cfg["networks"]
        if isinstance(nets, list):
            net_names = nets
        else:
            net_names = list(nets.keys())
        out["networks"] = {n: {"external": True} for n in net_names}

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        yaml.dump(out, f, default_flow_style=False, allow_unicode=True)

    print(f"  [OK] {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
