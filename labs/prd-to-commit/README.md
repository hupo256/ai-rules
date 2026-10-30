# prd-to-commit 研发资产

skill 本体在 [`~/.ai-rules/skills/prd-to-commit/`](../../skills/prd-to-commit/SKILL.md)。本目录放维护 skill 用的资产，不被 skill 运行时读取：

| 位置 | 内容 |
|---|---|
| [replay/](./replay/README.md) | 回放基准（评分标准）、历次结果与回放工具链 |
| [releases.md](./releases.md) | 发版台账：每个 tag 改了什么、为什么、凭什么放行 |
| [iteration-ledger.md](./iteration-ledger.md) | 逐轮回放的得分、耗时、token |
| [real-runs/](./real-runs/) | 真实需求实跑数据（观察期）：时间线、成本、冷读/浏览器发现归类、偏离 skill 的点 |
| [usage.md](./usage.md) | 给人看的使用说明与预期效果 |
| [reports/](./reports/) | 某一时点的评估与报告，写成后不再改 |
| [decisions/](./decisions/README.md) | 新需求默认流程的决策记录 |

## 改 skill 的纪律

1. 门槛：同类问题出现 2 次，并且能在回放中复现，才改。
2. 改完用 [replay/](./replay/README.md) 回放受影响的基准；得分不低于上一版、陷阱零违反才放行，没有改善就撤回。
3. 按 [releases.md](./releases.md) 的纪律发版：打 tag `prd-to-commit-vX.Y[.Z]`，在 releases.md 记一节，在 iteration-ledger.md 记回放结果；推送 main 时 tag 一起推（`git push origin 'refs/tags/prd-to-commit-v*'`；2026-10-20 起 v1.0–v1.6.1 已全部推到远端）。

## 来历

2026-10-11 从 docs_tdd（`~/github/docs_tdd`，已冻结、只读）迁入：`benchmarks/replay/` → `replay/`，`docs/prd-to-commit/*` → 本目录，`docs/decisions/` 中与新需求默认流程相关的两份决策 → `decisions/`。docs_tdd 自身历史（v2 切换、lark-bot 拆仓）留在原仓库。
