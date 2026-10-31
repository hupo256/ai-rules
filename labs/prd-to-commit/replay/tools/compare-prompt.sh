#!/bin/zsh
# 生成「我们的实跑 vs 同事分支」人工对照提示：usage: compare-prompt.sh <ID> <OUR-SHA> <origin 分支名，不带 origin/> [<REV 目录名，默认取最新 r*>]
# 输出 $HOME/.prd-cache/_runs/<ID>.compare.prompt；交给一个只读子 agent（Opus）执行，结果写到 ~/.prd-cache/<ID>/human-compare.md
set -e
ID=$1; OURS=$2; BRANCH=$3; T=$(dirname $0); REPO=$HOME/github/fameex-web
[ -z "$BRANCH" ] && { echo "usage: compare-prompt.sh <ID> <OUR-SHA> <branch> [<rev-dir>]"; exit 1 }
REV=${4:-$(ls -d $HOME/.prd-cache/$ID/r[0-9]* | sort -t r -k2 -n | tail -1 | xargs basename)}
git -C $REPO fetch -q origin $BRANCH
TIP=$(git -C $REPO rev-parse --short origin/$BRANCH)
BASE=$(git -C $HOME/github/$ID merge-base HEAD origin/online | cut -c1-10)
mkdir -p $HOME/.prd-cache/_runs
sed -e "s#{{ID}}#$ID#g" -e "s#{{OURS}}#$OURS#g" -e "s#{{BRANCH}}#$BRANCH#g" -e "s#{{TIP}}#$TIP#g" -e "s#{{REV}}#$REV#g" -e "s#{{BASE}}#$BASE#g" $T/compare.tpl > $HOME/.prd-cache/_runs/$ID.compare.prompt
echo $HOME/.prd-cache/_runs/$ID.compare.prompt
