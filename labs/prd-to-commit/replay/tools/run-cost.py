#!/usr/bin/env python3
"""统计一次回放（RUN-ID）在 Claude 子 agent 转录里的 token 与墙钟：
主执行 agent = 首条用户消息含 RUN-ID 的子 agent；其下层子 agent（冷读、编码、Explore）= 首条消息含 RUN-ID 或 ~/.prd-cache/RUN-ID 路径的子 agent。
usage: run-cost.py <RUN-ID> [<RUN-ID> ...]"""
import glob, json, os, re, sys

def usage_of(path):
    seen, tok, ts, first = set(), 0, [], ''
    for line in open(path):
        try: e = json.loads(line)
        except Exception: continue
        if e.get('timestamp'): ts.append(e['timestamp'])
        if not first and e.get('type') == 'user':
            c = e['message']['content']; first = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
        m = e.get('message') or {}; u = m.get('usage'); mid = m.get('id')
        if u and mid and mid not in seen:
            seen.add(mid)
            tok += sum(u.get(k, 0) for k in ('input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'))
    return tok, sorted(ts), first, len(seen)

files = glob.glob(os.path.expanduser('~/.claude/projects/**/subagents/*.jsonl'), recursive=True)
for run in sys.argv[1:]:
    pat = re.compile(re.escape(run) + r'(?![\w-])')
    rows = []
    for f in files:
        tok, ts, first, calls = usage_of(f)
        if ts and pat.search(first) and 'score.prompt' not in first:
            rows.append((ts[0], ts[-1], tok, calls))
    if not rows: print(f'{run}: no transcripts'); continue
    start = min(r[0] for r in rows); end = max(r[1] for r in rows)
    from datetime import datetime
    mins = (datetime.fromisoformat(end.replace('Z', '+00:00')) - datetime.fromisoformat(start.replace('Z', '+00:00'))).total_seconds() / 60
    print(f'{run}: agents={len(rows)} tokens={sum(r[2] for r in rows)/1e6:.1f}M calls={sum(r[3] for r in rows)} wall={mins:.0f}min')
