#!/usr/bin/env python3
"""SubagentStop — per-run ledger: requested vs VERIFIED model + tokens (owner, 2026-07-08).

Closes three observability gaps in one mechanism:
  1. requested != verified model — LAUNCH lines are written by the lead at spawn
     (model-requested); this hook writes the RUN line from the agent's own transcript
     (model-actual = ground truth, the '"model":"claude-…"' fields of its assistant turns).
  2. per-run token detail — out-tokens summed from the transcript's usage records.
  3. INPUT/context burn (owner, 2026-07-17: "agents jump to 150-200k while the lead
     would spend half") — first-in (spawn cost), peak-ctx (max context any API call
     re-billed), calls (API-call count; every call re-sends the whole context).
     peak-ctx > CTX_BURN_LIMIT stamps '⚠ CTX-BURN' — grounding gulps or unbatched
     turn-churn; the packet doctrine (strategy/12) or the brief was violated.

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

# Fallback scan window. A finished agent is ledgered by the NEXT hook event (its
# own SubagentStop sees a <60s-fresh file and defers) — with a short window the
# session's LAST agent was lost across a session gap. Run-id dedupe makes a wide
# window safe; SessionStart also runs this hook to sweep the previous session.
RECENT_S = 86400
CTX_BURN_LIMIT = 120_000  # peak context above this = burn defect (measured norm: 60-90k)


def _usage_stats(txt):
    """(first_in, peak_ctx, calls, out_tok) from a JSONL transcript's usage records.

    Input cost of an API call = input + cache_creation + cache_read tokens (the whole
    context is re-sent every call; cache discounts price, not context size)."""
    first_in, peak, calls, out = None, 0, 0, 0
    for line in txt.splitlines():
        try:
            obj = json.loads(line)
        except Exception:
            continue
        msg = obj.get("message")
        u = (msg.get("usage") if isinstance(msg, dict) else None) or obj.get("usage")
        if not isinstance(u, dict):
            continue
        tot_in = (u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                  + u.get("cache_read_input_tokens", 0))
        if tot_in:
            calls += 1
            if first_in is None:
                first_in = tot_in
            peak = max(peak, tot_in)
        out += u.get("output_tokens", 0) or 0
    return first_in or 0, peak, calls, out


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
            # Window: recent enough to be this stop's run, but SETTLED (>60s quiet) —
            # an in-flight sibling's transcript must not be ledgered mid-run (the
            # run-id dedupe would freeze a partial record).
            out += [os.path.join(sd, f) for f in os.listdir(sd)
                    if f.startswith("agent-") and f.endswith(".jsonl")
                    and 60 < now - os.path.getmtime(os.path.join(sd, f)) < RECENT_S]
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
        first_in, peak_ctx, calls, out_tok = _usage_stats(txt)
        line = (f"[{today} {time.strftime('%H:%M')}] RUN run={run_id} "
                f"model-actual={model} calls={calls} first-in={first_in} "
                f"peak-ctx={peak_ctx} out-tokens={out_tok}")
        if peak_ctx > CTX_BURN_LIMIT:
            line += f"  ⚠ CTX-BURN: peak {peak_ctx} > {CTX_BURN_LIMIT} — audit the brief/packet"
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
