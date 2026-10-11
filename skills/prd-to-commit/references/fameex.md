# FameEX 仓库已知坑（按需读）

只在碰到相关改动时读。每一条都来自真实运行。长期应沉淀进 fameex-web 的 `AGENTS.md` / `.cursor/rules`。

## 工程归属
- 后台页面有两套：Next（`apps/admin/src`、`apps/futures-admin/src`）和 Vue2 legacy（`apps/*/legacy-admin`）。新页面跟随同一菜单分组的兄弟页面放（PR-02208）。改既有页面时，两套都要搜（PR-01930 C13/C15）。
- 后台菜单由后端 `/operate-api/menus` 下发。新页面要**照兄弟页面一样登记** `routes`、`siderItems`（兜底与登录后跳转都依赖它）、`contentSettings`、权限点；同时在交付说明里提醒后端登记菜单。禁止的是篡改/注入 menus 接口返回数据（PR-02208 历史实现的 `injectXxxMenu`）。
- legacy-admin 不在 biome 和 tsc 的覆盖范围内。check.mjs 只能做语法检查，模板要靠浏览器或人工核对。在 legacy 里删除/改名方法或变量后，必须全仓 grep 残留引用（包括模板里的 `@click`/插值），没有 tsc 兜底（PR-02265 R3：validateForm 调用已删方法，保存直接报错）。

## i18n
- Web 只改 zh-CN（`AGENTS.md:31`）。
- 新增只有 zh-CN 的命名空间时，要登记到 `ZH_CN_SOURCE_ONLY_NAMESPACES`，否则其他语种加载会报错（PR-02463）。
- 文案带 `& / <` 等符号又走插值时，会被 i18next 转义；能写死就写死，否则传 `interpolation: { escapeValue: false }`（PR-02306）。

## MSW（接口未就绪时写全 UI/UX）
- 何时用、用多少见 SKILL §5：接口没上 dev 时自行决定，只 mock 本需求的新接口，fixture 最小化。
- **接入现状**：`origin/online` 及各环境分支都还没有 MSW；完整接入只在 `feature/PR-02463`（apps/web）。app 未接入时，参照该分支在**单独一个提交**里补齐：`package.json` 加 devDependency `msw` 和脚本 `"msw:init": "msw init public/ --save=false"`（同步 pnpm-lock）；`src/mocks/browser.ts`（`setupWorker(...各功能 handlers)`）；`src/mocks/useMockWorker.ts`（仅 `NODE_ENV==='development' && NEXT_PUBLIC_ENABLE_MSW==='true'` 时动态 import 并 `worker.start({ onUnhandledRequest: 'bypass' })`，就绪后 `invalidateQueries`）；在 `[lang]/Providers.tsx` 调用 `useMockWorker(queryClient)`；以及下面三条。`public/mockServiceWorker.js` 由 `msw:init` 生成、已 gitignore，不提交。可直接 `git show feature/PR-02463:<路径>` 取原文。
- 每个需求只新增 `src/mocks/<功能>/{handlers,fixtures}.ts` 并在 `browser.ts` 登记；联调完成删掉该目录和登记行。
- MSW 的 `mockServiceWorker.js` 要加进 proxy 的 `LOCALE_BYPASS_PATTERNS`，否则会被语言重定向拦掉，mock 不生效（PR-02463）。
- 要在 `useServiceWorkerRegistration` 里放行 mockServiceWorker，不然会被当成 PWA 的 SW 注销掉。
- 开关只认 `NODE_ENV==='development' && NEXT_PUBLIC_ENABLE_MSW==='true'`，新环境变量要登记到 turbo.json 的 globalEnv。
- 浏览器验证（登录态、mock、写保护、截图）统一走 `references/browser.md` 的 `dev.mjs` + `browser.mjs`，不再手写假 token。

## 测试
- 根 `vitest.workspace.ts` 把 `@` 指向 apps/web/src。check.mjs 会给 admin 等 app 的测试生成临时配置，自己手动跑时要注意这一点（PR-01930 v4）。

- biome 格式化可能把存量 tsc 错误挪到「改动行」上，让 check.mjs 报失败。先确认是否存量（`git show <BASE>:<file>` 对照），是存量就做最小修复或在交付说明里注明（PR-02265 两次复现）。

## git
- 不用 `git stash`，所有 worktree 共用 stash。
- lint-staged 会对整份暂存文件跑 biome。改动文件里如果有存量 lint 问题，会把提交拦下，只修被拦的那几处，不要扩大改动。
