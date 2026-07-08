#!/usr/bin/env python3
"""SubagentStop — per-run ledger: requested vs VERIFIED model + tokens (owner, 2026-07-08).

Closes two observability gaps in one mechanism:
  1. requested != verified model — LAUNCH lines are written by the lead at spawn
     (model-requested); this hook writes the RUN line from the agent's own transcript
     (model-actual = ground truth, the '"model":"claude-…"' fields of its assistant turns).
  2. per-run token detail — out-tokens summed from the transcript's usage records.

Ledger: .claude/session/token-log.md, one RUN line per agent transcript (deduped by run id).
Drift alarm: if a RUN's model family has NO LAUNCH line requesting that family today,
the line gets '⚠ MODEL-VERIFY' — either routing drifted or the lead skipped ledger duty.
Suite law: manifest-free (generic), utf-8 everywhere, degrade-silent, never crash, exit 0.
"""
import os, sys, re, json, time

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

RECENT_S = 1800  # fallback scan window: transcripts touched in the last 30 min


def _candidates(root):
    """Agent transcripts to ledger: stdin transcript_path if it is one, else recent agent-*.jsonl."""
    tp = None
    try:
        tp = json.loads(sys.stdin.read() or "{}").get("transcript_path")
    except Exception:
        pass
    if tp and os.path.basename(tp).startswith("agent-") and os.path.exists(tp):
        return [tp]
    # real layout: ~/.claude/projects/<slug>/<session-id>/subagents/agent-*.jsonl
    slug = re.sub(r"[:\\/]", "-", os.path.abspath(root))
    tdir = os.path.join(os.path.expanduser("~"), ".claude", "projects", slug)
    sid = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    subdirs = ([os.path.join(tdir, sid, "subagents")] if sid else [])
    if not subdirs or not os.path.isdir(subdirs[0]):
        try:
            subdirs = [os.path.join(tdir, d, "subagents") for d in os.listdir(tdir)
                       if os.path.isdir(os.path.join(tdir, d, "subagents"))]
        except Exception:
            return []
    out, now = [], time.time()
    for sd in subdirs:
        try:
            out += [os.path.join(sd, f) for f in os.listdir(sd)
                    if f.startswith("agent-") and f.endswith(".jsonl")
                    and now - os.path.getmtime(os.path.join(sd, f)) < RECENT_S]
        except Exception:
            continue
    return out


def main():
    root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    ledger = os.path.join(root, ".claude", "session", "token-log.md")
    cands = _candidates(root)
    if not cands:
        return
    try:
        led = open(ledger, encoding="utf-8").read()
    except OSError:
        led = ""
    today = time.strftime("%Y-%m-%d")
    req_fams = set(re.findall(
        rf"\[{today}[^\]]*\] LAUNCH .*?model-requested=\(?(?:def-pin )?([a-z]+)", led))
    new_lines = []
    for f in cands:
        run_id = os.path.basename(f)[:-6]                     # strip .jsonl
        if f"run={run_id}" in led:
            continue                                          # already ledgered
        try:
            txt = open(f, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        models = re.findall(r'"model":"(claude-[a-z0-9.\-]+)"', txt)
        if not models:
            continue
        model = max(set(models), key=models.count)            # majority = the run's engine
        out_tok = sum(int(x) for x in re.findall(r'"output_tokens":\s*(\d+)', txt))
        line = (f"[{today} {time.strftime('%H:%M')}] RUN run={run_id} "
                f"model-actual={model} msgs={len(models)} out-tokens={out_tok}")
        m = re.match(r"claude-([a-z]+)", model)
        if m and req_fams and m.group(1) not in req_fams:
            line += f"  ⚠ MODEL-VERIFY: no LAUNCH today requested '{m.group(1)}'"
        new_lines.append(line)
        led += "\n" + line                                    # dedupe within this same pass
    if new_lines:
        try:
            with open(ledger, "a", encoding="utf-8") as fh:
                fh.write("\n".join(new_lines) + "\n")
        except OSError:
            pass


try:
    main()
except Exception:
    pass  # ledger is an instrument, never a blocker
sys.exit(0)
