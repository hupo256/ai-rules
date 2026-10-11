# prd-to-commit 回放基准

用真实上线过的需求，衡量 [prd-to-commit](../usage.md) 的每个版本：用当时的 PRD 和代码起点重跑一遍，再由独立评分员按固定检查点打分，并与历史首轮交付对比。**改 skill 之后，必须用这里的基准回放验证**，规则见 [版本记录](../releases.md)。

## 目录

```
replay/
├── PR-xxxxx.md      评分标准（每个基准一份）
├── results/         历次回放与实跑的结果记录（YYYY-MM-DD-<基准>-<版本>.md）
└── tools/           回放工具链与 bench.json（代码起点、PRD 快照、范围）
```

逐轮的得分、耗时和 token 汇总在 [iteration-ledger.md](../iteration-ledger.md)。`results/` 只保留有单独分析价值的结果。

## 基准

| 基准 | 需求 | 规模 | 历史首轮 | 历史成本 |
|---|---|---|---|---|
| [PR-02306](./PR-02306.md) | 注册登录等流程密码规则修改 | 小，web，约 6 文件 | 5/7 | 73M token / 活跃 3.4h |
| [PR-02022](./PR-02022.md) | 合约跟单新增引导页 | 小中，web，约 14 文件 | 10/12 | 未统计 |
| [PR-02265](./PR-02265.md) | 外部做市商合约账户负手续费率 | 中，三端，11–13 文件 | 8/14 | 90M / 3.4h |
| [PR-02273](./PR-02273.md) | 增强体验金改为保证金模式 | 中，web+admin，约 29 文件 | 10/14 | 215M / 10.6h |
| [PR-02172](./PR-02172.md) | 登录注册增加 TG / Facebook | 中，web+legacy，23–25 文件 | 11/14 | 未统计 |
| [PR-01930](./PR-01930.md) | 体验金手动失效管理 | 大，4 个工程，约 40 文件 | 10/15 | 208M / 12.4h |

每份评分标准包含：

- **C 系列检查点**：来自 PRD 原文和提测 bug 统计表，分「必中 / 提出即算」等级别，并标注历史首轮是否做到。
- **T 系列陷阱**：历史上真实踩过、或回放中复现过的错误，违反即扣分。

## 运行一次回放

```bash
T=~/.ai-rules/labs/prd-to-commit/replay/tools
$T/prepare.sh PR-02306 R7-02306        # 按 bench.json 建 worktree，复制 PRD 快照，生成 /tmp/p2c-bench/<RUN>.prompt
# 把 prompt 交给执行方：Claude 子 agent，或 Codex 用 $T/codex-run.sh R7-02306
$T/score-prompt.sh PR-02306 R7-02306   # 生成评分 prompt，交给另一个独立会话评分
python3 $T/run-cost.py R7-02306        # 从会话转录统计 token 与墙钟
```

- 回放会跳过「用户确认一次」这一步。真实使用时用户会回答待确认，效果通常好于回放分数。
- 回放 worktree 建在 `~/github/<RUN>`，过程文件在 `~/.prd-cache/<RUN>/`，用完要清理。
- 新增基准时：在 `bench.json` 登记 `base`、`prd`、`scope`；新建 `PR-xxxxx.md`，写清 PRD 版本、代码起点、历史首轮与最终提交、历史成本，以及 C/T 表；最后在上方表格加一行。

## 结果记录

| 日期 | 基准 | 版本 | 文件 |
|---|---|---|---|
| 2026-10-09 | PR-02306 | v0.1 | [results/2026-10-09-PR-02306-v0.1.md](./results/2026-10-09-PR-02306-v0.1.md) |
| 2026-10-09 | PR-01930 | v0.2 | [results/2026-10-09-PR-01930-v0.2.md](./results/2026-10-09-PR-01930-v0.2.md) |
| 2026-10-10 | PR-01930 | v0.3 | [results/2026-10-10-PR-01930-v0.3.md](./results/2026-10-10-PR-01930-v0.3.md) |
| 2026-10-10 | PR-01930 | v1.0 | [results/2026-10-10-PR-01930-v1.0.md](./results/2026-10-10-PR-01930-v1.0.md) |
| 2026-10-10 | PR-02306 | v1.0（Codex） | [results/2026-10-10-PR-02306-v1.0-codex.md](./results/2026-10-10-PR-02306-v1.0-codex.md) |
| 2026-10-10 | PR-02208 | 真实运行（非回放） | [results/2026-10-10-PR-02208-live-run.md](./results/2026-10-10-PR-02208-live-run.md) |
| 2026-10-11 | 6 个基准 | v1.0.1 → v1.1 | 逐轮数据见 [iteration-ledger.md](../iteration-ledger.md)，汇总见[最终报告](../reports/2026-10-11-final-report.md) |
