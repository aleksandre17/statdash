#!/usr/bin/env python3
"""SessionEnd hook — closes the feedback loop. Rolls up token-log into a measured summary line
so token-economy claims stop being estimates."""
import os, re, datetime
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
log = os.path.join(root, ".claude", "session", "token-log.md")
try:
    text = open(log, encoding="utf-8").read()
except OSError:
    raise SystemExit(0)
total = sum(int(n.replace(",", "")) for n in re.findall(r"tokens=~?([0-9,]+)", text))
runs = len(re.findall(r"(?m)^\[", text))
date = datetime.date.today().isoformat()
with open(log, "a", encoding="utf-8") as f:
    f.write(f"[{date}] SESSION ROLLUP: runs={runs} total_tokens={total}  (SessionEnd hook — measured)\n")
