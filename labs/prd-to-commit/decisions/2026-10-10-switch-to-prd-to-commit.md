# 决策：新需求改用 prd-to-commit，冻结 docs_tdd（2026-10-10）

> 状态：已执行（commit `e460b8f`） · 取代：[2026-09-28 切换到 Web Lite](./2026-09-28-switch-to-web-lite.md)

## 背景

[2026-10-09 现状审计](../reports/2026-10-09-status-audit.md)对 docs_tdd 和 auto_pilot 做了统计，取样 4 个已上线项目和全部会话转录：

- 两套系统约一半 token 花在「证明自己按流程做了」上。规则和门禁越加越多，上下文越长，于是更慢、更容易漏，又引出更多规则。
- 真正的漏项发生在「需求条目 → 具体页面/文件落点」这一步，没有机制逐条核对。
- docs_tdd 的版本记录停在 v3.5.0；CHANGELOG 宣称的效率和准确率指标没有实测数据。

## 决策

1. FameEX Web 新需求统一走 skill `prd-to-commit`（`~/.ai-rules/skills/prd-to-commit/`）。流程是：落盘 PRD → 需求清单（原句对应到落点）→ plan 依赖分批 → 用户确认一次 → worktree → 编码 → 改动检查 → 独立冷读 → commit。
2. docs_tdd 引擎冻结在 v3.5.0，只用于收尾 `workflowVersion: 1|2` 的存量项目；Web Lite 废弃。
3. 全局 Claude/Codex 配置里的 docs_tdd hook 移除。
4. skill 的改动必须经回放验证；加规则的门槛是同类问题出现 2 次，并且能在回放中复现。

## 依据

- 回放 PR-02306：质量 7/7（历史首轮 5/7），3.5M token（历史 73M）。
- 回放 PR-01930：质量 10/15（与历史持平），22M token（历史 208M）。
- 两次真实运行（PR-02208、PR-02463），细节见[正式化评估](../reports/2026-10-10-readiness.md)。

## 后果

- 新需求不再创建 `prds/<ID>/` 项目目录、状态 JSON 或证据套件；过程文件落在 `~/.prd-cache/<ID>/`。
- `common/` 下的规则、引擎和模板只为存量项目和 lark-bot 保留，不再扩展。
- 版本与后续演进见 [prd-to-commit 版本记录](../releases.md)。2026-10-11 发布的 v1.1 在 6 个回放基准上达标。
- 观察期：接下来 5 个真实需求，记录提测缺陷分类和 stats 数据。
