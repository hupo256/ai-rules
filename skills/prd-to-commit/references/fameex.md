# FameEX 仓库已知坑（按需读）

只在碰到相关改动时读。每一条都来自真实运行。长期应沉淀进 fameex-web 的 `AGENTS.md` / `.cursor/rules`。

## 工程归属
- 后台页面有两套：Next（`apps/admin/src`、`apps/futures-admin/src`）和 Vue2 legacy（`apps/*/legacy-admin`）。新页面跟随同一菜单分组的兄弟页面放（PR-02208）。改既有页面时，两套都要搜（PR-01930 C13/C15）。
- 后台菜单由后端 `/operate-api/menus` 下发。新页面要**照兄弟页面一样登记** `routes`、`siderItems`（兜底与登录后跳转都依赖它）、`contentSettings`、权限点；同时在交付说明里提醒后端登记菜单。禁止的是篡改/注入 menus 接口返回数据（PR-02208 历史实现的 `injectXxxMenu`）。
- **C 端目标工程判定**（PR-01549、02634、02012 三次与同事选的不同，是最大风险）：同一业务在 apps/web 与 apps/web-next 都有实现、或 PRD 写「独立系统/新站点」时，先定目标再找落点。判据：① `git log --since=2.months origin/online -- apps/web/src/<模块> apps/web-next/src/<模块>` 比提交数（2026-10：合约 web-next 593 vs web 66，活动页新页也在 web-next；资产/账单/帮助中心仍在 web）；② 首页入口链接指向哪个工程；③ 同模块远端在途分支改的是哪边。独立系统有先例 `apps/business-system`（TanStack Start + antd，自带会话/签名/Docker）——PRD 写「独立系统」时「独立应用 vs 内嵌」列为阻塞问题。定不了就问用户；直接做模式写在交付说明首行。
- **base 已含同需求实现**（preflight 结论「已合入」，PR-02127/02254）：按「复核补缺」做，清单每行先核 base 现状，常见偏差是首轮删掉的列、截断的负值、按钮 disabled 导致提示永不出现。
- legacy-admin 不在 biome 和 tsc 的覆盖范围内。check.mjs 只能做语法检查，模板要靠浏览器或人工核对。在 legacy 里删除/改名方法或变量后，必须全仓 grep 残留引用（包括模板里的 `@click`/插值），没有 tsc 兜底（PR-02265 R3：validateForm 调用已删方法，保存直接报错）。

## web-next（apps/web-next，Vite + TanStack Start + Effect）
- 编码规范以 `apps/web-next/.agents/skills/coding-standards/SKILL.md` 为准（按其路由读 references），先读 `src/platform/domain/AGENTS.md`、`src/services/hooks/README.md`：一接口一 endpoint 文件，注册到 `<Scope>HttpApi.ts` 的 group；hooks 一接口一文件，失效用 `queryKey: [descriptor.key]`；列表响应用 `ResilientArray` 逐行容错。
- 新增路由后插件才会生成 `src/routeTree.gen.ts`：用 `dev.mjs start --site web-next` 起一次再 stop，并把路由树一起提交（check.mjs 会核对，PR-01507）。
- 没有路由级登录守卫（SSR 拿不到登录态）：需登录页用 `ssr: false` + 页内 `useCurrentUserInfo().isInitialDataResolved` 判定后跳 `useAuthNavigationUrl('/login')`。
- 页面默认强制暗色，跟随用户主题要写 `staticData: { forceDarkTheme: false }`。
- i18n 新命名空间登记 `src/i18n/core/namespaces.ts` + `src/i18n/i18next.d.ts`；只写 zh-CN 可行（其他语种由 tolgee 拉取，缺 key 时显示 `ns:key`）；`t(($) => $.a.b)` selector 写法。route loader 读文案用 `hasI18nResource` 判空，`loadI18nResource` 缺语种会 throw。
- 没有 MSW：自测数据态写在浏览器 spec 的 mocks 里。
- App WebView 登录态：web-next 原本没有从 cookie `exchange-token` 读 App token 的能力（同事在 PR-02634 补了 `platform/runtime/browser/appWebViewToken.ts`）；需求要在 App 内打开时先核对目标工程具备这套能力。
- Header：带下拉的一级项顶层触发器固定走 legacyHref（`MainNavigation.tsx`），只有子项和无下拉项按 `kind` 走 SPA；改成 SPA 的链接，组件测试照 `main-header/test/MainNavigation.test.tsx` mock `@tanstack/react-router` 的 `Link`。
- 资产页、现货/资金账户流水、帮助中心都还在 apps/web（legacy）：需求涉及这些宿主页而用户限定 web-next 时，标「不做（宿主在 apps/web）」并列待确认。
- 已对接同一后端的接口，apps/web 的 `src/services/api/*`、`src/types/*` 可作为契约输入存 `inputs/`（只取契约，不看旧 UI，PR-01507）。

## 活动页（交易赛、嘉年华类落地页；PRD 常只写一半）
- 行动按钮（报名/去交易）**未开始与已结束都置灰**：PRD 状态表通常只写「已结束置灰」，QA 会按「未开始不能报名」报 bug（PR-02634 QA 7986；人工对照同样指出）。
- **奖池档位、分配比例等配置：接口返回同类字段（`milestones`、`nextMilestoneGap` 之类）时以接口为准**，PRD 的表只作缺省与校验；写死 PRD 表在测试环境（档位不同）就错（PR-02634 QA 7994）。
- 倒计时跨过开始/结束时间要就地切换阶段，不等后端状态（后端 `activityStatus` 会滞后，PR-02634 QA 7987）；结束弹窗按钮、名次文字要有对比度（QA 8017）。
- App 内打开的能力见下一节。

## App WebView（PRD 写「App 端」「Web/App 两端验收」「App 内打开」时，清单展开这些行）
- 原生导航栏右上角分享：`apps/web/src/utils/bridge.ts` 的 `sendShareContentMessage`（进页即发，让 App 出现分享按钮），`hasAppBridge()` 判 App 内；web-next 同事版在 `utils/appBridge.ts`（showShare / shareContent）。
- 跳出交易/登录再返回要看到最新数据：监听 `focus`、`pageshow`、`visibilitychange` 刷新概览与进度（PR-02634 同事「修复 app 数据不更新」）；只做轮询不够。
- 活动页隐藏客服浮窗：`apps/web/src/utils/initYsf.ts` 的 `hidePages` 登记路径（world-cup 先例）。
- App 内隐藏顶栏：`useHiddenAppBar`（`?hiddenAppBar=` 参数）、`useIsWebView`。

## 口径与错误码
- PRD「通用规则」章节（时间口径、空值、精度）是全局约束，清单按页逐条核对。
- 修改类需求的「总数量」上限：核对是否含已成交/冻结部分，对「部分成交」代入一组数值算一遍（PR-01549 漏加回 `dealtBase`，部分成交单默认值就超限）。
- 错误码文案表 `apps/web/src/i18n/locales/zh-CN/errorCode.json`：写接口（报名、领取、下单、改单）按同业务前缀搜已有码（已报名/未报名/已结束/未开始/会话过期），按码分支；「同下单时的提示」类需求复用下单侧的错误映射，不另写兜底文案（PR-02634、01549）。
- 新增枚举值/审批来源时，搜其他端的解析点与筛选项一起加（PR-02012 审批列表「业务类型：团队配置」漏同步；PR-02374 新增 AGENT_UID 让 web 严格 enum 与 legacy Banner 不认）。

## i18n
- Web 只改 zh-CN（`AGENTS.md:31`）。
- legacy 后台只有 zh_CN 时缺 key 显示空白（不是 key 名），只改 zh_CN 要确认 fallback（PR-02012）。
- **apps/web** 新增只有 zh-CN 的命名空间时，要登记到 `ZH_CN_SOURCE_ONLY_NAMESPACES`，否则其他语种加载会报错（PR-02463）。先 grep 确认这个机制存在；不存在（较旧的代码）就把 key 放进已有命名空间，不新建（R11-01973）。**apps/web-next** 可以新建命名空间（登记 `namespaces.ts` + `i18next.d.ts`，见 web-next 节），两套机制不要互套（R21-01507 曾被这两条绊住）。
- 文案带 `& / <` 等符号又走插值时，会被 i18next 转义；能写死就写死，否则传 `interpolation: { escapeValue: false }`（PR-02306）。

## MSW（接口未就绪时写全 UI/UX）
- 何时用、用多少见 SKILL §5：接口没上 dev 时自行决定，只 mock 本需求的新接口，fixture 最小化。
- **基建常驻（apps/web）**：`src/mocks/` 下的 `browser.ts`、`useMockWorker.ts`、`handlers.ts`（登记表）和 `README.md`，加上 `Providers.tsx` 的 `useMockWorker`、proxy 与 SW 注册对 worker 的放行、`msw` 依赖与 `msw:init`、`turbo.json` 的 `NEXT_PUBLIC_ENABLE_MSW`。现在 online 上还没有这套基建：已验证的实现放在本地分支 `feature/msw-infra`（d4e3f12b86，未 push）。**第一个需要 MSW 的真实需求**先 `git cherry-pick d4e3f12b86` 作为单独一个提交带上（不要手抄），基建随该需求合入 online，之后常驻。cherry-pick 前先查 `src/mocks/browser.ts` 是否已存在，已存在说明基建已经进来了，跳过这一步。用法以仓库里的 `src/mocks/README.md` 为准。
- 每个需求只新增 `src/mocks/<功能>/{handlers,fixtures}.ts`，并在 `src/mocks/handlers.ts` 登记一行。接口就绪后**只删这两处**，基建一律保留（以前连基建一起清掉，下个需求又得重接）。
- worktree 里先跑一次 `pnpm --filter @fameex/web msw:init` 生成 worker 文件（已 gitignore）。
- 基建已处理的三个坑（PR-02463 踩过），改动这些文件时别破坏：worker 要在 proxy 的 `LOCALE_BYPASS_PATTERNS` 里放行，否则被语言重定向拦掉；`useServiceWorkerRegistration` 不能把 mockServiceWorker 当 PWA 的 SW 注销；开关只认 `NODE_ENV==='development' && NEXT_PUBLIC_ENABLE_MSW==='true'`，并已登记在 `turbo.json` 的 globalEnv。
- 需要给 apps/admin（Next 后台）用 MSW 时，照 apps/web 的基建另起一个单独提交接入。
- 浏览器验证（登录态、mock、写保护、截图）统一走 `references/browser.md` 的 `dev.mjs` + `browser.mjs`，不再手写假 token。
- **base 上没有基建、又不能引入非 base 祖先提交**（回放、公平性约束、用户要求只带本需求改动）时：不加 MSW，数据态全部写在浏览器 spec 的 mocks 里，交付说明记 `MSW: not-required（base 无基建）`（PR-01549/02634/02012 三次）。
- 权限 key 未知时用 `null`（不拦截）而不是非法占位：非法占位会让所有用户都没有权限、线上锁死（PR-02254）。

## 测试
- 根 `vitest.workspace.ts` 把 `@` 指向 apps/web/src。check.mjs 对自带 `vitest.config` 的 app（admin、futures-admin、security-admin、web-next）在 app 目录用其配置跑，其余非 web app 用临时配置改 `@`；自己手动跑时同理（PR-01930 v4、PR-01507）。测试失败时 check.mjs 会在 base 临时 worktree 复跑，base 上同样失败的标 pre-existing（PR-02463、PR-01507 各遇到 2 例存量失败）。

- biome 格式化可能把存量 tsc 错误挪到「改动行」上，让 check.mjs 报失败。先确认是否存量（`git show <BASE>:<file>` 对照），是存量就做最小修复或在交付说明里注明（PR-02265 两次复现）。

## 运行时坑（tsc 查不出，浏览器验证才暴露）
- Next 路由参数（`params`、`useParams`、`searchParams`）运行时一律是字符串，即使类型标成 number；和接口返回的数字 id 比较前先 `Number()`（R12/R13-01947：持仓锁定永远不生效）。
- `cn`（tailwind-merge）会把自定义字号类和颜色类当成同组冲突，吞掉其中一个（R13/R14-01947 单选字号丢失）；字号放到内层元素，或用仓内已登记的 token class。
- 被 Server Component（layout/page）import 的 service 文件里不能出现 hooks（`useEffect`/`usePathname`），否则整页 500；hook 拆进单独的 `'use client'` 文件（R12/R13-02006）。
- 手动 `history.replaceState/pushState` 第一个参数要传 `null`，传回 Next 自己的 state 会让 `useSearchParams` 与地址栏不同步（R13/R15-01973）。
- futures-admin legacy 是 vue-cli 3 + webpack4，脚本不支持 `?.` / `??`（加了整个工程编译失败，R15-02265）；两个后台的 Vue 2.5/2.6 模板表达式也不支持。check.mjs 会拦，改用 `&&` 或 `== null`。
- **App Router 实际运行 React 19**（即使 package.json 看着是 18 系）：`findDOMNode` 类库挂载即崩（react-quill → 用 quill@1.3.7 直接包一层，PR-02374 `components/QuillEditor.tsx`）；antd 静态 `message.success()` / `Modal.confirm()` 不渲染，用 `App.useApp()` 或仓内 `@/utils` 的 message（PR-02254）；用 `Form.useFormInstance()` 的组件必须在 `<Form>` 内（PR-02374 CouponInfoView 白屏）。tsc/冷读都看不出，只有浏览器能发现。
- apps/admin 的 `PageSearchTable` 用的是全局单例 `stores/useTableStore`（zustand `create`）：同一页挂两个会互相改分页/总数，触发无限更新整页白屏（R11/R14-01988 手动平账页）。一页有两个列表时，第二个改用独立 `useQuery` + antd Table，或放进 Tabs 并 `destroyInactiveTabPane`。

## 图标
- 找图标先把 `packages/icon/output/icon.json` 的全部名字（约 314 个）列出来按形状挑，不要只按语义词搜：时钟类是 `history`、`hourglass`，没有叫 clock 的（R15/R16-02074 两次误判「图标集没有时钟」）。类名写法 `icon-[fx--<name>]`。

## git
- 不用 `git stash`，所有 worktree 共用 stash。
- lint-staged 会对整份暂存文件跑 biome。改动文件里如果有存量 lint 问题，会把提交拦下，只修被拦的那几处，不要扩大改动。
