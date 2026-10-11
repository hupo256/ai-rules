# 决策记录（prd-to-commit / 新需求默认流程）

只收录**改变新需求默认流程**的决策，按时间排序。每份记录写清背景、决策、依据和后果，并标注被哪份决策取代。2026-10-11 从 docs_tdd 迁入。

| 日期 | 决策 | 状态 |
|---|---|---|
| 2026-09-28 | [新需求切换到 Web Lite](./2026-09-28-switch-to-web-lite.md) | 已被 2026-10-10 取代 |
| 2026-10-10 | [新需求改用 prd-to-commit，冻结 docs_tdd](./2026-10-10-switch-to-prd-to-commit.md) | **现行** |

留在 docs_tdd（已冻结，只读）的 docs_tdd 自身历史决策，索引见 [docs_tdd 决策记录](/Users/aven/github/docs_tdd/docs/decisions/README.md)：

- 2026-09-08 docs_tdd v2 正式切换（只约束存量 v2 项目）。
- 2026-10-11 lark-bot 拆为独立仓库，加修改范围契约（其中第 3 条把 `code-rules.mjs` 抽进本 skill 的 `scripts/`，见 [releases.md](../releases.md)「未发布」）。
