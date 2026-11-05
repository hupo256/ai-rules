# FameEX 仓库已知坑（按需读）

只在碰到相关改动时读。每一条都来自真实运行。**项目事实在 `~/.ai-rules/rules/fameex/`**（`where-new-work-goes.md` 与 `react19-runtime-pitfalls`、`legacy-admin-vue2`、`i18n-locale-rules`、`activity-landing-and-app-webview` 四个主题文件，2026-11-01 起；个人本地规则，不进团队仓库），这里只留 prd-to-commit 流程特有的判断与坑，避免两处维护。

## 工程归属
- 工程归属判据（web vs web-next vs 独立应用、后台两套与菜单登记、legacy 无 tsc 兜底）见 `~/.ai-rules/rules/fameex/where-new-work-goes.md` 与 `legacy-admin-vue2.md`；**定不了就作为阻塞问题问用户，直接做模式写在交付说明首行**（PR-01549、02634、02012 三次与同事选的不同）。
- **base 已含同需求实现**（preflight 结论「已合入」，PR-02127/02254）：按「复核补缺」做（SKILL §0）。先 `git log --grep <ID> <base>` 看首轮与之后的修复提交，再 `bugs.mjs <ID>` 看 QA 报过什么——**首轮之后被删的列、被统一的默认值多半是 QA/产品后来的决定，不要当偏差改回去**（PR-02127 恢复了 QA 后删除的列、PR-02254 回退了已统一的默认时间，两次都判错）。真正值得补的是 QA 用例没覆盖的小项（无备注时的兜底显示、React 19 下提示不出现、筛选后分页回第 1 页）。

## web-next（apps/web-next）
- 编码规范、路由树生成、登录守卫、暗色、i18n 命名空间、Header 行为：见 `rules/fameex/where-new-work-goes.md` 与 `i18n-locale-rules.md`。本流程相关：新增路由后要 `dev.mjs start --site web-next` 起一次生成 `routeTree.gen.ts` 再 stop（check.mjs 会核对）；没有 MSW，数据态写在浏览器 spec 的 mocks 里。
- 资产页、现货/资金账户流水、帮助中心仍在 apps/web：需求涉及这些宿主页而用户限定 web-next 时，标「不做（宿主在 apps/web）」并列待确认。
- 已对接同一后端的接口，apps/web 的 `src/services/api/*`、`src/types/*` 可作为契约输入存 `inputs/<仓内路径>`（只取契约，不看旧 UI，PR-01507）。

## 活动页与 App WebView
- 事实见 `rules/fameex/activity-landing-and-app-webview.md`。本流程要求：PRD 出现「App 端」「两端验收」「App 内打开」时，清单**展开**原生分享、返回刷新、客服浮窗隐藏、App 登录态四行；活动页清单必有「未开始置灰」「配置以接口为准」「倒计时就地切换」三行（PR-02634 QA 7986/7994/7987）。

## 口径与错误码
- PRD「通用规则」章节（时间口径、空值、精度）是全局约束，清单按页逐条核对。
- 修改类需求的「总数量」上限：核对是否含已成交/冻结部分，对「部分成交」代入一组数值算一遍（PR-01549 漏加回 `dealtBase`，部分成交单默认值就超限）。
- 错误码文案表 `apps/web/src/i18n/locales/zh-CN/errorCode.json`：写接口（报名、领取、下单、改单）按同业务前缀搜已有码（已报名/未报名/已结束/未开始/会话过期），按码分支；「同下单时的提示」类需求复用下单侧的错误映射，不另写兜底文案（PR-02634、01549）。
- 新增枚举值/审批来源时，搜其他端的解析点与筛选项一起加（PR-02012 审批列表「业务类型：团队配置」漏同步；PR-02374 新增 AGENT_UID 让 web 严格 enum 与 legacy Banner 不认）。

## i18n
- 事实见 `rules/fameex/i18n-locale-rules.md`（只改 zh-CN、两套命名空间机制、插值转义、legacy 空白、errorCode.json）。清单里其他语种不同步时注明依据；并行子 agent 的新 key 写草稿由主会话合并（delegation.md）。

## 数据态与 mock（不用 MSW）
- 2026-11-05 起**不往 fameex-web 提交 MSW 基建或 handler**：mock 只写在 `~/.prd-cache/<ID>/browser-specs/*.mjs` 的 `mocks` 里；人要交互着看用 `browser.mjs open <spec>`（见 browser.md §3）。test/pre/online 不出现任何 mock 代码，也不需要和团队协调依赖。
- 仓里若已有别人加的 MSW 基建，照常可用，但本流程不新增 handler、不扩展基建。本地分支 `feature/msw-infra`（`d4e3f12b86`）只作参考保留，不 cherry-pick。
- SSR 预取的数据 spec mocks 拦不到（MSW 浏览器版同样拦不到）：这类数据态只能用 dev 真实数据，构造不了的记 not-covered。
- 权限 key 未知时用 `null`（不拦截）而不是非法占位（PR-02254；见 checklist-rules 非法占位的例外）。

## 测试
- 根 `vitest.workspace.ts` 把 `@` 指向 apps/web/src。check.mjs 对自带 `vitest.config` 的 app（admin、futures-admin、security-admin、web-next）在 app 目录用其配置跑，其余非 web app 用临时配置改 `@`；自己手动跑时同理（PR-01930 v4、PR-01507）。测试失败时 check.mjs 会在 base 临时 worktree 复跑，base 上同样失败的标 pre-existing（PR-02463、PR-01507 各遇到 2 例存量失败）。

- biome 格式化可能把存量 tsc 错误挪到「改动行」上，让 check.mjs 报失败。先确认是否存量（`git show <BASE>:<file>` 对照），是存量就做最小修复或在交付说明里注明（PR-02265 两次复现）。

## 运行时坑
- 见 `rules/fameex/react19-runtime-pitfalls.md`、`legacy-admin-vue2.md`。本流程含义：这些 tsc 与冷读都查不出，**浏览器验证不能省**，写入口要点到底（browser.md §4）。

## 图标与 git
- 图标按形状在 `packages/icon/output/icon.json` 里挑、不用 `git stash`、lint-staged 存量问题只修被拦处：见 `rules/fameex/where-new-work-goes.md`「环境与工具事实」。
