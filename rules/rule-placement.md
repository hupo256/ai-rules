# 规则放哪里（个人规则本地优先）

> 从已退役的 docs_tdd `common/rules/rule-inheritance.md` §0 提炼（2026-11-05）。改任何规则载体前读。

## 先定生效范围
| 层 | 放什么 | 载体 |
|---|---|---|
| L1 全局 | 与任何仓库无关的编码硬手艺 | `~/.ai-rules/AGENT.md`（常驻，≤7K）+ `~/.ai-rules/skills/*`；`~/.claude`、`~/.codex` 只以软链消费 |
| L2 仓库（团队） | 已由团队接受、带 FameEX 锚点的规则 | 仓库 `AGENTS.md`、`.cursor/rules/*.mdc` |
| 个人 FameEX 事实 | 团队文件没写或已过时、只服务你本人 Agent 的项目事实 | `~/.ai-rules/rules/fameex/*.md`，由 `rules/fameex-local.md` 路由 |
| 流程 | 需求→提交的流程、门禁、清单 | `prd-to-commit` skill（SKILL 骨架 + references） |

口诀：纯编码手艺 → L1；带 FameEX 锚点的项目事实 → 个人 `rules/fameex/`（团队认可后才进 L2）；流程 → skill。**同一条规则只落一处**，其余处放指针。

## 个人规则本地优先（高于分层）
1. 仓库 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/*.mdc`、`.husky/`、`package.json`、CI 配置和业务源码都是**团队影响面**：只读取、遵守，不主动写入个人规则。
2. 只有用户明确要求沉淀为团队规范、且确认过提交边界，才把规则提升进仓库；之前在个人载体试运行。
3. 不用改 `.gitignore` 或 `skip-worktree` 隐藏受跟踪文件里的个人改动——会造成本地与团队不可见的漂移。
4. 写规则前先 `git ls-files <path>`：受跟踪文件默认不写。
