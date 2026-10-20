# 浏览器验证（§6 用）

改动涉及可见 UI 时**必须**做浏览器验证。脚本目录是 `$S`（`~/.ai-rules/skills/prd-to-commit/scripts/`）。

## 1. 起 dev server（固定端口）

```bash
node $S/dev.mjs start ~/github/<ID> --site web          # web 4710 | web-next 4001 | admin 4711 | legacy-admin 8109 | futures-legacy-admin 8110
# 需求带 MSW mock 时：先在 app 目录跑一次 `pnpm msw:init`，再以 NEXT_PUBLIC_ENABLE_MSW=true node $S/dev.mjs start ... 启动（进程环境变量优先于 .env 文件）
node $S/dev.mjs status ~/github/<ID> --site web
node $S/dev.mjs stop ~/github/<ID> --site web           # 交付后停掉
```

- 端口固定，因为登录态按 origin 保存。同一站点同时只跑一个 dev server，启动时会自动停掉其他 worktree 占用的同端口进程。
- **所有站点统一连 dev 环境（pfyys）**：开发期接口先发 dev，在 dev 联调完才上 test，dev 上的数据也更好操作。Next 站点用仓库的 `.env.dev`（等同 `pnpm dev`）；legacy 工程的仓库代理本来就指向 pfyys，以 `--mode dev` 启动。`scripts/legacy-vue.config.cjs` 只用来关掉自动打开浏览器；确需临时连别的环境时，在启动命令前加 `P2C_PROXY_FROM=pfyys.com P2C_PROXY_TO=<目标域名>`，不改仓库文件。legacy 第一次启动时会自动 `npm install`。
- 多个站点可以同时运行（端口各不相同），按需启动即可。
- **全机限流**：`dev.mjs start` 会检查整台机器上由它启动且仍在监听的 dev server，达到上限（环境变量 `P2C_MAX_DEV` > `~/.config/prd-to-commit/dev/max-dev` > 默认 4，排队中每次重试都重读）就每 30 秒重试、最多等 `P2C_DEV_WAIT_MIN`（默认 40）分钟，超时返回 5。16G 内存的机器上 3 个以上 Next dev 同时冷启动会卡死（2026-10-18 三次强制重启）；不要绕过它手动起 `next dev`。
- 多个会话同时验证同一站点：各自在命令前加不同的 `P2C_PORT_OFFSET=<n>`（dev.mjs 与 browser.mjs 都认，端口 = 原端口 + n；偏移端口没有登录态，只适合 `auth = false` + mocks），或加 `--no-steal`：端口被别的 worktree 占用就返回 4、不启动（默认会停掉对方）。等待期间先做冷读、写 spec。

## 2. 登录态

```bash
node $S/browser.mjs check --site web     # 无头检查，要求该站点 dev server 已启动；失效返回 2，dev server 未起返回 3
```

- **尽早检查**：§4 建好 worktree 后，就对本需求会验证的站点逐个跑 `check`（还没登录过的站点会直接报「还没登录过」）。失效或从未登录时，立刻请用户执行 `login`，并在同一条消息里说明编码会继续进行；不要等到 §6 才发现。「直接做」模式下用户往往不在场，越晚提越可能整段 not-covered（PR-02463 只能改用假 token，PR-01507 登录后的 spec 全部没跑）。
- 每个站点有一个专用 Chrome profile（`~/.config/prd-to-commit/browser/<site>`），由**用户手动登录一次**，脚本之后以无头方式复用。
- 登录态按环境区分：`browser-sites.json` 的 `_env` 是当前环境，每个 profile 旁边的 `<site>.env` 记录它登录时的环境。环境不符时 `check`/`run` 直接报错要求重新登录；`login` 会先把旧 profile 移到 `archive-<旧环境>-<时间戳>/` 再打开干净窗口。不能复用旧环境的 profile：旧 token 会让页面在「跳资产页 → 401 → 回登录页」之间无限刷新，人也没法操作。
- web-next 是独立 origin（4001），登录态不与 web 共享，要单独登录一次；它没有路由级登录跳转，`check` 靠 `authProbe`（首页请求 `user_info_v1`）判断。
- **只需登录三次**：`web`（C 端）、`web-next`（C 端新工程）和 `legacy-admin`（现货后台）。`admin`（Next 后台）会自动复制 legacy-admin 的 localStorage（`admin_token`、`ADMIN_USERINFO`）；`futures-legacy-admin`（合约后台）会在页面加载前设置 `window.name = admin_token`（等价于人工在 console 里设置），都不用单独登录。
- `apps/futures-admin` 的 Next 工程已停用，不在支持范围内。
- check 失效时，**告诉用户运行 `node $S/browser.mjs login --site <site>` 重新登录**（这一步需要人工过验证码或 GA）。这期间先做不依赖登录的验证。
- 不要尝试自动登录或绕过验证码。
- **用户不在场且登录态失效**（「直接做」、回放）：不停下等。能 mock 的页面照常验——spec 写 `export const auth = false`，把页面用到的接口（含用户信息、后台 menus/权限接口）全部写进 `mocks`；只有必须真实登录态才能出现的行为记 `not-covered: 登录态失效`。R11 回放 5 次遇到：用此法的 3 次（web 落地页、web 搜索、Next 后台 8 页）都验出了真问题，直接放弃的 2 次整段没覆盖。
- **需要「已登录」页面但没有登录态**（失效或偏移端口）：用 `$S/auth-fallback.mjs`，不要自己从头写。`webAuthMocks` 给出满足 apps/web schema 的用户信息、合约用户配置等用户态接口；`fakeLoginWithPublicCache(page, goto, [预热页...], { mocks })` 先匿名访问预热页缓存 dev 公共接口的真实响应，再注入假 token，之后公共接口用缓存回放、spec 的 mocks 照常生效、其余请求回 `ok(null)`（防止带假 token 打到后端返回 10002 触发登出），返回的 `unmatched` 列出被兜底的接口，页面数据不对时给它们补 mock。同一 URL 后注册的 mock 优先，所以本需求的 mock 放在 `webAuthMocks` 后面。SSR 预取的数据 mocks 拦不到，只能用 dev 真实数据，构造不了的数据态记 not-covered。已在资产页验证可用（R14）。
- 无头模式下 HeroUI Tooltip/Popover 类浮层对 `locator.hover()` 不一定响应、移出触发器又会立刻关闭（R11-01973、R13/R14-02006 各耗 10–20 分钟）。写法：取触发器 `boundingBox()`，`page.mouse.move(cx, cy, { steps: 5 })` 移到中心，等浮层出现后再 `mouse.move` 到浮层内的目标坐标（同样带 steps）再点击；只验证浮层内容时也可以 `locator.focus()` 或键盘触发。
- 登录窗口是**普通 Chrome 进程**（不经 Playwright 启动），login 期间只在浏览器级别（`Storage.getCookies`、`Target.getTargets`）每 2 秒把 cookies 快照到 `<site>.state.json`（权限 600），不连接任何页面。实测：Playwright 启动的窗口，或经 Playwright 连进页面做快照，都会让 dev 登录页不停闪动、无法操作。页面全部关闭即视为登录结束。本站 localStorage（如后台 `admin_token`）由 `check` 在确认有效后从 profile 补进 state 文件，所以登录后要先对 `legacy-admin` 跑一次 `check`，Next 后台和合约后台才能复用。没有本机 Chrome 时，可加 `--automation` 回退到 Playwright 窗口。
- **登出接口（logout/login_out）一律拦截**：放行会让服务端会话失效，保存的登录态就废了。
- check 的判定：页面没有跳到登录页，**且**配置了 `authProbe` 的站点必须观察到鉴权接口返回正常（后台用 `/operate-api/menus`，返回 10021 即为失效）。只看页面跳转会误报有效。

## 3. 写验证脚本（spec）

放在 `~/.prd-cache/<ID>/browser-specs/<名字>.mjs`，每个页面或流程一个文件：

```js
export const site = 'web'                 // 必填：对应 browser-sites.json
// export const auth = false              // 不需要登录的页面
// export const viewport = { width: 375, height: 812 }   // H5
export const mocks = [                    // 接口没就绪、或要构造特定数据态时用（不改业务代码、不加 MSW）
  { url: /\/fe-ex-api\/finance\/launchpool\/projects/, json: { code: '0', msg: '', data: { list: [/* 按清单契约构造 */] } } },
  { url: /\/manualInvalid\/submit/, method: 'POST', json: { code: '0', msg: '操作成功', data: null } },
]
// export const strictWrites = true        // dev 上也拦截未 mock 的写操作（默认放行）

export default async ({ goto, step, expectText, page, shot }) => {
  await step('列表页展示', async () => {
    await goto('/zh-CN/earning/launchpool')
    await expectText('全部项目')
  })
  await step('存入低于最小值的提示', async () => {
    await page.getByRole('button', { name: '存入', exact: true }).click()
    await page.getByRole('dialog').locator('input').fill('0.001')
    await expectText('小于最小存入数量，请重新输入')      // 文案逐字照 PRD
  })
}
```

```bash
node $S/browser.mjs run ~/.prd-cache/<ID>/browser-specs/<名字>.mjs --id <ID> [--worktree ~/github/<ID>] [--headed]
```

- 输出在 `~/.prd-cache/<ID>/browser/<时间>/`，包含每步截图、`report.md`、`report.json`（页面报错、console error、失败请求、mock 命中、拦截的写请求）。
- 运行器会自动去掉开发态叠层（react-scan、Next 开发角标）。
- **写操作**：dev 环境（pfyys）上默认**真实写入**，报告的 `realWrites` 会列出每一条，交付说明里要写明改了哪些 dev 数据。发往其他域名的写操作类请求（路径含 create/update/delete/submit/bind/withdraw…）一律拦截，返回成功占位并记入 `blockedWrites`；legacy 后台经本地 devServer 代理的接口（如 `/old-api` → f4mes）按 `browser-sites.json` 的 `proxy` 映射回目标域名再判断，仓库代理改了要同步。spec 的 mocks 先于写保护命中，被 mock 的写不算真实写入。不想动 dev 数据，或接口还没上 dev 时，给该接口写 mock，或在 spec 里设 `strictWrites = true`。登出接口始终拦截。POST 查询照常透传。

## 4. 要验证什么（对着清单逐行写）

- 清单里每个「页面/入口」行至少一个 step：能进入、关键文案逐字出现、PRD 写明的交互（弹窗、校验提示、禁用态、空态/错误态）。
- 状态类需求用 mocks 构造各个数据态（如预热中/进行中/已结束、有数据/空/接口失败）分别截图。
- **截图按需看**（Claude 用 Read 读 png）：每个页面/状态看 1 张对照 PRD 图片和 Figma 检查布局，失败步骤必看；文案、显隐、禁用态用 `expectText` / locator 断言判，不靠看图。每张截图约 1.5K token 且之后每轮都要背着（R13 浏览器子 agent 逐张看、3 轮重跑，上下文涨到 337K、28M）。看到问题算 MISMATCH；修完重跑只看 `report.md` 的通过/失败与 pageerror，修的是视觉问题才再看对应截图。
- `report.md` 里的页面报错（pageerror）和本次改动相关的失败请求必须处理或说明原因。

## 5. 交付说明里写

- 跑了哪些 spec、每步的结果、截图目录。
- 没覆盖到的页面和原因（例如登录态失效等待用户重登、legacy 依赖装不上），写成 `not-covered: <原因>`，不能写通过。
- 结束后 `dev.mjs stop` 停掉自己启动的 dev server。

## 6. 已知限制

- **dev 环境的 posthog 在发送前丢弃事件**：埋点属性在浏览器里验不到，只能看事件名顺序；埋点靠纯函数单测覆盖，浏览器记 `not-required`（R11-01988、R15-02022）。
- **依赖被提升导致 dev 起不来**（如根 `node_modules/@heroui/react` 被提升成 web-next 的 3.2.0，apps/web 整站 500）：`dev.mjs start` 已自动把根软链临时指向本 app 声明的版本、stop 时还原（看输出 `hoist:` 行）；仍起不来的其他依赖才用 APFS 克隆一份副本（`cp -c -R <worktree> /private/tmp/p2c-shadow/<ID>`，必须用真实路径：经 `/tmp` 软链启动 Next 会整站 500，R17-02172），只在副本里改软链验证：副本里先删 `.git`（防误提交），修复改回 worktree 后用 `rsync -a --delete <worktree>/apps/<app>/src/ <副本>/apps/<app>/src/` 同步再重跑；验证后 `diff -r` 核对 src 一致并删除副本；`dev.mjs status` 此时显示的是副本路径。不改 worktree 的依赖（R12/R15/R17-02306）。
- **既有 pageerror 的归因**：拿 base 上的同一页面对照一次即可，不要为此多写探针 spec（R16-02074）。

- **Codex CLI 沙箱禁止监听端口（EPERM）**：Codex 下由编排方，或者在沙箱外执行 `dev.mjs start`，Codex 只负责写 spec 和跑 `browser.mjs run`。用 Codex 桌面 App 没有这个限制。
- 回放用的旧 base（几个月前的提交）可能因为依赖版本起不来，真实开发基于 `origin/online` 不受影响。
