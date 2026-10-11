# FameEX 仓库已知坑（按需读）

只在碰到相关改动时读。每一条都来自真实运行。长期应沉淀进 fameex-web 的 `AGENTS.md` / `.cursor/rules`。

## 工程归属
- 后台页面有两套：Next（`apps/admin/src`、`apps/futures-admin/src`）和 Vue2 legacy（`apps/*/legacy-admin`）。新页面跟随同一菜单分组的兄弟页面放（PR-02208）。改既有页面时，两套都要搜（PR-01930 C13/C15）。
- 后台菜单由后端 `/operate-api/menus` 下发。新页面要**照兄弟页面一样登记** `routes`、`siderItems`（兜底与登录后跳转都依赖它）、`contentSettings`、权限点；同时在交付说明里提醒后端登记菜单。禁止的是篡改/注入 menus 接口返回数据（PR-02208 历史实现的 `injectXxxMenu`）。
- legacy-admin 不在 biome 和 tsc 的覆盖范围内。check.mjs 只能做语法检查，模板要靠浏览器或人工核对。在 legacy 里删除/改名方法或变量后，必须全仓 grep 残留引用（包括模板里的 `@click`/插值），没有 tsc 兜底（PR-02265 R3：validateForm 调用已删方法，保存直接报错）。

## web-next（apps/web-next，Vite + TanStack Start + Effect）
- 编码规范以 `apps/web-next/.agents/skills/coding-standards/SKILL.md` 为准（按其路由读 references），先读 `src/platform/domain/AGENTS.md`、`src/services/hooks/README.md`：一接口一 endpoint 文件，注册到 `<Scope>HttpApi.ts` 的 group；hooks 一接口一文件，失效用 `queryKey: [descriptor.key]`；列表响应用 `ResilientArray` 逐行容错。
- 新增路由后插件才会生成 `src/routeTree.gen.ts`：用 `dev.mjs start --site web-next` 起一次再 stop，并把路由树一起提交（check.mjs 会核对，PR-01507）。
- 没有路由级登录守卫（SSR 拿不到登录态）：需登录页用 `ssr: false` + 页内 `useCurrentUserInfo().isInitialDataResolved` 判定后跳 `useAuthNavigationUrl('/login')`。
- 页面默认强制暗色，跟随用户主题要写 `staticData: { forceDarkTheme: false }`。
- i18n 新命名空间登记 `src/i18n/core/namespaces.ts` + `src/i18n/i18next.d.ts`；只写 zh-CN 可行（其他语种由 tolgee 拉取，缺 key 时显示 `ns:key`）；`t(($) => $.a.b)` selector 写法。route loader 读文案用 `hasI18nResource` 判空，`loadI18nResource` 缺语种会 throw。
- 没有 MSW：自测数据态写在浏览器 spec 的 mocks 里。
- Header：带下拉的一级项顶层触发器固定走 legacyHref（`MainNavigation.tsx`），只有子项和无下拉项按 `kind` 走 SPA；改成 SPA 的链接，组件测试照 `main-header/test/MainNavigation.test.tsx` mock `@tanstack/react-router` 的 `Link`。
- 资产页、现货/资金账户流水、帮助中心都还在 apps/web（legacy）：需求涉及这些宿主页而用户限定 web-next 时，标「不做（宿主在 apps/web）」并列待确认。
- 已对接同一后端的接口，apps/web 的 `src/services/api/*`、`src/types/*` 可作为契约输入存 `inputs/`（只取契约，不看旧 UI，PR-01507）。

## i18n
- Web 只改 zh-CN（`AGENTS.md:31`）。
- 新增只有 zh-CN 的命名空间时，要登记到 `ZH_CN_SOURCE_ONLY_NAMESPACES`，否则其他语种加载会报错（PR-02463）。
- 文案带 `& / <` 等符号又走插值时，会被 i18next 转义；能写死就写死，否则传 `interpolation: { escapeValue: false }`（PR-02306）。

## MSW（接口未就绪时写全 UI/UX）
- 何时用、用多少见 SKILL §5：接口没上 dev 时自行决定，只 mock 本需求的新接口，fixture 最小化。
- **基建常驻（apps/web）**：`src/mocks/` 下的 `browser.ts`、`useMockWorker.ts`、`handlers.ts`（登记表）和 `README.md`，加上 `Providers.tsx` 的 `useMockWorker`、proxy 与 SW 注册对 worker 的放行、`msw` 依赖与 `msw:init`、`turbo.json` 的 `NEXT_PUBLIC_ENABLE_MSW`。现在 online 上还没有这套基建：已验证的实现放在本地分支 `feature/msw-infra`（d4e3f12b86，未 push）。**第一个需要 MSW 的真实需求**先 `git cherry-pick d4e3f12b86` 作为单独一个提交带上（不要手抄），基建随该需求合入 online，之后常驻。cherry-pick 前先查 `src/mocks/browser.ts` 是否已存在，已存在说明基建已经进来了，跳过这一步。用法以仓库里的 `src/mocks/README.md` 为准。
- 每个需求只新增 `src/mocks/<功能>/{handlers,fixtures}.ts`，并在 `src/mocks/handlers.ts` 登记一行。接口就绪后**只删这两处**，基建一律保留（以前连基建一起清掉，下个需求又得重接）。
- worktree 里先跑一次 `pnpm --filter @fameex/web msw:init` 生成 worker 文件（已 gitignore）。
- 基建已处理的三个坑（PR-02463 踩过），改动这些文件时别破坏：worker 要在 proxy 的 `LOCALE_BYPASS_PATTERNS` 里放行，否则被语言重定向拦掉；`useServiceWorkerRegistration` 不能把 mockServiceWorker 当 PWA 的 SW 注销；开关只认 `NODE_ENV==='development' && NEXT_PUBLIC_ENABLE_MSW==='true'`，并已登记在 `turbo.json` 的 globalEnv。
- 需要给 apps/admin（Next 后台）用 MSW 时，照 apps/web 的基建另起一个单独提交接入。
- 浏览器验证（登录态、mock、写保护、截图）统一走 `references/browser.md` 的 `dev.mjs` + `browser.mjs`，不再手写假 token。

## 测试
- 根 `vitest.workspace.ts` 把 `@` 指向 apps/web/src。check.mjs 对自带 `vitest.config` 的 app（admin、futures-admin、security-admin、web-next）在 app 目录用其配置跑，其余非 web app 用临时配置改 `@`；自己手动跑时同理（PR-01930 v4、PR-01507）。测试失败时 check.mjs 会在 base 临时 worktree 复跑，base 上同样失败的标 pre-existing（PR-02463、PR-01507 各遇到 2 例存量失败）。

- biome 格式化可能把存量 tsc 错误挪到「改动行」上，让 check.mjs 报失败。先确认是否存量（`git show <BASE>:<file>` 对照），是存量就做最小修复或在交付说明里注明（PR-02265 两次复现）。

## git
- 不用 `git stash`，所有 worktree 共用 stash。
- lint-staged 会对整份暂存文件跑 biome。改动文件里如果有存量 lint 问题，会把提交拦下，只修被拦的那几处，不要扩大改动。
