#!/bin/zsh
# usage: prepare.sh <BENCH-ID> <RUN-ID> [<PORT-OFFSET>]  → 建 worktree、复制 PRD 快照、生成 prompt 到 $HOME/.prd-cache/_bench/<RUN>.prompt
# PORT-OFFSET：并发回放各给一个不同的偏移（如 100/200/300），dev server 与浏览器 spec 用 port+偏移，互不抢端口
set -e
BENCH=$1; RUN=$2; OFFSET=${3:-0}; T=$(dirname $0)
BASE=$(python3 -c "import json;print(json.load(open('$T/bench.json'))['$BENCH']['base'])")
PRD=$(python3 -c "import json,os;print(os.path.expanduser(json.load(open('$T/bench.json'))['$BENCH']['prd']))")
SCOPE=$(python3 -c "import json;print(json.load(open('$T/bench.json'))['$BENCH']['scope'])")
node ~/.ai-rules/skills/prd-to-commit/scripts/worktree.mjs $RUN --branch replay/$RUN --base $BASE | tail -2
mkdir -p ~/.prd-cache/$RUN && cp -R $PRD ~/.prd-cache/$RUN/
NEWPRD=~/.prd-cache/$RUN/$(basename $PRD)
mkdir -p $HOME/.prd-cache/_bench
python3 - "$T/prompt.tpl" "$HOME/.prd-cache/_bench/$RUN.prompt" <<PY
import sys
s=open(sys.argv[1]).read().replace('{{RUN}}','$RUN').replace('{{PRD}}','$NEWPRD').replace('{{BASE}}','$BASE').replace('{{SCOPE}}','''$SCOPE''').replace('{{OFFSET}}','$OFFSET')
open(sys.argv[2],'w').write(s)
PY
echo "prompt: $HOME/.prd-cache/_bench/$RUN.prompt"
