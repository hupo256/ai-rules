# prd-to-commit 版本记录

skill 本体在 `~/.ai-rules/skills/prd-to-commit/`（独立 git 仓库），版本即该仓库的 tag `prd-to-commit-vX.Y[.Z]`。本文件只记每个版本**改了什么、为什么、用什么证据放行**；逐轮回放数据见 [iteration-ledger.md](./iteration-ledger.md)，回放基准见 [replay/](./replay/README.md)。

## 发版纪律

- **加规则的门槛**：同类问题出现 2 次，并且能在回放中复现。
- **放行条件**：改动后至少回放受影响的基准；得分不低于上一版，且陷阱零违反。没有改善就撤回。
- **体量上限**：SKILL.md ≤150 行、≤18KB。超了先精简再加。
- **记录**：每次打 tag，在本文件顶部追加一节，并在 [iteration-ledger.md](./iteration-ledger.md) 记录回放结果（不回放的要写明原因）；（2026-10-11 本台账迁入 `~/.ai-rules/labs/prd-to-commit/` 后，不再同步 docs_tdd 根 README 和 CHANGELOG，docs_tdd 已冻结。）未打 tag 的提交记在「未发布」一节。

## 未发布

（无）

## 观察清单（只出现过 1 次，未改 skill；再出现一次且能回放复现再立规则）

- **契约在兄弟 app**（PR-01507）：迁移到 web-next 时，PRD 不含接口，同仓 apps/web 已对接同一后端。候选：「同仓其他 app 已对接同一后端时，其 service/types 视为契约输入存 inputs/，只取契约不看 UI」。目前写在 `references/fameex.md` 的 web-next 小节。
- **占位渲染给用户**（PR-01507）：PRD「待定」的 FAQ 用 TODO 占位并显示在页面，协议没有链接。候选：「未指定的文案/链接先在仓内同功能既有资源里找定稿；找不到才占位，且占位不得渲染给用户」。
- **因存量测试撤回修复**（PR-01507）：同因修复破坏了存量组件测试就撤回，被第 2 轮冷读驳回。候选（§8）：「修复破坏存量测试时照兄弟测试的 mock 适配，不以此撤回修复」。
- **并行批次各自实现同一展示件**（PR-01507）：阶梯 APR 提示 3 份、格式不一。候选（§3.5）：「同一展示件出现在 ≥2 个批次的页面时归批次 0 共享件，派活时写明禁止各自实现」。
- ~~**状态未知当默认值提交**~~（PR-01507，资金类）：用户决定（2026-10-11）作为通用编码手艺写入 `coding-quality` → `references/controlled-form-hooks.md`「Unknown is not unset」，不进本 skill，移出观察清单。
- **browser.mjs 并行收尾卡死**（PR-01507）：同时启动两个 `browser.mjs run`（各自 profile 副本），所有步骤和截图都完成了，但两个进程都卡在收尾，不写 `report.md` 也不退出，只能手动结束；单独运行正常。脚本注释写「允许并行」，需要复现后查 context 关闭或 dev server 的连接问题。
- **回放执行方反馈**（P1-02306）：§7「冷读默认前台」与浏览器验证可并行的说法分散在 §3.5 末尾；dev 起不来时修依赖还是记 not-covered 没写明；冷读提示「列出埋点」在 PRD 无埋点时是噪音；「补显示 PRD 漏写的校验条件」与冷读第 4 步必然互相触发。

- **写后 invalidate 与缓存决定弹窗冲突**（R19-02022）：「已读后不再弹」靠缓存判断时，成功回源用旧值覆盖导致重弹；执行方改 staleTime Infinity 又违反「每次进入重查」。候选（§5）：此类场景成功后 setQueryData，保留每次进入查询。
- **采纳冷读「观察/建议」前未对照 PRD**（R19-02022 C4）。候选（§8）：非 MISSING/MISMATCH 的建议采纳前须对照 PRD 原句。
- **PRD 少写校验条件时补一行还是并入已有项**（R18-02306）。
- **02074 方差**：C7/C8/C11/C13/C14 轮换丢分，各轮 10–12/14，单列风险，不立规则。

## v1.6.1 — 2026-10-20

正式使用前的整体审查修复。不改流程与规则，未回放（原因见 [iteration-ledger.md](./iteration-ledger.md)）。

- **check.mjs：tsc 漏报未改动的调用方**。原逻辑只报落在改动文件里的错误：改了共享类型/props/导出后，调用方报错被丢弃，check 照样 pass；改 `packages/*` 不跑 tsc；tsc 自身没跑起来也显示 pass。现在改动行以外的错误与 base 上同一工程的 tsc 结果按「文件 + TS 码」计数比对，多出的算本次引入；改 packages 时跑该包并附带 apps/web；只删文件也跑；tsc 工具失败按 FAIL。base 结果按 merge-base + 锁文件缓存在 `~/.prd-cache/_tsc-base/`，每个需求首次多约 1 分钟。base worktree 逐项镜像所有 workspace 包的 node_modules，workspace 软链改指 base 的 packages。
  - 实测（origin/online 75930e9a62）：无害改动 pass（339 个存量错误忽略）；`generateMetaData` 加必填参数报出 75 个调用方错误（旧逻辑 pass）；`packages/utils` 的 `getQuery` 改签名报出 1198 个下游错误。调试中排除了两类误报：base 缺 packages 依赖导致类型退化为 any；同一存量错误两次运行打印的长类型不同。
- **browser.mjs：写保护补齐并调整顺序**。legacy-admin 的 `baseURLOld` 在本地走 `localhost/old-api` → f4mes（测试环境），绕过了只看非 localhost 的写保护；现按 `browser-sites.json` 新增的 `proxy` 映射回目标域名判断。写保护原先注册在 mocks 之后（Playwright 后注册先执行），导致非 dev 的写 mock 被占位响应覆盖、dev 上被 mock 的写记成 realWrites；改为先注册写保护。实测 5 类请求分类全部正确。
- **SKILL.md**：豁免注释写成 `<规则号如 CODE-ARCH-001>`（原 `<ID>` 易被写成项目号，且项目号也符合正则，会静默不豁免）；§4 写明先 `dev.mjs start` 再 `browser.mjs check`；§6 截图取舍改为指向 browser.md §4。18407 字节。
- **文档**：usage.md 的成本预期改为 v1.6 实测、登录次数改为三次；最终报告更正「写接口一律拦截」；browser.md 的并发上限默认值改为 4（与 dev.mjs 一致）。
- **审查发现、未修**（不影响单需求按流程跑完）：fetch-prd 中断留下未展开表格的缓存；worktree 复用时分支不符只警告；dev.mjs 默认抢占其他 worktree 的同端口；重命名文件被当整份新增；rsc-hooks 不查「改动的 layout 新引入未改动的 hook 文件」；非 dev 写拦截是动词黑名单。

## v1.6 — 2026-10-19

覆盖 v1.5-rc 到 v1.6-rc7 的全部迭代：读图与找落点子 agent 化、浏览器验证独立子 agent 与冷读并行、冷读/浏览器结果落盘可断点续跑，以及 6 条由回放复现的新规则；工具侧补 rsc-hooks、legacy 语法、假登录、全机 dev 限流与依赖提升自动修正。新增 5 个回放基准（01973、02006、02074、01947、01988），基准共 11 个。

- **放行依据**：11 基准取最新可信结果 139/148（93.9%），陷阱 0，逐基准不低于 R15（v1.5-rc6）。01988/01930 三个版本均 15/15、v1.6 改动不涉及，未重跑。逐轮数据见 [iteration-ledger.md](./iteration-ledger.md) R12–R19，失分分析见 [results/2026-10-17-R11-v1.4.md](./replay/results/2026-10-17-R11-v1.4.md)。
- **中断续跑的结果不作放行依据**：R17-02022（9/12、踩 T2）、R17-02306（6/7）干净重跑后为 12/12、7/7。
- **SKILL.md 规则（均有 ≥2 次回放复现或为全局规则未继承）**：
  - 读图 >5 张派子 agent 转写到 media-notes.md（开头每图一行摘要），编码某页面 UI 前必须看原图；单工程落点 ≤10 主会话直接搜，否则派 Explore 出落点地图。
  - 同因搜索包含被删除/替换的展示字段；范围外含「新功能泛化到其他对象」，默认收窄。
  - 列待确认（或称阻塞）≠ 不做；PRD 写明的显隐条件完整实现；原型多画的结构按原型、正文已列举控件时以正文为准。
  - 「已兼容」须对照 PRD 逐项成立、等式代入数值。
  - 批次 0 先接最小调用点再并行派；子 agent 不跑 git；`git --literal-pathspecs add`。
  - 冷读与浏览器子 agent 同时派（浏览器后台先派），都返回才改代码；第 2 轮冷读与浏览器复跑同样（rc7）；结果先写 `coldread-N.md`、`browser-roundN.md` 再返回（rc3）。
  - 埋点参数由纯函数算出并单测断言取值（rc4，R19-02022 生效）；§8 第 2 轮门槛 = 改 ≥3 个业务文件（不含测试）。
  - PRD 列了展示名时建「码→展示名」映射（rc5，02172 C14 四次丢）。
  - 不按展示文案/i18n label 反推类型，仓内已有此写法也不沿用（rc6，R17-02265 踩 T2 → R19 恢复 12/14、陷阱 0）。
- **工具**：check.mjs 并入 rsc-hooks（服务端组件可达文件新增 hook 判 FAIL，起点已有的同名 hook 记 pre-existing，292d014）与 legacy `?.`/`??` 拦截；auth-fallback.mjs（假登录 + 公共缓存）；browser.mjs 写接口按路径末段判定、check 不崩；dev.mjs `--no-steal`、`P2C_PORT_OFFSET`、全机上限（默认 4，`~/.config/prd-to-commit/dev/max-dev` 热调）、stop 还原 next-env.d.ts、start 自动把被提升的 `@heroui/react` 指回 app 版本；references 补 FameEX 运行时坑与图标查找。
- **成本**：干净跑小需求 6–16M、19–41 分钟（R18-02306 6.3M、R18-02022 15.6M）；中大需求 45–90M。子 agent 改用 Opus、评分用 Sonnet。
- SKILL.md 138 行、18432 字节（= 上限，再加规则须先压缩）。

## v1.4 — 2026-10-11

并行判定改为「先看依赖、再看工作量」；check.mjs 修三处测试/路由缺陷；浏览器核对支持 web-next；建完 worktree 就查登录态；新增 PR-01507 回放基准。

- （2026-10-11）**并行判定改为「先看依赖、再看工作量」**（用户要求：要不要并行应看任务间的逻辑；已回放）。
  - §3.5 删去「≤20 文件默认串行 / >20 文件且 ≥2 批主会话只协调」两条文件数门槛，改为三条：能否并行看依赖（不改同一文件、只依赖批次 0 契约、不需要对方产出）；值不值得派看工作量（只派明显大于重建上下文成本的批次，零散小改动主会话顺手写）；值得派的有 ≥2 批时主会话只协调。plan 每批标明是否派子 agent 及理由。§5 第一条、frontmatter description、「批次 1..n」小标题同步改写（原先仍写「派给并行子 agent」，与 §3.5 冲突）。
  - 证据：R9-02306 7/7、陷阱 0、18 分钟、7.3M（v1.3 基线 7/7、15 分钟、6.6M），plan 判「零散小改」全程串行。R9-01930 15/15、陷阱 0、40 分钟、49.0M，plan 判「S2–S4 互相引用、S1 零散」全程串行；01930 没有 v1.3 对照，最近基线是 v1.1 的 32.5M，差额主要来自 v1.2 起新增的浏览器验证（冷读+浏览器+修复阶段 13.5M），以及读 PRD 和 20 张图后主会话每次调用都背着约 25 万 token 上下文。
  - 试过又撤回：「大批次串行也派」（单批很重时即使有依赖也按顺序派子 agent，以隔离主会话上下文）。R10-01930 新页面派给子 agent（2.5M、5 分钟），15/15、陷阱 0，但编码阶段合计 13.5M+（R9 串行 12.3M），总计 66.0M、56 分钟；多出部分主要是浏览器验证范围扩大（该阶段 21.1M）。没测出收益，按纪律撤回。另注：R10 运行中途另一会话提交了 check.mjs 新版（4f52f16 起），可能影响该轮成本。
  - 待立题：主会话成本的大头是前期读 PRD 和图片带来的上下文，派不派编码子 agent 影响很小；可考虑让子 agent 读图并只交回摘要。SKILL.md 改后 135 行、17942 字节。
- （2026-10-11）**替换旧提示时不丢条件**（用户要求；按纪律本应等出现第 2 次；发布时已被 R9-02306、P1-02306 回放覆盖，均 7/7）：SKILL.md 中「提示与校验一致」一条补一句「用新提示替换旧提示时，旧提示写明的条件（如『含数字』）新提示里也要能看到」，冷读第 6 项同步检查。来源：v1.3 回放 PR-02306 把三个设置密码页的旧单行提示「8-20位数字和字符+字母组合」换成了三行勾选，数字条件只藏在判定里，评分员指出提测时容易被报成 bug。SKILL.md 改后 134 行、17915 字节。
- （2026-10-11）回放基准 PR-02306 登记「已知环境问题」：起点提交的 `packages/ui` 没有声明 `@heroui/react`，浏览器验证预期是 not-covered。原先怀疑是 `worktree.mjs` 不校验依赖版本，查证后排除——那是当时仓库自身的缺陷，online 已修复，所以不改脚本。
- `4f52f16`（2026-10-11）：**check.mjs 测试与路由核对**（PR-01507 实跑暴露；第 3 项为第 2 次出现）。
  - app 自带 `vitest.config`（admin、futures-admin、security-admin、web-next）时，在 app 目录用其配置跑改动的测试；原先统一生成只改 `@` 的临时配置，丢了 setupFiles/环境，web-next 组件测试多报 2 条假失败。
  - 测试失败时自动在 base 的临时 worktree（软链复用 node_modules，结束只解除软链再移除）复跑失败文件，base 上同样失败的用例标 `pre-existing`、不算本次 FAIL；解析不到失败用例时仍按 FAIL。PR-02463 与 PR-01507 各遇到 2 例存量失败，都是人工建临时 worktree 才确认。
  - TanStack 路由：新增/改名的 routes 文件必须出现在 `routeTree.gen.ts` 的 import 里、删除的不能还在，否则报 FAIL 并给出生成方法（路由树只能由 vite 插件生成，离线调 router-generator 会缺 Start 的 Register 声明，不采用）。
  - 验证：PR-01507 worktree 干净状态 pass + 2 条 pre-existing；注入新失败测试、改坏 base 能过的存量测试、新增路由不生成，三种都判 FAIL 且点名；admin 测试用自带配置跑通；临时 worktree 清理后依赖完好。
- `27b0908`、`5a8bfa1`（2026-10-11）：**web-next 站点**。`browser-sites.json` 加 `web-next`（4001，`PORT={port} pnpm dev`）；web-next 没有路由级登录跳转，登录态靠 `authProbe`（首页请求 `/fe-ex-api/common/user_info_v1`，未请求即无效，10002 即失效）。验证：正式脚本 `dev.mjs start/stop` 与未登录 spec（PR-01507 首页 7/7）跑通；authProbe 已于 2026-10-11 首次真实登录后确认：`check` 判有效（脚本只有观察到 `user_info_v1` 才会判有效），PR-01507 登录后 spec 申购 9/9、理财账户 7/7 通过。
- `e102214`、`b281d6b`（2026-10-11）：**建完 worktree 就查登录态**（第 2 次出现：PR-02463 登录态不可用只能改用假 token，PR-01507 全程未登录、登录后 spec 全部 not-covered）。`references/browser.md` 写明做法；SKILL.md §4 加 1 行指针，§4/§6 措辞压缩，137 行、17999 字节。证据：P1-02306 回放 7/7、陷阱 0、8.1M、15 分钟。
- `c1d853a`、`33813d9`（2026-10-11）：`references/fameex.md` 新增 web-next 小节（编码规范入口、路由树、无登录守卫、强制暗色、i18n 登记、无 MSW、Header SPA 链接与测试 mock、宿主页仍在 apps/web、契约可取 apps/web），测试小节同步 check.mjs 新行为。
- `4254c22`（2026-10-11）：**新增回放基准 PR-01507**（web-next 迁移型、大、适合并行批次、契约在兄弟 app）：18 个检查点 + 5 个陷阱，快照 `~/.prd-cache/REPLAY-01507/r6723`（含 figma/）；对照组为 2026-10-11 实跑首轮 13/18（不是线上历史，线上旧实现在 apps/web）。`prepare.sh` 试跑通过。

## v1.3 — 2026-10-11

独立代码规则扫描器接入 `check.mjs`；MSW 常驻策略；浏览器核对改连 dev 并默认真实写入；Codex 只读 `.git` 时用 bundle 交回。

- `cdae09b`（2026-10-11）：新增零依赖扫描器 `scripts/code-rules.mjs`，`check.mjs` 在 biome、tsc 之后调用它（[拆分决策](/Users/aven/github/docs_tdd/docs/decisions/2026-10-11-split-lark-bot.md)第 3 条，docs_tdd 已冻结）。
  - 规则从 docs_tdd 的 `verify-code-rules.mjs` 中挑出，只保留误报低的 error 级规则：ARCH-001、TYPE-002、E2E-001、MAPPER-001、FILE-001、STYLE-001、MOCK-004/005。
  - 丢弃：TYPE-001（Biome 已覆盖）；STYLE-002 写死颜色（近 3 个月命中 810 处，当 error 误报太高）；所有 warn-first 规则；依赖项目文档的规则。
  - 豁免只有一种写法：`code-rules-ignore <RULE-ID>: <理由>`。
  - lark-bot 用同一份脚本（复制一份钉住版本）。
  - 验证：自测 46 例；在 PR-02463 和主仓 138 个文件上与旧脚本对比，新脚本报出的 error 都在旧脚本的 error 里。发版前按纪律回放了 PR-02306，见本节「证据」。

- `ef0bb18`（2026-10-11）：**MSW 基建常驻**（用户确认：以前接口好了连基建一起清掉，清得太干净）。fameex-web 的本地分支 `feature/msw-infra`（`d4e3f12b86`，未 push）提供 apps/web 的常驻基建：`src/mocks/` 下的 handlers 登记表、按开关加载的 worker、README，以及 proxy、SW 注册和 turbo.json 的配套改动。已在本地验证：开关打开时 MSW 启动并能拦截请求，不开时完全不加载。按用户决定，不单独提基建 PR：第一个需要 MSW 的真实需求 cherry-pick 这个提交，基建随该需求合入 online，之后常驻；每个需求只增删 `src/mocks/<功能>/` 和登记行。
- （2026-10-11）mock 策略写进 SKILL.md §5（用户要求，未回放）：接口没上 dev 时，**AI 自行决定**加最小 MSW mock，把 UI/UX 写全、本地能点通，不用等用户提出。只 mock 本需求新增/变更的接口，放在 `src/mocks/<功能>/`，只在 `NEXT_PUBLIC_ENABLE_MSW=true` 的本地开发下生效，接口上 dev 后删除。app 还没接入 MSW 时，参照 `feature/PR-02463` 单独提交补齐（清单在 `references/fameex.md`）。只为验证构造的边缘数据态写在浏览器验证 spec 里。交付说明要列出 MSW handler。同日早先一版写成「MSW 要用户明确提出」，已更正。
- `c99da4c`（2026-10-11）：登录窗口改为**普通 Chrome**，登录期间只在浏览器级别读 cookie，不连接页面。原先由 Playwright 启动或经 Playwright 连进页面做快照，dev 登录页会不停闪动、无法操作；二分实验确认普通 Chrome 加浏览器级读取是稳定的。登录态按环境打标记，换环境时自动归档旧 profile。关窗后进程不退出的问题一并修复。四个站点已在 dev 上 check 通过。
- （2026-10-11）浏览器核对在 dev 上默认**真实写入**（用户要求）：dev 本来就是联调环境，数据可以操作；报告的 `realWrites` 列出每条真实写入，交付说明要写明。发往 dev 以外域名的写操作仍一律拦截，防止环境配错；spec 设 `strictWrites = true` 可在 dev 上也拦截；登出接口始终拦截。
- `a6fc678`（2026-10-11）：浏览器核对改连 dev 环境（pfyys），不再连 test。原因是开发期接口先发 dev、在 dev 联调完才上 test，dev 上也更好操作（用户要求）。Next 站点改用仓库 `.env.dev`，legacy 后台以 `--mode dev` 启动并沿用仓库自带的 pfyys 代理。只改站点配置和说明，未回放；web 与现货后台需要在 dev 上各重新登录一次。
- `fcfd23e`（2026-10-11）：Codex 沙箱里 `.git` 只读、无法提交时，改为把提交打成 bundle 交回（Codex 中出现 3 次）。只改 SKILL.md 文字，未回放；下次打 tag 时并入。

- **证据**：PR-02306 回放 R3（Claude）7/7、陷阱 0，与 v1.1 持平；15 分钟、6.6M token（v1.1 为 10 分钟、4.5M）。成本上升来自冷读返工和回放 worktree 的依赖版本不一致，与本版改动无关，见 [iteration-ledger.md](./iteration-ledger.md)。MSW、浏览器、bundle 三项属于工具和说明改动，放行依据见各条目自身的验证。

## v1.2 — 2026-10-11

浏览器核对打通。

- 新增 `scripts/browser.mjs`、`browser-sites.json`、`dev.mjs` 和 `references/browser.md`：web、admin、legacy-admin、futures-legacy-admin 四个站点用固定端口的 dev server 加专用浏览器 profile，跑真实页面，连 test 环境。
- 后台共享登录态（localStorage / window.name），legacy 代理指向 test；只读接口放行，写操作默认拦截。
- 删除已下线的 futures-admin Next 站点配置。
- 证据：四个站点完成真实页面验证。改动集中在浏览器核对：新增脚本和参考文档，并在 SKILL.md 里补了核对步骤的说明（`ccae9bd`）。没有做基准回放，放行依据是四个站点的真实页面验证。后台各页面的验证脚本细节尚未补齐。

## v1.1 — 2026-10-11（正式版）

6 个回放基准全部达标，Claude 与 Codex 两侧均通过验收。详见 [最终报告](./reports/2026-10-11-final-report.md)。

- **规则缺陷修正**：多值枚举每个值使用不同的占位；siderItems 照兄弟页面登记，只禁止篡改后端菜单数据；冷读默认在前台运行。
- **按「出现 2 次」加入的规则**：验证已有值的入口不套用新校验；规则提示与提交校验保持一致；需要口径值时先找 schema 现成字段，禁止用兄弟字段做算术；写操作成功后刷新依赖它的服务端数据；冷读的顾虑不能撤回 PRD 明确要求的改动；PRD 内部矛盾以产品方案正文为准；区分「同因」和「范围外」。
- **效率**：默认串行，只把完全独立的批次派给子 agent；第 2 轮冷读改为满足条件才跑；串行时不再单独跑批次 0 的 tsc。
- **工具**：`fetch-prd` 展开内嵌表格；`check` 对 legacy 不再假通过；`worktree` 防止与远端分支撞名；新增 `stats.mjs`；新增回放工具链。
- **撤回**：「示例值即格式标准」，因为在 PR-02265 上连续 3 轮没有改善。
- 证据：Claude 平均得分 95.3%，陷阱 0；Codex 在 PR-02022 上得 12/12，在 PR-02306 上得 7/7。未达标项：PR-02172 的 token 为 33–36M，超出 30M 目标约 15%。

## v1.0.1 — 2026-10-10

- Codex 回放 PR-02306 时踩了 T1（找回或绑定入口给已有密码套了新的强校验），据此新增「验证已有值不套新规则」。
- `stats.mjs` 修正 Codex 子代理的 token 归属。

## v1.0 — 2026-10-10（切换为默认流程）

- `~/.ai-rules` 改为 git 管理，打第一个 tag。
- 修完正式化评估列出的 P0/P1 问题，见 [正式化评估](./reports/2026-10-10-readiness.md) §3：内嵌 sheet 展开、legacy 检查不再假通过、远端分支撞名检查、stats 统计口径、后台页面跟随兄弟工程、禁止 `git stash`、大需求主会话只做协调。
- docs_tdd 入口和 Web Lite 改为指向本 skill，docs_tdd 冻结，决策见 [decisions/2026-10-10-switch-to-prd-to-commit.md](./decisions/2026-10-10-switch-to-prd-to-commit.md)。
- 证据：回归回放 PR-01930 得 15/15，但用了 44 分钟、41.4M token，效率未达标，留到 v1.1 处理。

## v0.x — 2026-10-09 ~ 10-10（预发布，未打 tag）

- **v0.1–v0.2**：极简内核，包括 SKILL.md 和 fetch-prd、worktree、check 三个脚本，共约 280 行。回放 PR-02306 得 7/7（历史 5/7），用了 3.5M token（历史 73M）；回放 PR-01930 得 10/15（与历史持平），用了 22M token（历史 208M）。
- **v0.3**：plan 依赖分批，子 agent 并行。回放 PR-01930 得 15/15，墙钟 29.6 分钟。
- 动因见 [2026-10-09 现状审计](./reports/2026-10-09-status-audit.md)。
