#!/usr/bin/env python3
"""列出一次回放的每个 agent：token、调用数、最大上下文、首条消息摘要（主执行 agent + 它派出的转写/Explore/编码/冷读/浏览器子 agent）。
usage: agent-cost.py <RUN-ID> [<RUN-ID> ...]"""
import glob, json, os, re, sys

for run in sys.argv[1:]:
    pat = re.compile(re.escape(run) + r'(?![\w-])')
    rows = []
    for f in glob.glob(os.path.expanduser('~/.claude/projects/**/subagents/*.jsonl'), recursive=True):
        seen, tok, mx, first, ts = set(), 0, 0, '', []
        for line in open(f):
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get('timestamp'):
                ts.append(e['timestamp'])
            if not first and e.get('type') == 'user':
                c = e['message']['content']
                first = c if isinstance(c, str) else json.dumps(c, ensure_ascii=False)
            m = e.get('message') or {}
            u, mid = m.get('usage'), m.get('id')
            if u and mid and mid not in seen:
                seen.add(mid)
                ctx = u.get('input_tokens', 0) + u.get('cache_creation_input_tokens', 0) + u.get('cache_read_input_tokens', 0)
                tok += ctx + u.get('output_tokens', 0)
                mx = max(mx, ctx)
        if pat.search(first) and 'score.prompt' not in first:
            rows.append((min(ts) if ts else '', tok, len(seen), mx, re.sub(r'\s+', ' ', first)[:90]))
    print(f'== {run}')
    for t0, tok, calls, mx, first in sorted(rows):
        print(f'{t0[11:16]} {tok/1e6:6.1f}M calls={calls:4d} maxctx={mx/1e3:4.0f}K  {first}')
    print(f'total {sum(r[1] for r in rows)/1e6:.1f}M')
