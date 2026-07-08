"""Shared: load the project manifest. Generic kit code reads project specifics from here,
so the kit itself contains ZERO domain literals. Degrades to {} (kit runs degraded, never crashes),
but distinguishes the two failure modes:
  - manifest ABSENT   -> {} silently (by design: kit is drop-in, works with no manifest).
  - manifest PRESENT but unparseable -> {} PLUS a one-line stderr warning, because every law then
    silently becomes a no-op ("enforcement off" must be visible, not swallowed). See selftest P3."""
import os, sys, json


def load(root=None):
    root = root or os.environ.get("CLAUDE_PROJECT_DIR", ".")
    path = os.path.join(root, ".claude", "project.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        sys.stderr.write(
            f"[manifest] project.json PRESENT but failed to parse "
            f"({type(e).__name__}: {e}); law enforcement is OFF until fixed.\n"
        )
        return {}
