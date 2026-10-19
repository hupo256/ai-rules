# prd-to-commit 交接（2026-10-19，v1.6 已放行）

> 当前没有进行中的迭代。v1.6 已打 tag `prd-to-commit-v1.6`，结论见 [reports/2026-10-19-final-report.md](./reports/2026-10-19-final-report.md)。

## 现状

- skill：`~/.ai-rules/skills/prd-to-commit/`，SKILL.md 138 行、18432 字节（= 上限，再加规则先压缩）。
- 回放基准 11 个（`replay/PR-*.md`、`replay/tools/bench.json`、PRD 快照 `~/.prd-cache/REPLAY-<号>/`）。v1.6 成绩 139/148，陷阱 0；逐轮数据在 [iteration-ledger.md](./iteration-ledger.md) R11–R19。
- 回放 worktree 已全部清理；提交保留在 fameex-web 的 `replay/R*` 分支上（只在本地，未 push）。
- 过程文件留在 `~/.prd-cache/R1x-<号>/`、`~/.prd-cache/_bench/`，可删。

## 下一步

1. 用 v1.6 跑真实新需求，按观察期要求记录提测缺陷分类与 stats 数据。
2. 观察清单（[releases.md](./releases.md)）里的条目再出现一次且能回放复现，就立规则；改完回放受影响的基准再发版。

## 跑回放的要点（下次迭代用）

- 生成任务：`replay/tools/prepare.sh PR-<号> <RUN> <端口偏移>` → 用 Opus agent 执行 `~/.prd-cache/_bench/<RUN>.prompt`；评分：`replay/tools/score-prompt.sh PR-<号> <RUN>` → 用 Sonnet agent；成本：`python3 -I replay/tools/agent-cost.py <RUN>`。
- 并发：一次 4 个回放，dev server 全机上限 4（`~/.config/prd-to-commit/dev/max-dev`），内存看门狗 `~/.prd-cache/_bench/mem-watchdog.sh`。
- 中断续跑的结果不作放行依据；冷读与浏览器结果已落盘，续跑时读 `coldread-N.md`、`browser-roundN.md`。
- 暂停时：先停回放 agent，再用 ListAgents 停仍在跑的浏览器子 agent，然后 `dev.mjs stop`（带对应 `P2C_PORT_OFFSET`），最后 `pgrep -fl "next dev|chrome-headless"` 确认为 0。
- 工作文件不要放 /tmp（重启会清空）。
