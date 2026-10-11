# prd-to-commit 版本记录

skill 本体在 `~/.ai-rules/skills/prd-to-commit/`（独立 git 仓库），版本即该仓库的 tag `prd-to-commit-vX.Y[.Z]`。本文件只记每个版本**改了什么、为什么、用什么证据放行**；逐轮回放数据见 [iteration-ledger.md](./iteration-ledger.md)，回放基准见 [replay/](./replay/README.md)。

## 发版纪律

- **加规则的门槛**：同类问题出现 2 次，并且能在回放中复现。
- **放行条件**：改动后至少回放受影响的基准；得分不低于上一版，且陷阱零违反。没有改善就撤回。
- **体量上限**：SKILL.md ≤150 行、≤18KB。超了先精简再加。
- **记录**：每次打 tag，在本文件顶部追加一节，并在 [iteration-ledger.md](./iteration-ledger.md) 记录回放结果（不回放的要写明原因）；（2026-10-11 本台账迁入 `~/.ai-rules/labs/prd-to-commit/` 后，不再同步 docs_tdd 根 README 和 CHANGELOG，docs_tdd 已冻结。）未打 tag 的提交记在「未发布」一节。

## 未发布

- （2026-10-11）**并行判定改为「先看依赖、再看工作量」**（用户要求：要不要并行应看任务间的逻辑；已回放）。
  - §3.5 删去「≤20 文件默认串行 / >20 文件且 ≥2 批主会话只协调」两条文件数门槛，改为三条：能否并行看依赖（不改同一文件、只依赖批次 0 契约、不需要对方产出）；值不值得派看工作量（只派明显大于重建上下文成本的批次，零散小改动主会话顺手写）；值得派的有 ≥2 批时主会话只协调。plan 每批标明是否派子 agent 及理由。§5 第一条、frontmatter description、「批次 1..n」小标题同步改写（原先仍写「派给并行子 agent」，与 §3.5 冲突）。
  - 证据：R9-02306 7/7、陷阱 0、18 分钟、7.3M（v1.3 基线 7/7、15 分钟、6.6M），plan 判「零散小改」全程串行。R9-01930 15/15、陷阱 0、40 分钟、49.0M，plan 判「S2–S4 互相引用、S1 零散」全程串行；01930 没有 v1.3 对照，最近基线是 v1.1 的 32.5M，差额主要来自 v1.2 起新增的浏览器验证（冷读+浏览器+修复阶段 13.5M），以及读 PRD 和 20 张图后主会话每次调用都背着约 25 万 token 上下文。
  - 试过又撤回：「大批次串行也派」（单批很重时即使有依赖也按顺序派子 agent，以隔离主会话上下文）。R10-01930 新页面派给子 agent（2.5M、5 分钟），15/15、陷阱 0，但编码阶段合计 13.5M+（R9 串行 12.3M），总计 66.0M、56 分钟；多出部分主要是浏览器验证范围扩大（该阶段 21.1M）。没测出收益，按纪律撤回。另注：R10 运行中途另一会话提交了 check.mjs 新版（4f52f16 起），可能影响该轮成本。
  - 待立题：主会话成本的大头是前期读 PRD 和图片带来的上下文，派不派编码子 agent 影响很小；可考虑让子 agent 读图并只交回摘要。SKILL.md 改后 135 行、17942 字节。
- （2026-10-11）**替换旧提示时不丢条件**（用户要求；按纪律本应等出现第 2 次，未回放）：SKILL.md 中「提示与校验一致」一条补一句「用新提示替换旧提示时，旧提示写明的条件（如『含数字』）新提示里也要能看到」，冷读第 6 项同步检查。来源：v1.3 回放 PR-02306 把三个设置密码页的旧单行提示「8-20位数字和字符+字母组合」换成了三行勾选，数字条件只藏在判定里，评分员指出提测时容易被报成 bug。SKILL.md 改后 134 行、17915 字节。
- （2026-10-11）回放基准 PR-02306 登记「已知环境问题」：起点提交的 `packages/ui` 没有声明 `@heroui/react`，浏览器验证预期是 not-covered。原先怀疑是 `worktree.mjs` 不校验依赖版本，查证后排除——那是当时仓库自身的缺陷，online 已修复，所以不改脚本。

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
