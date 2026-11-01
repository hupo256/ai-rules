# Web 前端项目的 AI 编程配置最佳实践（基于《Claude Code 第二阶段 8 个问题》+ 本仓库现状）

> 文章笔记见 [2026-11-01-claude-code-stage2-8-problems.md](./2026-11-01-claude-code-stage2-8-problems.md)。这里只写「对 React/TypeScript monorepo（如 fameex-web）怎么做」，每条都对照了我们现在的配置（`~/.ai-rules`、`~/.claude/skills`、fameex-web 的 CLAUDE.md/AGENTS.md/.cursor/rules），分「已做到 / 要改 / 不适用」。

## 0. 一句话原则

**每一层只回答一个问题；一句话复制到另一个项目还成立就放全局，不成立放项目，偶尔用才做 Skill，只管本轮就写进对话。** 工具（MCP/图谱/检索）给的是线索，不是结论，回源确认才算验证。

## 1. 四层分工：前端项目各层该放什么

| 层 | 回答的问题 | 前端项目放什么 | 不该放什么 | 我们的现状 |
|---|---|---|---|---|
| 全局规则（`~/.ai-rules/AGENT.md` → CLAUDE.md） | 任何项目都成立的硬规则 | 命名输入类型、禁 `any`、i18n key 字面量、schema 即契约、不编造字段、React Query/Zustand 分工、.tsx ≤300 行、缺值显示 `--`、验证经济（不每改一次就跑全量）、git 权限边界 | 某个仓库的目录名、测试命令、模块边界 | ✅ 4.9K、≤7K 自律线，内容全是跨项目成立的；但「FameEX」字样出现在路由段落——它是**路由指针**（去读哪个文件），不是项目事实，可以留 |
| 项目事实（仓库 `CLAUDE.md` / `AGENTS.md` / `.cursor/rules`） | 这个仓库怎么跑、哪里不能碰 | 包管理器与版本、各 app 的 dev/test 命令、工程归属（web vs web-next vs legacy）、i18n 只改 zh-CN、MSW 基建、禁用 `git stash`、提交规范 | 可复用的工作流（拉 PRD→清单→冷读）、个人习惯 | ⚠️ fameex-web：CLAUDE.md 5.6K + AGENTS.md 13.5K + 79 条 `.cursor/rules/*.mdc`。要查三件事：两份入职手册有没有重复/冲突；79 条 mdc 是否都是「按主题命中」（文件名前缀 async-/bundle-/client- 看起来是），常驻的只能是 `001-guidelines`；我们 fameex.md 里「长期应沉淀进 AGENTS.md」的条目该搬了（工程归属、React 19 运行时坑、legacy i18n） |
| 任务流程（Skill） | 遇到某类任务按什么顺序做 | prd-to-commit（需求→提交）、coding-quality（数据 UI/表单/状态）、change-scoping（集合操作）、figma-read（Figma 取值） | 项目事实（已通过 `references/fameex.md` 隔离，正确做法）、每次都要的硬规则 | ✅ 4 个 Skill 都有「什么时候读」的 description；prd-to-commit v1.7 起 SKILL.md 只留骨架、细则按阶段 references 按需加载，正是文章说的「偶尔用的流程不要常驻」 |
| 本轮边界（当前对话 / `--append-system-prompt`） | 这一轮只许做什么 | 「只改 apps/web」「直接做、绕开登录」「不 push」「并发端口偏移」 | 项目知识、流程 | ✅ 实跑模板 `run-prompt.tpl` / 回放 `prompt.tpl` 就是这一层；没用 `--append-system-prompt`，不需要（settings.json 无 systemPrompt 覆盖，`--system-prompt` 替换式的坑我们没踩） |

**要改（1）（已执行，见 §8：按用户要求放个人本地而非团队仓库）**：把 `references/fameex.md` 里的项目事实独立成文（工程归属判据、React 19 运行时坑、legacy i18n 空白、后台菜单登记）。理由：它们是**项目事实**，别的 Agent（Codex、Cursor）和同事也该看到，不该只住在一个 Skill 的 references 里。搬完 fameex.md 只留「skill 流程特有」的坑（MSW 回放公平性、浏览器 spec 技巧）。

## 2. Skill：发现 → 路由 → 执行，每层可检查

- **description 写三件事**：触发场景（什么任务）、边界（覆盖什么）、不适用（什么别用）。前端例子：
  - 好：`Use when writing data-request UI, loading/empty/error states, controlled form hooks… Do not use for pure styling tweaks.`（coding-quality 现状接近）
  - 差：`前端代码质量检查清单`。
- **执行层可自检**：Skill 里引用的脚本路径、命令、MCP 名在当前机器必须存在。prd-to-commit 的 `$S/…mjs` 全是绝对路径 + `node --check`，browser.mjs 会报「找不到 playwright」而不是静默——这是对的。
- **排障顺序**：显式 `/skill` 调一次 → 看 description → 才怀疑模型。我们已有的证据：R20–R23 五次回放里执行方都按阶段读到了 references，说明「阶段入口强制指针」这种路由写法有效。
- **唯一真源**：`~/.claude/skills/*` 与 `~/.codex/skills/*` 都软链到 `~/.ai-rules/skills/`，权威只有一份——正确。但有两处杂质要清：
  - `~/.claude/skills/tailwind-cleanup.md`：裸文件不是 Skill 目录，永远不会被路由到，要么做成 `tailwind-cleanup/SKILL.md`，要么删掉。
  - `~/.claude/skills/synced/<bucket>/…`：claude.ai 同步下来的 Anthropic 官方 Skill 副本（docs/pdf/pptx/…），属于「只读订阅」；别在里面改，也别和自己的同名。
  - `~/.codex/skills/lark-read` 只在 Codex 侧有：确认是否该进 `~/.ai-rules/skills/` 统一管理，否则两边会漂移。
- **Skill 数量**：保持个位数。判断一个 Skill 该不该存在：能不能一句话说出触发条件、输入、验收方式。

**要改（2）**：清理 `tailwind-cleanup.md`、统一 `lark-read` 的归属。

## 3. 项目事实 vs 工作流：前端最容易混的四处

| 内容 | 正确归属 | 常见错放 |
|---|---|---|
| `pnpm 12.14.0`、`dev.mjs start --site web` 的端口 | 项目事实（AGENTS.md / browser-sites.json） | 写进全局规则 → 换仓库带着跑 |
| 「只改 zh-CN，其他语种由 Tolgee 拉」 | 项目事实 | 写进 Skill 正文 → 其他仓库也只改 zh-CN 了 |
| 「清单一行一个页面、同因搜索、冷读独立子 agent」 | Skill | 写进 CLAUDE.md → 每轮对话都加载，改一个按钮也背着 18K 流程 |
| 「本轮不 push、绕开登录、端口偏移 100」 | 当前对话 | 写进 Skill → 下个需求莫名其妙也绕开登录 |

我们现在的分界线基本对（SKILL 骨架 / references/fameex.md 项目坑 / run-prompt.tpl 本轮边界）。唯一的灰区是 fameex.md，见「要改（1）」。

## 4. MCP 与外部工具：前端场景下的「四步排障」

前端项目真正高价值的外部工具就三类：**设计稿（Figma）**、**需求与文档（Lark）**、**浏览器（Playwright）**。我们的做法和文章一致，而且更保守：
- Figma、Lark 通过 claude.ai 连接器/`lark-cli` 使用，`~/.claude.json` 里没有自装 MCP（`mcpServers` 为空）——没有「接 20 个 MCP 等它自己选」的问题。
- **路由靠任务点名**，不靠「必须」：prd-to-commit 在 §1 写「`node $S/fetch-prd.mjs <ID> <url>`」，figma-read 写「Use before implementing UI from Figma」；这就是文章说的「任务里给出调用理由」。
- **返回即线索**：Figma 取值后要在浏览器里对照原图，Lark 拉的 PRD 要逐张看图，lark-cli 拉的 bug 表要对照代码——都已经是「回源确认」。

**要做（3）**：写一个前端版 `doctor` 脚本（见 §7），把「skill 目录、软链是否断、CLAUDE/AGENTS 体积、mdc 条数、playwright/lark-cli/pnpm 在不在、dev server 残留」一次筛掉。

## 5. 代码图谱 / 检索：前端 monorepo 什么时候值得

- 文章的判据：跨模块调用多、同名符号多、Agent 反复翻源码的仓库才值得接图谱；小仓库人工读目录更快。
- fameex-web 的特征：4 个 app + packages，同名组件/常量多（`PASSWORD`、`passwordPattern` 在两处）、legacy Vue2 与 Next 并存。**我们用的替代方案是「同因搜索」+ Explore 子 agent 返回落点地图**（文件:行 + ≤3 行片段），成本 ≤12% token（成本分析报告），已经起到「缩小范围、回源读」的作用。
- 结论：现阶段不接图谱类 MCP。若以后接，三条规矩照搬：查索引时间与分支 → 只用来缩范围 → 写操作前看测试与调用方。
- 同理，**浏览器验证的 mock 不能自证契约**（v1.9 规则 C）就是前端版的「索引不是真相」。

## 6. 跨 Agent 复用：核心层 + 适配层

- 核心层（可复用）：清单规则、冷读提示词、同因搜索、验收口径——prd-to-commit 的 `references/checklist-rules.md`、`coldread-prompt.md` 就是。
- 适配层（按宿主）：Claude 用 `Agent` 工具派子 agent、Codex 用子代理或新会话；沙箱里 `.git` 只读要 `git bundle`；Codex 不能监听端口要编排方起 dev server——这些已经写在 SKILL §7/§9 和 browser.md §6，但**散在各处**。
- **要改（4）**：把宿主差异收拢成 `references/hosts.md`（Claude / Codex / Cursor 各一小节：派发方式、权限与确认、端口与沙箱、结果回传），SKILL 里只留「宿主差异见 hosts.md」。这样换 Agent 时只改一个文件。

## 7. 前端版 doctor 脚本（只读体检）

`~/.ai-rules/scripts/agent-doctor.sh`（已实现），检查并只打印、不修改：
1. Skill 层：`~/.claude/skills`、`~/.codex/skills`、`<repo>/.claude/skills` 下每个 `SKILL.md`；软链目标是否存在；同名 Skill 出现在几处（>1 报重复）；裸 `.md` 文件（不会被路由）。
2. 项目事实层：`CLAUDE.md`、`AGENTS.md` 字节数（>12K 提示拆分）、`.cursor/rules/*.mdc` 条数与 `alwaysApply: true` 的条数（常驻的应 ≤3）。
3. 全局层：`~/.ai-rules/AGENT.md` ≤7K（已有 `check-resident.mjs`）。
4. 工具层：`claude --version`、`claude mcp list`、`command -v pnpm node lark-cli`、`pnpm --version` 是否等于仓库 `packageManager`、playwright 在不在 worktree、`~/.config/prd-to-commit/dev/*.json` 有没有残留 dev server。
5. 输出一行一项 `ok | warn | missing`，脚本正常仍不触发时，回到 description 和任务描述查路由。

## 8. 对照清单（现状 → 动作）——2026-11-01 已执行

| # | 动作 | 理由（文章条目） | 结果 |
|---|---|---|---|
| 1 | fameex.md 中的项目事实独立成文 | §3 四层分工 | ✅（调整）用户要求**不改团队仓库**：先在 fameex-web 分支做了一版后撤回（分支与 worktree 已删，从未 push），改放个人本地 `~/.ai-rules/rules/fameex/`——`where-new-work-goes.md`（web / web-next / 独立应用判据、后台两套与菜单登记、web-next 规范要点、契约输入、pnpm 12 / Biome / git stash / vitest 等环境事实）+ 4 个主题文件（`react19-runtime-pitfalls`、`legacy-admin-vue2`、`i18n-locale-rules`、`activity-landing-and-app-webview`），由 `rules/fameex-local.md` 按改动区域路由，Claude 与 Codex 都生效。fameex.md 13.9K → 7.3K，只留流程特有项 |
| 2 | 清理裸文件 / 统一 lark-read | §2 唯一真源、§1 执行层 | ✅ `tailwind-cleanup.md` 做成 `~/.ai-rules/skills/tailwind-cleanup/SKILL.md`（description 补了触发与不适用场景），软链进 `~/.claude/skills` 与 `~/.codex/skills`；`~/.codex/skills/lark-read` 是空 TODO 模板，已删 |
| 3 | `scripts/agent-doctor.sh` 只读体检 | 附录脚本 | ✅ 四层各一段，输出 ok/warn/missing。首跑即筛出真问题：`.cursor/rules/async-api-routes.mdc` 既无 globs 也不常驻（永远不会命中）→ 已补 globs |
| 4 | prd-to-commit `references/hosts.md` | §6 核心层/适配层 | ✅ Claude / Codex / Cursor 的派发、冷读、端口、提交、权限、规则加载、stats、回放各一行；SKILL 表加指针 |
| 5 | 审 CLAUDE.md vs AGENTS.md | §3 职责清楚 | ✅ 发现：CLAUDE.md 写「tests 在 `__tests__/`」vs AGENTS「co-locate」；CLAUDE.md 写 ESLint/Prettier 而实际是 Biome；末尾「Always use Context7 MCP」是对未安装工具的硬性要求（文章 §5 反例）；apps 列表缺 web-next / business-system；`.cursor/rules/async-api-routes.mdc` 无 globs 永不命中。**团队文件不改**，这些写进个人 `where-new-work-goes.md`「环境与工具事实」作为纠偏说明。`.cursor/rules` 83 条，常驻仅 2，合理 |
| 6 | 不接代码图谱 MCP | §7 | 不动 |
| 7 | 不用 `--append-system-prompt` 替代 Skill | §4 | 不动 |

体检脚本用法：`~/.ai-rules/scripts/agent-doctor.sh [<repo>]`。

## 9. 和文章不同的地方（我们的经验补充）

- 文章讲「Skill 不触发先查链路」；我们多一层证据：**路由到了也要验证规则被执行**——R20–R23 回放让执行方报告「读了哪些 references、在哪一步」，并用回放基准（陷阱 T）证明规则生效。只看「读到了」不够，还要看「做到了」。
- 文章讲「工具返回是线索」；前端里更隐蔽的是**自己的 mock 也是线索**：浏览器 spec 全过，不等于字段名对、不等于后端会接受。这条我们已经写成规则。
- 文章讲「同名 Skill 三处抢话」；我们遇到的另一种「抢话」是**系统注入的上下文**（git 状态、看板摘要）点名了无关需求，污染了统计归属——把「只看任务提示和工具输入」写进了 stats.mjs。
