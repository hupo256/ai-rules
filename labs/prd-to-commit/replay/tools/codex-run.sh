#!/bin/zsh
# usage: codex-run.sh <RUN-ID>  — 用受限沙箱跑 Codex 回放；写权限只开 worktree、该 RUN 的 prd-cache、fameex-web 的 .git
RUN=$1
# 注意：Codex 的 workspace-write 沙箱固定把 .git 设为只读，执行方提交不了；按提示让它把提交打 bundle 到 /tmp/p2c-bench/$RUN.bundle，由编排方 fetch 回来
WR="[\"/Users/aven/.prd-cache/$RUN\",\"/Users/aven/github/fameex-web/.git\"]"
cd ~/github/$RUN && codex exec -s workspace-write -c "sandbox_workspace_write.writable_roots=$WR" -C ~/github/$RUN \
  -o /tmp/p2c-bench/$RUN.codex-last.txt "$(cat /tmp/p2c-bench/$RUN.prompt)" > /tmp/p2c-bench/$RUN.log 2>&1
echo "exit $?"
