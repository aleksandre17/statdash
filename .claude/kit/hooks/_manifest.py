"""Shared: load the project manifest. Generic kit code reads project specifics from here,
so the kit itself contains ZERO domain literals. Returns {} if absent (kit runs degraded, never crashes)."""
import os, json
def load(root=None):
    root = root or os.environ.get("CLAUDE_PROJECT_DIR", ".")
    try:
        return json.load(open(os.path.join(root, ".claude", "project.json"), encoding="utf-8"))
    except Exception:
        return {}
