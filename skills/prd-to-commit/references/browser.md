# 浏览器验证（§6 用）

改动涉及可见 UI 时**必须**做浏览器验证。脚本目录是 `$S`（`~/.ai-rules/skills/prd-to-commit/scripts/`）。

## 1. 起 dev server（固定端口）

```bash
node $S/dev.mjs start ~/github/<ID> --site web          # web 4710 | admin 4711 | legacy-admin 8109 | futures-legacy-admin 8110
node $S/dev.mjs status ~/github/<ID> --site web
node $S/dev.mjs stop ~/github/<ID> --site web           # 交付后停掉
```

- 端口固定，因为登录态按 origin 保存。同一站点同时只跑一个 dev server，启动时会自动停掉其他 worktree 占用的同端口进程。
- **所有站点统一连 dev 环境（pfyys）**：开发期接口先发 dev，在 dev 联调完才上 test，dev 上的数据也更好操作。Next 站点用仓库的 `.env.dev`（等同 `pnpm dev`）；legacy 工程的仓库代理本来就指向 pfyys，以 `--mode dev` 启动。`scripts/legacy-vue.config.cjs` 只用来关掉自动打开浏览器；确需临时连别的环境时，在启动命令前加 `P2C_PROXY_FROM=pfyys.com P2C_PROXY_TO=<目标域名>`，不改仓库文件。legacy 第一次启动时会自动 `npm install`。
- 多个站点可以同时运行（端口各不相同），按需启动即可。

## 2. 登录态

```bash
node $S/browser.mjs check --site web     # 无头检查；失效返回码 2
```

- 每个站点有一个专用 Chrome profile（`~/.config/prd-to-commit/browser/<site>`），由**用户手动登录一次**，脚本之后以无头方式复用。
- 登录态按环境区分：换环境后旧登录态无效，要重新 login。
- **只需登录两次**：`web`（C 端）和 `legacy-admin`（现货后台）。`admin`（Next 后台）会自动复制 legacy-admin 的 localStorage（`admin_token`、`ADMIN_USERINFO`）；`futures-legacy-admin`（合约后台）会在页面加载前设置 `window.name = admin_token`（等价于人工在 console 里设置），都不用单独登录。
- `apps/futures-admin` 的 Next 工程已停用，不在支持范围内。
- check 失效时，**告诉用户运行 `node $S/browser.mjs login --site <site>` 重新登录**（这一步需要人工过验证码或 GA）。这期间先做不依赖登录的验证。
- 不要尝试自动登录或绕过验证码。
- 登录态的保存方式：profile 持久保存 localStorage；会话 cookie 关窗即丢，所以 login 期间每 2 秒把 cookies 快照到 `<site>.state.json`（权限 600），运行时再注入。
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
- **写操作**：dev 环境（pfyys）上默认**真实写入**，报告的 `realWrites` 会列出每一条，交付说明里要写明改了哪些 dev 数据。发往其他域名的写操作类请求（路径含 create/update/delete/submit/bind/withdraw…）一律拦截，返回成功占位并记入 `blockedWrites`。不想动 dev 数据，或接口还没上 dev 时，给该接口写 mock，或在 spec 里设 `strictWrites = true`。登出接口始终拦截。POST 查询照常透传。

## 4. 要验证什么（对着清单逐行写）

- 清单里每个「页面/入口」行至少一个 step：能进入、关键文案逐字出现、PRD 写明的交互（弹窗、校验提示、禁用态、空态/错误态）。
- 状态类需求用 mocks 构造各个数据态（如预热中/进行中/已结束、有数据/空/接口失败）分别截图。
- **逐张查看截图**（Claude 用 Read 读 png），对照 PRD 图片和 Figma 检查布局、文案、显隐。看到问题算 MISMATCH，修完重跑。
- `report.md` 里的页面报错（pageerror）和本次改动相关的失败请求必须处理或说明原因。

## 5. 交付说明里写

- 跑了哪些 spec、每步的结果、截图目录。
- 没覆盖到的页面和原因（例如登录态失效等待用户重登、legacy 依赖装不上），写成 `not-covered: <原因>`，不能写通过。
- 结束后 `dev.mjs stop` 停掉自己启动的 dev server。

## 6. 已知限制

- **Codex CLI 沙箱禁止监听端口（EPERM）**：Codex 下由编排方，或者在沙箱外执行 `dev.mjs start`，Codex 只负责写 spec 和跑 `browser.mjs run`。用 Codex 桌面 App 没有这个限制。
- 回放用的旧 base（几个月前的提交）可能因为依赖版本起不来，真实开发基于 `origin/online` 不受影响。
