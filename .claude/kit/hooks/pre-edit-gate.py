#!/usr/bin/env python3
"""PreToolUse (Write|Edit) — generic Class-M detector. Triggers come from project.json
(class_m_triggers); the kit has no hardcoded paths. Injects a non-blocking gate+risk reminder."""
import sys, json, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _manifest import load
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
fp = (data.get("tool_input") or {}).get("file_path", "")
if not fp: sys.exit(0)
fp = fp.replace("\\", "/")  # normalize Windows backslashes so path regexes (db/migration) match
for t in load().get("class_m_triggers", []):
    if re.search(t["match"], fp):
        tag = "Class-M + IRREVERSIBLE" if t.get("irreversible") else "Possible Class-M trigger"
        risk = " Run Task-degradation risk (09 B: reversibility/blast/rollback) BEFORE proceeding." if t.get("irreversible") else ""
        msg = f"{tag}: {t['label']}. {t.get('note','')}.{risk}"
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "additionalContext": msg}}))
        break
sys.exit(0)
