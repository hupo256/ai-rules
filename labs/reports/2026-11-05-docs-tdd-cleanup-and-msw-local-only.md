# docs_tdd 清理评估 & MSW 只在本地的可行性（2026-11-05）

## 1. docs_tdd 在 fameex-web 中的使用情况

检查范围：`origin/online`（6827f4ce4b）全部受跟踪文件、本地主仓与两个 worktree 的文件系统、lint-staged 配置。

**结论：没有任何功能依赖。** 本地也已不存在 `apps/web/docs_tdd`（10-17 起不再软链）。

| 位置（online） | 内容 | 作者/时间 | 影响 | 处理建议 |
|---|---|---|---|---|
| `package.json` lint-staged 第 3 条 | `sh -c 'f=apps/web/docs_tdd/.../precommit-verify-code-rules.mjs; if [ -f "$f" ]; then node "$f"; fi'` | hurley 10-22 | 文件不存在 → 空操作；每次提交多起一个 shell，可忽略 | 团队文件，不动 |
| `.gitignore:22` | `docs-tdd/` | — | 无 | 不动 |
| `AGENTS.md:30` | 「生成的规划文档放在 `docs-tdd/` 分类下」 | Julian 07-22 | 过时指令，Agent 可能按它往仓里写 `docs-tdd/`（被 gitignore，不会进提交） | 团队文件，不动；个人规则里纠偏（见下） |
| `.cursor/rules/definition-of-done.mdc:9` | 「本地 docs_tdd 项目按对应阶段 gate 执行」 | aven 09-04 | 过时指令 | 你本人写的；改它仍是团队文件，暂不动 |
| `apps/web/src/services/api/copyTrading/follow/{before-follow,save-follow,setting-save}.ts`、`prediction/schemas.ts` | 注释指向 `docs_tdd/PR-xxxxx/...md` | aven 07–09 | 死链注释，无运行影响 | 不动（下次改这些文件时顺手删注释即可） |
| `apps/web-next/.scratch/auth-web-next-migration/{PLAN.md,evidence-latest.json}`、`apps/web-next/docs/page-migration.md` | docs-tdd 收尾记录、证据 | aven 09 | 历史记录 | 不动 |

按「fameex-web 原则上不做影响团队的全局改动」：**fameex-web 里不需要、也不建议做任何清理**。如果以后想清，上表 4 处过时指令/死链可以整理成一个团队 MR，由你决定。

## 1b. 个人侧（真正要清理的地方）

| 项 | 现状 | 动作 |
|---|---|---|
| `~/github/docs_tdd`（143M） | 远端 `hupo256/docs-tdd-system`；**本地领先 3 个提交未推**（07b6cee、f62ccd9、ed3650c，都是收尾文档） | 先推这 3 个提交（需你授权）或接受丢弃 → 删本地目录 → GitHub 上可设为 Archived |
| 回放 PRD 快照 `~/.prd-cache/REPLAY-*`（19 个，109M） | 最早来自 docs_tdd；bench.json 只读这里 | docs_tdd 删除后它们是唯一工作副本，且 `~/.prd-cache` 无备份 → 打包一份到外部（如 `~/.ai-rules/labs/prd-to-commit/replay/snapshots.tar.zst` 或网盘） |
| 活跃规则里的引用 | `AGENT.md:34`（「docs_tdd status」）、`rules/fameex-local.md:13`、`rules/fameex-feature-module-layout.md:10`（放置标准链接到 docs_tdd，删后死链）、`skills/prd-to-commit/SKILL.md` description（「存量 docs_tdd v1/v2 项目不用」）、`run-prompt.tpl`/`replay/tools/prompt.tpl` 公平性清单、`README.md` | 改成「已归档」或删除；死链改指向 GitHub 归档地址 |
| 仅溯源注释 | `code-rules.mjs:3`、`check-resident.mjs`、labs 历史、回放基准头部「快照来自 docs_tdd@…」 | 保留（历史事实） |
| `~/.codex/config.toml` | `[projects."/Users/aven/github/docs_tdd"] trusted` | 删这一节 |
| 个人纠偏 | 仓库 `AGENTS.md:30` 仍让 Agent 写 `docs-tdd/` | 在 `rules/fameex/where-new-work-goes.md`「环境与工具事实」加一句：忽略 AGENTS.md 的 docs-tdd 条，过程文件只写 `~/.prd-cache/<ID>/` |

风险：低。唯一不可逆的是删本地目录前那 3 个未推提交和 REPLAY 快照的唯一性，按上表先处理即可。

## 2. MSW 只在本地 dev、不进 test/pre/online

### 现状
- `origin/online` **没有任何 MSW 代码**（无 `src/mocks`、无 msw 依赖）。基建只在本地分支 `feature/msw-infra` 的提交 `d4e3f12b86`。
- 现行规则（SKILL §5、`references/fameex.md`「MSW」节）是：第一个需要 MSW 的需求把 `d4e3f12b86` cherry-pick 进去、随需求合入 online、之后常驻。也就是说**按现行规则，MSW 迟早会进 test/pre/online**——这正是要改的。
- 实际使用：10-30 之后的 9 次实跑与 7 次回放，**全部没用 MSW**（base 无基建，记 not-required），数据态都写在浏览器 spec 的 `mocks` 里，验证效果没有变差。

### 可行性

| 场景 | 不进仓的做法 | 可行性 |
|---|---|---|
| Agent 浏览器验证（prd-to-commit §6） | spec `mocks`（Playwright `page.route`）——已在用 | **100%**，零改动 |
| 人在本地浏览器里点着开发、看各种数据态 | 新增 `browser.mjs open <spec>`：用 spec 的 mocks（含免登录配方）打开一个**有界面的** Chrome 窗口连本地 dev server，不跑步骤、窗口关掉才退出；改代码热更新照常 | **高**（约 30 行；复用现有 mocks 与登录态/免登录逻辑） |
| 同上，但想在自己常用的浏览器里用 MSW | MSW 必须在 `Providers.tsx`（或 `instrumentation-client.ts`，online 已有且受跟踪）挂启动代码、在 `package.json` 加依赖、在 `proxy.ts` 放行 worker——都是受跟踪文件，只能做成「本地脏改动」 | **低**：每个 worktree 都要打补丁、`git add` 容易误带、lockfile 冲突；不推荐 |
| SSR（服务端预取）的数据 | MSW 浏览器版和 `page.route` **都拦不到** | 两种方案一样，不影响选择 |

**结论：可行，推荐「MSW 不进代码，mock 一律写在 spec 里；人要交互时用 `browser.mjs open`」。** 这样 test/pre/online 永远不会出现 mock 代码，也不需要和团队协调依赖。

### 实施步骤
1. `browser.mjs open <spec.mjs> [--site] [--path /zh-CN/xxx]`：headed + spec mocks/auth/strictWrites，导航到 spec 导出的 `startPath`（或 `--path`），挂起直到窗口关闭；在 browser.md §3 写用法。
2. SKILL §5：删掉「自行决定加最小 MSW mock、单独提交基建」一整条，改为「接口未就绪：契约写进 service 层占位，数据态写在 `~/.prd-cache/<ID>/browser-specs/` 的 mocks；需要人工交互看效果时 `browser.mjs open`。不往业务仓提交任何 mock 代码与依赖」。
3. `references/fameex.md`「MSW」节整节替换为上面这句 + 「仓里若出现别人加的 MSW 基建，照常使用，但本流程不新增」；`checklist-rules.md`、`browser.md` 里 MSW 相关句同步；`dev.mjs` 的 `NEXT_PUBLIC_ENABLE_MSW` 重启逻辑保留（无害）或删除。
4. `feature/msw-infra` 分支：保留作参考或删除（它只在本地）。注意主仓当前所在的 `hotfix/msw-infra` 名字像但内容不是 MSW（唯一提交是「CLAUDE.md import AGENTS.md」），不要误删。
5. 回归：用一个有数据态的基准（如 PR-02634 或 PR-02022）回放一次，确认去掉 MSW 规则后得分不降；`browser.mjs open` 手工实测一次。
