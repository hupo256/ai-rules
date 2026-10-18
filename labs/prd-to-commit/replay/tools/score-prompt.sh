#!/bin/zsh
# usage: score-prompt.sh <BENCH-ID> <RUN-ID>  → $HOME/.prd-cache/_bench/<RUN>.score.prompt
T=$(dirname $0); BENCH=$1; RUN=$2
BASE=$(python3 -c "import json;print(json.load(open('$T/bench.json'))['$BENCH']['base'])")
RUBRIC=$(cd $T/.. && pwd)/$BENCH.md
sed -e "s#{{RUBRIC}}#$RUBRIC#" -e "s#{{RUN}}#$RUN#g" -e "s#{{BASE}}#$BASE#g" -e "s#{{OUT}}#$HOME/.prd-cache/_bench/$RUN.out#" $T/score.tpl > $HOME/.prd-cache/_bench/$RUN.score.prompt
echo $HOME/.prd-cache/_bench/$RUN.score.prompt
