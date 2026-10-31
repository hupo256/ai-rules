# prd-to-commit 交接（2026-10-31，v1.8-rc）

> v1.7 已发布并推送（tag `prd-to-commit-v1.7`）。v1.8 已发布（tag `prd-to-commit-v1.8`），依据 [plans/2026-10-31-v1.8-plan.md](./plans/2026-10-31-v1.8-plan.md)；PR-01723 / PR-02374 仍只在本地，待用户 push/建 MR 后提测。
> 旧状态（v1.6.2）：v1.6 已打 tag `prd-to-commit-v1.6`，结论见 [reports/2026-10-19-final-report.md](./reports/2026-10-19-final-report.md)；v1.6.1、v1.6.2 是正式使用前的两轮工具加固（[releases.md](./releases.md)），审查发现的工具缺陷已全部处理。

## 现状

- 接入：`~/.claude/skills/prd-to-commit` 与 `~/.codex/skills/prd-to-commit` 都已软链（2026-10-09 起）；tag v1.0–v1.6.2 已推到 GitHub。接入方法与注意事项见仓库根 [README.md](../../README.md)。
- skill：`~/.ai-rules/skills/prd-to-commit/`，SKILL.md 约 11.7K（v1.7-rc 起只放骨架与硬规则；细则在 `references/checklist-rules.md`、`delegation.md`、`coldread-prompt.md`、`browser.md`、`fameex.md`，每条规则只在一处，上限 18.4K 仍保留）。
- 回放基准 11 个（`replay/PR-*.md`、`replay/tools/bench.json`、PRD 快照 `~/.prd-cache/REPLAY-<号>/`）。v1.6 成绩 139/148，陷阱 0；逐轮数据在 [iteration-ledger.md](./iteration-ledger.md) R11–R19。
- 回放 worktree 与 fameex-web 本地 `replay/R*` 分支（45 个，从未 push）已全部删除；回放代码不再保留，成绩与失分分析以台账和 results 为准。
- 过程文件留在 `~/.prd-cache/R1x-<号>/`、`~/.prd-cache/_bench/`，可删。

## 下一步

0. PR-01723 / PR-02374 由用户 push/建 MR 提测；QA 后 `node $S/bugs.mjs <ID>` 拉 bug，归类进 real-runs（S8）。新实跑用 `node $S/launch.mjs <ID> <url> --mode direct --offset <n>` 一条命令准备，再派 Opus agent 读生成的 prompt。提测后用 `node $S/bugs.mjs <ID>` 拉 QA bug。
1. 用 v1.8 跑真实新需求，按观察期要求记录提测缺陷分类与 stats 数据。进度 8/5（已超额，可开始评估立规则）：10-30 晚又并行跑了 5 个（PR-01549 fe0a53ec36、PR-02634 a0bd7bfd07、PR-02012 fbfc9564c2、PR-02127 ce4a626dc5、PR-02254 6f60259329，均 `feature/<ID>-p2c` 本地分支），其中 3 个做了人工对照，见 [real-runs/2026-10-30-batch5.md](./real-runs/2026-10-30-batch5.md)；此前：PR-02418（10-29，只经手不提测，`feature/PR-02418-p2c` c1808e5747）、PR-01723（10-30，`feature/PR-01723` 5e5e216795）、PR-02374（10-30，`feature/PR-02374` 0dc80fc294）；数据见 [real-runs/](./real-runs/)。三个都只在本地，未 push；PR-01723、PR-02374 提测后补录缺陷分类。候选需求来源：前端看板（见 `~/.prd-cache/_real-run-candidates.md`）。下一个需求开始前先 `git ls-remote origin 'feature/<ID>*'` 确认远端干净。
2. 观察清单（[releases.md](./releases.md)）里的条目再出现一次且能回放复现，就立规则；改完回放受影响的基准再发版。

## 跑回放的要点（下次迭代用）

- 生成任务：`replay/tools/prepare.sh PR-<号> <RUN> <端口偏移>` → 用 Opus agent 执行 `~/.prd-cache/_bench/<RUN>.prompt`；评分：`replay/tools/score-prompt.sh PR-<号> <RUN>` → 用 Sonnet agent；成本：`python3 -I replay/tools/agent-cost.py <RUN>`。
- 并发：一次 4 个回放，dev server 全机上限 4（`~/.config/prd-to-commit/dev/max-dev`），内存看门狗 `~/.prd-cache/_bench/mem-watchdog.sh`。
- 中断续跑的结果不作放行依据；冷读与浏览器结果已落盘，续跑时读 `coldread-N.md`、`browser-roundN.md`。
- 暂停时：先停回放 agent，再用 ListAgents 停仍在跑的浏览器子 agent，然后 `dev.mjs stop`（带对应 `P2C_PORT_OFFSET`），最后 `pgrep -fl "next dev|chrome-headless"` 确认为 0。
- 工作文件不要放 /tmp（重启会清空）。
