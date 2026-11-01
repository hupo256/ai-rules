> 何时读：活动落地页（交易赛、嘉年华、榜单类）与 App WebView 内打开的仓库事实——按钮置灰时机、配置以接口为准、倒计时就地切换、原生分享/返回刷新/客服浮窗。做 Marketing/活动页或 PRD 写「App 端验收」时读。
> 适用路径：["apps/web/src/apps/Marketing/**", "apps/web/src/apps/Campaign/**", "apps/web-next/src/apps/**", "apps/web/src/utils/bridge.ts", "apps/web/src/utils/initYsf.ts"]
> 个人本地规则（不进 fameex-web 仓库），由 `~/.ai-rules/rules/fameex-local.md` 路由。

# 活动页与 App WebView

## 活动页（PRD 常只写一半）
- 行动按钮（报名/去交易）**未开始与已结束都置灰**：PRD 状态表通常只写「已结束置灰」，QA 会按「未开始不能报名」报 bug。
- 奖池档位、分配比例等配置：接口返回同类字段（`milestones`、`nextMilestoneGap`、`maxPrizeGap`）时**以接口为准**，PRD 的表只作缺省；写死 PRD 表在测试环境（档位不同）就错。
- 倒计时跨过开始/结束时间要按服务端时间 + 本地流逝就地切换阶段，不等后端 `activityStatus`（会滞后）。
- 结束弹窗的按钮、名次文字要有对比度。
- 同类契约参照：EU 双榜（`DualRanking`，apps/web）的 overview/ranking 字段形状。

## App WebView（PRD 写「App 端」「Web/App 两端验收」「App 内打开」时）
- 原生导航栏右上角分享：`apps/web/src/utils/bridge.ts` 的 `sendShareContentMessage`（进页即发），`hasAppBridge()` 判 App 内；web-next 在 `utils/appBridge.ts`（showShare / shareContent）。
- 跳出交易/登录再返回要看到最新数据：监听 `focus`、`pageshow`、`visibilitychange` 刷新概览与进度，只做轮询不够。
- 活动页隐藏客服浮窗：`apps/web/src/utils/initYsf.ts` 的 `hidePages` 登记路径（world-cup 先例）。
- App 内隐藏顶栏：`useHiddenAppBar`（`?hiddenAppBar=`）、`useIsWebView`。
- web-next 从 cookie `exchange-token` 读 App 登录态的能力在 `platform/runtime/browser/appWebViewToken.ts`；需求要在 App 内打开时先确认目标工程具备。
