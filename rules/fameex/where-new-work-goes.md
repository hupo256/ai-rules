> 何时读：在 fameex-web 开始任何新页面/新功能、或改一个在多个工程都有实现的业务之前。
> 个人本地规则（不进 fameex-web 仓库），由 `~/.ai-rules/rules/fameex-local.md` 路由。仓库 `AGENTS.md`/`CLAUDE.md` 仍是团队事实来源，这里只补它们没写、而真实需求反复踩过的部分。

# 新工作落在哪个工程

- C 端同一业务可能同时存在于 `apps/web`（Next）与 `apps/web-next`（Vite + TanStack Start + Effect）。**先定目标工程再找落点**，判据：
  1. 近 2 个月提交数：`git log --since=2.months origin/online -- apps/web/src/<模块> apps/web-next/src/<模块>`（2026-10：合约、活动落地页、Prediction 的新页在 web-next；资产、现货/资金流水、帮助中心仍在 web）；
  2. 首页入口链接指向哪个工程；
  3. 同模块远端在途分支改的是哪边。
  定不了就问人，并在交付说明首行写明依据（PR-01549、02634、02012 三次与同事选的不同）。
- 独立系统有先例 `apps/business-system`（TanStack Start + antd，自带会话/签名/Docker）。PRD 写「独立系统/新站点」时，「独立应用 vs 内嵌」先确认再动手；新工程要补被替代页面的存量交互（排序、成功提示、百分比格式、筛空后清空列表），内嵌复用要验被复用组件在新场景的边缘态。
- web-next 编码规范以 `apps/web-next/.agents/skills/coding-standards/SKILL.md` 为准：一接口一 endpoint 文件注册到 `<Scope>HttpApi.ts`；hooks 一接口一文件；列表响应用 `ResilientArray`；新增路由要起一次 dev 生成并提交 `src/routeTree.gen.ts`；没有路由级登录守卫（`ssr: false` + `useCurrentUserInfo().isInitialDataResolved`）；页面默认强制暗色（`staticData: { forceDarkTheme: false }` 跟随主题）；Header 带下拉的一级项固定走 legacyHref。
- 后台页面有 Next 与 Vue2 legacy 两套：新页面跟随同一菜单分组的兄弟页面；菜单由后端 `/operate-api/menus` 下发，照兄弟页面登记 `routes`/`siderItems`/`contentSettings`/权限点，禁止注入 menus 返回。细节见 `legacy-admin-vue2.md`。
- 同一后端的接口已在 `apps/web` 对接时，`apps/web/src/services/api/*`、`src/types/*` 可作为 web-next 新页的契约输入（只取契约，不复用旧 UI）。

# 环境与工具事实（仓库文档未写或已过时）

- `packageManager` 是 pnpm 12.14.0（原生二进制）；corepack 0.34/0.36 起不来时 `corepack disable pnpm && npm i -g pnpm@12.14.0`，再 `pnpm install`。（仓库 AGENTS.md 仍写 `corepack enable`。）
- 格式化/lint 实际是 Biome（lint-staged 跑 `biome check --write`）；仓库 CLAUDE.md 还写 ESLint/Prettier、测试在 `__tests__/`——以 AGENTS.md 的「co-locate `*.test.ts(x)`」为准。
- 仓库 CLAUDE.md 末尾「Always use Context7 MCP」：本机没装 Context7，忽略即可，不要为此停下。
- 找图标先把 `packages/icon/output/icon.json` 的全部名字（约 314 个）列出来按形状挑，不要只按语义词搜（时钟类是 `history`、`hourglass`，没有叫 clock 的）。
- 根 `vitest.workspace.ts` 把 `@` 指向 `apps/web/src`；自带 `vitest.config` 的 app（admin、futures-admin、security-admin、web-next）在各自目录用其配置跑。
- 不用 `git stash`：所有 worktree 共用一个 stash 栈。对比改动前后用 `git show HEAD:<file>` 或临时 worktree。
- lint-staged 对整份暂存文件跑 biome：存量 lint 问题会拦下提交，只修被拦的几处；biome 格式化可能把存量 tsc 错误挪到改动行上，先 `git show <base>:<file>` 对照确认是否存量。
- `.cursor/rules/async-api-routes.mdc` 没有 globs 也不常驻，Cursor 永远不会命中它；改 API 路由 / Server Actions 时手动读一下（尽早启动互不依赖的 await）。
