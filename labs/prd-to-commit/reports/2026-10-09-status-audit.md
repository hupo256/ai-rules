# docs_tdd / auto_pilot 现状审计（2026-10-09）

> 数据来源：两仓 git log 与文件统计、4 个上线项目（PR-01947/02265/02306/01930）的项目文档与 fameex-web 提交、Claude/Codex 全部会话转录（统计脚本 `/tmp/token_audit.py`，结果 `/tmp/token_report.txt`）。只读审计，未改动任何系统文件。

## 0. 一句话结论

两套系统都把成本花在"证明自己按流程做了"上，而真正的漏项发生在"需求条目 → 具体页面/文件落点"这一步，没有任何机制逐条核对它。规则/门禁越加越多 → 上下文越长 → 越慢、越容易漏 → 再加规则，形成闭环。
另外：这 4 个"小需求"的账单里，有相当比例是在这些项目的会话/worktree 里迭代系统本身、查状态、合分支。

---

## 1. 规模现状

### docs_tdd

| 部分 | 规模 |
|---|---|
| common/engine（agent-scripts 64 + lib 117，其中 vnext-* 42） | 4.1 万行 js |
| common/lark-bot | 1.3 万行 js |
| common/rules | 35 篇 / 314KB / 162 个规则 ID |
| plan + practice-log + output-tdd | 约 1.9 万行 md（大量"完成报告"） |
| prds/（16 个项目） | 61MB |

- 424 个提交；9/20 之后 92 个（+48.5K / −15.7K 行）。
- `VERSION` 和 CHANGELOG 停在 v3.5.0；v4.0/v4.1/Web Lite 没有版本记录；`CONTEXT.md` 停在 9/16。
- CHANGELOG v3.5.0 声称"准确率 +30%、遗漏率 −80%、Token −60%"，**没有实测数据**。

### auto_pilot

| 部分 | 规模 |
|---|---|
| src | 6428 行（workflow.ts 1196、reports.ts 1074） |
| tests | 5934 行 |
| 门禁 | 约 327 处 `throw new Error`（reports.ts 87 处，Figma 约 40 处） |
| CLI | 23 个命令 |
| 提交 | 41 个（9/28–10/05） |

---

## 2. 真实效果

### 2.1 四个上线项目

| 项目 | 净改动（合入 online 的 merge diff） | 文档 | 周期 | 提测后漏项 | 主因 |
|---|---|---|---|---|---|
| PR-01947 | 77 文件 +4621/−2432（web 为主 + futures-admin） | 48 文件/3483 行 | 49 天 | 5 | 清单降级、假设字段当完成、落点没对照 PRD 页面名、多入口漏一个 |
| PR-02265 | 26 文件 +533/−116（三端） | 80 文件/4541 行 | 20 天 | 4 漏 + 6 轮口径返工 | 触点被打包成一行、PRD 漂移、后端语义晚定 |
| PR-02306 | 18 文件 +419/−193（web） | 72 文件/5088 行 | 10 天 | 3 漏 + 3 缺陷 | 清单写了 4 个页面，实现只改了注册页；门禁一天全绿 |
| PR-01930 | 52 文件 +2234/−133（admin 为主） | 85 文件/4840 行 | 44 天 | 3 漏 + 4 联动 + 5 理解错 | 误判"划删"、typeItems 第 3 份拷贝没搜到 |

修正认知：
- 只有 PR-02306 是真正的小需求。另外三个跨 admin/futures-admin/web，改动量是中等。
- PR-02265、PR-01930 是在 G6 FAIL、G7 跳过的情况下上线的；PR-02306 的 G2 通过时，scope 文档还是模板占位。

### 2.2 漏项根因（共性）

1. **大多数漏项在清单里已经出现**，被打包、降级或误判后，没落到代码上。"清单条目 → 落点文件"这一步没有逐条核对。
2. **同因没搜全**：多份拷贝、多个入口、多语言文件只改了一部分（01930 typeItems、01947 hideCloseButton、02306 en-US/zh-TW）。
3. **门禁验的是文档结构**、tsc、自写契约，不验"PRD 原句 → 页面行为"。
4. **后端口径晚定**带来的返工，任何前端流程都解决不了，只能尽早暴露、提问。

### 2.3 auto_pilot 运行

- `.autopilot/runs/` 共 11 次真实运行：CLI complete 4 个，可提测 1 个（PR-01506）。
- 01504、02209 最后是人工提交的，CLI 账本与 git 脱节。
- PR-01502：submit 被拒 11 次，全是报告格式和 Figma 门禁，0 次功能问题；门禁全过后视觉还原自评约 60%。
- 活动耗时中位数：api 33 分钟、waiting 29 分钟、coding 18 分钟。瓶颈在外部依赖。
- 9/30 的 `76a6792` 写明"门禁随事故增长，这正是旧系统死掉的方式"，删了一批；第二天 `225c9aa` 又加了 2843 行。

---

## 3. Token 与时间去向

| 项目 | 会话 | 活跃 | 总 token | 平均每次调用上下文 |
|---|---|---|---|---|
| PR-01947 | 57 | 19.8h | 268M | 109k |
| PR-01930 | 34 | 12.4h | 209M | 113k |
| PR-02265 | 6 | 3.4h | 90M | 131k |
| PR-02306 | 10 | 3.4h | 73M | 121k |

- **输出 token 只占约 0.4%**。成本来自每回合重发约 11–13 万上下文：规则和流程输出一旦读进来，之后每回合都要再付一次。
- 读规则、跑流程脚本、写项目文档，占 01947/02265/02306 约 46–53% 的 token。流程脚本输出占全部工具输出字符的 53%。
- 按会话首条消息分类（全部 PR 项目）：开发 38%，**查状态/续跑/探活 36.5%**，系统迭代 10%，合分支 7%。
- PR-02306 的 10 个会话里几乎没有开发会话（改系统 3、合分支 3、"hi" 3）。PR-01947 有 12 个以上会话是在它的 worktree 里迭代 docs_tdd。
- 启动基线持续上涨：Codex 首次调用中位数从 20k（W29–36）涨到 28k（W38–40），p90 约 85k。Claude 在第一次改业务代码前，已经花掉会话 49% 的 token。

---

## 4. 为什么慢、为什么不按规则执行

### 4.1 每次操作都在付流程税（已核实）

`~/.claude/settings.json`（Codex 的 `~/.codex/hooks.json` 同样配置）对**所有仓库**生效：

| 事件 | 执行 |
|---|---|
| SessionStart / UserPromptSubmit / PreCompact | `rule-context-hook.mjs`（每次注入 5.8–11.4KB） |
| PreToolUse 和 PostToolUse：Edit/Write/Bash | `rule-context-hook.mjs` |
| PostToolUse：Edit/Write | `claude-posttooluse-gate.mjs` → `verify-code-rules.mjs`（953 行） |

- posttool gate 有 278 条记录，**全部是 pass，issues-found 为 0**：几乎没拦住过问题，却每次编辑都要跑。
- Web Lite（9/28）只改了文档入口（+190/−323），**引擎、hook、lint-staged 的 v2 commit guard 一行没删**。

### 4.2 常驻规则多源且互相冲突

- 常驻和必读约 50K 字符（约 25–35K token）：全局 AGENT.md、MEMORY、fameex-web 的 AGENTS.md（14K）和 CLAUDE.md、docs_tdd 的 AGENTS 和 router、web-lite。
- 冲突示例：
  - rule-router 禁止新需求跑 G0–G8，但全局 `AGENT.md:54-56` 仍要求 `docs-tdd.mjs context/changed/gate/doctor`；`:28` 讲证据套件；`:50` 讲 delivery gate。
  - 全局规则要求只检查改动文件，fameex-web 的 `CLAUDE.md:110` 要求全仓 `pnpm lint`/`type-check`。
  - fameex-web 的 `AGENTS.md` 写 Prettier/ESLint，实际用的是 Biome。
- 模型要花推理去调和冲突，调和结果因模型、因会话而异，于是看起来像"不按规则执行"。

### 4.3 决策没有基准

- v4-lite 只有 1 个样本，而且该功能早已实现，Full 基线是估算的。
- real-demand-pilot：合格样本 0 个，token 全记为 null。
- auto_pilot 的试跑大量用已上线需求（02306、01507），属于噪音。
- 每版"好没好"都靠感觉。

---

## 5. 资产盘点：保留 / 归档

### 保留（可直接复用）

| 能力 | 位置 |
|---|---|
| Lark PRD 拉取 + 图片下载 + revision | `auto_pilot/src/prd/source.ts`；`docs_tdd/common/engine/agent-scripts/sync-lark-docs.mjs`、`lib/lark-prd-drift.mjs` |
| worktree 建立 / 核验 / 恢复 | `auto_pilot/src/worktree/git.ts`；`docs_tdd/.../prepare-coding-worktree.mjs` |
| 精确暂存提交 | `auto_pilot/src/delivery/commit.ts` |
| tsc/eslint 报错摘要 | `auto_pilot/src/core/checks.ts` |
| 计时遥测 | `auto_pilot/src/core/timing.ts`、`metrics.ts` |
| Figma 读取 | `figma-spec.mjs` |
| L1 编码短规则 | `~/.ai-rules/AGENT.md`（需删 docs-tdd 引用）、coding-quality、change-scoping |
| 独立冷读 | v3.1 实测 27 条发现只有 1 条误报，是唯一被证明有效的质检机制 |
| lark-bot | 真实在用，单独评估，不在本次精简范围 |

### 归档 / 下线

- 全局 6 个 docs_tdd hook（Claude + Codex）。
- fameex-web lint-staged 里的 v2 commit guard（`precommit-verify-code-rules.mjs`）。
- vnext-* 引擎、receipt/trace/change-set、gate G0–G8、doc-budget/rule-release 等"治理规则的规则"。
- plan/、practice-log/、output-tdd/ 移入 archive。
- auto_pilot 的报告 schema、convergence、token-mapping/Figma 原子审计、assign。

---

## 6. 回放评测集素材

| 项目 | base commit | 标准答案 merge（`git diff M^1 M`） | 首轮 PRD revision | 必中检查点（摘要） |
|---|---|---|---|---|
| PR-02306 | 2738fb1f5d | 2d73b36734（最终提交 ff9ae36da2） | rev298 | 重置密码/修改密码页规则清单；"至少1个数字"（rev354）；en-US/zh-TW 文案；BindGoogle 验证已有密码时不套强校验；特殊符号不转义 |
| PR-02265 | 445876e97f | 10b3b56a96 | rev1009 | 合约后台资产-流水查询触点；F08–F13 即时生效 + 蓝框文案；成交记录真金手续费；deductionFee 可空 |
| PR-01930 | 2d9e77ca29 | 830327da03 | rev4103 | 合约账户-资金流水（非划删）；web 账单筛选 114（第 3 份 typeItems）；支出折合-来源明细 |
| PR-01947 | a86ceacb52 | d20109bfc8 | rev3703 | 有持仓禁改保证金/杠杆；杠杆范围由后端下发；F20/F21 落点在"跟单者管理"页；跟单广场入口 hideCloseButton |

注意：
- inbox 里存的是**最新** revision，首轮原文需从 Lark 历史或 docs_tdd 的 git 历史里取（如 02306 用 `ae2bf8d`）。
- 标准 diff 要剔除 lockfile、MSW、测试、混入的 PR-02015 文件，以及后端改口径导致的变更；后端原因的问题不计入扣分。
- 01930 的 phase1 回放产物结论有误，`prds/PR-02306/phase*` 实为 01930 的文件，都不能当标准答案。
- 建议先用 **02306（小，单 web）+ 01930（admin，同因搜索）** 两个做首轮，评测成本最低。

评分：触点召回率（PRD 触点 → 文件落点）、必中检查点命中数、文案逐字一致、token、活跃时长。

---

## 7. 建议路线（按性价比排序）

1. **先止血（半天，收益最大、风险最低）**
   - 把全局 6 个 docs_tdd hook 从 Claude 和 Codex 配置中移除，或限定只对存量 v1/v2 项目目录生效。
   - 删除全局 AGENT.md 第 9、28、50、54–56 行的 docs-tdd 流程引用。
   - 修正 fameex-web 的 CLAUDE.md 全仓 lint 要求，以及 AGENTS.md 中 Prettier/ESLint 的过时描述（如属团队文件，需评估）。
   - lint-staged 的 v2 commit guard：确认对其他人无影响后移除。
   - 预期：每次编辑和每条消息都不再起 node 进程、不再注入规则，常驻上下文降到约 15–20K token。
2. **冻结两套系统**：不再迭代；存量 v1/v2 项目按原样收尾；plan/practice-log/output-tdd 归档。
3. **极简内核（≤200 行）**：一个 skill，加上从上表"保留"里抽出的 3 个脚本（拉 PRD、建 worktree、改动文件检查）。流程：
   - 拉 PRD 落盘（一次）。
   - 写清单：每条 PRD 原句 → Web 判定 → **具体页面/文件落点**。
   - 人看一眼清单（30 秒）。
   - 编码。
   - 改动文件检查。
   - **独立子 agent 冷读**：只给 PRD 和 diff；逐条找到 diff 落点，每条做一次同因全仓搜索（拷贝、入口、语言文件）。
   - 修复（最多 2 轮），然后 commit。
4. **回放验证**：先在 02306、01930 上用极简内核回放，与上表必中检查点和历史 token 对比；数据达标再上真实新需求。
5. **纪律**：规则总量设上限，新增一条要删一条；同类错误出现 2 次且能在回放里复现，才可以写成规则；不在业务项目会话里迭代系统；后端口径不明时当场提问，不靠流程兜底。
