# ai-rules

给 AI 编码助手（Claude Code、Codex）用的个人规则仓库：一份常驻的全局编码规则，加上一组按需加载的 skill。其中 `prd-to-commit` 是一条完整的需求交付流程，输入 PRD，产出一个本地 commit。

## 接入方法

### 1. 克隆到固定位置

```bash
git clone <本仓库地址> ~/.ai-rules
```

脚本和规则里写死了 `~/.ai-rules/...` 路径，不要放到其他位置。

### 2. 挂载常驻规则

两个工具都用软链指向同一份 `AGENT.md`，改一处两边同时生效：

```bash
ln -s ~/.ai-rules/AGENT.md ~/.claude/CLAUDE.md     # Claude Code
ln -s ~/.ai-rules/AGENT.md ~/.codex/AGENTS.md      # Codex
```

如果原来已有 `CLAUDE.md` 或 `AGENTS.md`，先备份，把仍要保留的内容并入 `AGENT.md`。

### 3. 挂载 skill

每个 skill 单独软链进工具的 skills 目录：

```bash
for s in coding-quality figma-read change-scoping prd-to-commit; do
  ln -s ../../.ai-rules/skills/$s ~/.claude/skills/$s
  ln -s ../../.ai-rules/skills/$s ~/.codex/skills/$s
done
```

接好后检查一下：`ls -la ~/.claude/skills ~/.codex/skills`，两边都应该能看到这 4 个软链。

### 4. prd-to-commit 的额外前置条件

只用其他 skill 的话，可以跳过这一步。

| 依赖 | 要求 |
|---|---|
| Node | ≥ 22（脚本需要全局 WebSocket） |
| pnpm | 装 fameex-web 依赖 |
| `lark-cli` | 以本人身份登录，并且对 PRD 文档有阅读权限 |
| `~/github/fameex-web` | 业务仓库主 checkout，能 fetch `origin` |
| Google Chrome | 装在 `/Applications`，用于手动登录 |
| Playwright | 用 fameex-web 仓库里自带的 |
| `FIGMA_TOKEN` | 只有 `figma-read` 的 REST 脚本需要 |

浏览器验证所需的登录态**不用提前准备**：流程会在用到某个站点时检查登录态，失效时提醒你执行登录命令，等你登录期间编码照常进行。

## 使用方法

### 日常编码

不需要任何操作。每个会话都会加载 `AGENT.md`，AI 按里面的路由，在任务命中某个主题时自己去读对应的 skill 或规则文件。

例如：
- 写表单或接口映射，会读 `coding-quality`；
- 照 Figma 还原界面，会读 `figma-read`；
- 做批量迁移、删除实验组这类集合操作，会读 `change-scoping`；
- 在 fameex-web 里写代码，会读 `rules/fameex-local.md`。

### 用 PRD 做新需求（prd-to-commit）

在 Claude Code 或 Codex 里开新会话，发一句话：

```text
用 prd-to-commit，项目号 PR-xxxxx，PRD：<Lark 链接>
```

可以在后面补充以下信息：
- Figma 链接；
- 接口契约（YApi 导出或本地文件路径）；
- 范围限定，比如「只做 web」；
- 「这是 fix」，这样分支会建成 `fix/<ID>`。

整个流程里你只需要介入一次。AI 读完 PRD 后会给出三样东西，然后停下等你回复：
1. 需求清单：每个页面一行，写到具体代码文件；
2. 待确认列表；
3. 执行计划。

你回答待确认里能回答的（尤其是枚举码和接口路径），不确定的就说「按你的判断」。之后它会一路做到本地 commit，**不会 push**。

交付物：
- `~/github/<ID>` 下的 worktree，里面有一个本地 commit；
- 一份交付说明：提交 SHA、上线前必须替换的占位（码值、接口、配置 ID，列到文件:行）、清单完成情况、冷读和浏览器验证的发现、没跑的检查、token 和耗时；
- 过程文件，在 `~/.prd-cache/<ID>/`。

参考成本（v1.6 回放实测，含冷读与全页面浏览器验证）：

| 需求规模 | 耗时 | token |
|---|---|---|
| 小需求 | 19–41 分钟 | 6–16M |
| 中、大需求 | 50–90 分钟 | 45–90M |

更详细的说明见 [labs/prd-to-commit/usage.md](labs/prd-to-commit/usage.md)。

## 项目结构

```text
~/.ai-rules/
├── AGENT.md                    # 常驻全局规则（L1），被 ~/.claude/CLAUDE.md 和 ~/.codex/AGENTS.md 软链
├── scripts/
│   └── check-resident.mjs      # AGENT.md 体量检查（≤7000 字符）
├── skills/                     # 按需加载的 skill，各自软链进工具的 skills 目录
│   ├── coding-quality/         # React/TS 前端质量清单：SKILL.md 做路由，references/ 按主题细分
│   ├── figma-read/             # Figma 读取手艺 + REST 读取脚本
│   ├── change-scoping/         # 集合类改动的边界划定（防漏改、防越界）
│   └── prd-to-commit/          # PRD → commit 流程
│       ├── SKILL.md            # 流程本体（≤150 行、≤18KB）
│       ├── references/         # browser.md（浏览器验证）、fameex.md（仓库已知坑）
│       └── scripts/            # 拉 PRD、建 worktree、检查、起 dev server、浏览器验证、统计
├── rules/                      # 只适用于 FameEX 的个人规则（L2-personal），由 AGENT.md 路由进来
│   ├── fameex-local.md         # git 流程、执行协议、仓库规则锚点
│   └── fameex-feature-module-layout.md
├── labs/
│   └── prd-to-commit/          # 维护 prd-to-commit 用的资产，运行时不读
│       ├── usage.md            # 给人看的使用说明
│       ├── releases.md         # 发版台账 + 观察清单
│       ├── iteration-ledger.md # 逐轮回放得分、耗时、token
│       ├── HANDOFF.md          # 当前状态与下一步
│       ├── replay/             # 回放基准（11 个真实需求）与工具链
│       ├── reports/            # 阶段报告（写成后不再改）
│       └── decisions/          # 流程决策记录
└── backups/                    # 本地备份，不进 git
```

运行时产生的文件不在本仓库里：

| 位置 | 内容 |
|---|---|
| `~/.prd-cache/<ID>/` | PRD 快照、图片转写、清单、计划、run-log、冷读与浏览器结果、spec |
| `~/.prd-cache/_tsc-base/` | base 上的 tsc 结果缓存 |
| `~/.config/prd-to-commit/browser/` | 各站点专用的 Chrome profile 与登录态（state 文件权限 600） |
| `~/.config/prd-to-commit/dev/` | dev server 状态、日志、全机并发上限 `max-dev` |
| `~/github/<ID>` | 每个需求一个 worktree |

## 工作原理

### 规则分层与按需加载

| 层 | 位置 | 加载方式 | 放什么 |
|---|---|---|---|
| L1 常驻 | `AGENT.md` | 每个会话整份加载 | 跨仓库的硬规则，以及「什么任务读哪个文件」的路由 |
| L1 按需 | `skills/*` | 任务命中主题时读，大 skill 再按主题读 `references/` 里的单个文件 | 长清单、手艺、流程 |
| L2 个人 | `rules/*` | 进入对应仓库时读 | 只适用于某个仓库、尚未进团队规则的约定 |
| L2 仓库 | 业务仓库的 `AGENTS.md`、`.cursor/rules/*.mdc` | 只读主题匹配的文件 | 团队共享的仓库规则 |

常驻文件越大，每个会话的固定开销越高，规则也越容易被稀释。所以 `AGENT.md` 只留短硬规则和路由，长内容一律下沉到 skill。

### prd-to-commit 流程

```text
拉 PRD（只一次，落盘到 ~/.prd-cache）
  → 需求清单（PRD 原句 → 页面 → 落点文件）
  → 依赖分批的计划
  → 【用户确认一次】
  → worktree（feature/<ID>，基于 origin/online）
  → 按批次编码（可并行的大块派子 agent）
  → check.mjs（只查改动）
  → 冷读子 agent ∥ 浏览器子 agent
  → 修复（最多 2 轮）
  → 本地 commit + 交付说明
```

靠以下几个机制保证交付质量：

- **清单按页面拆行**：漏需求几乎都漏在「条目 → 具体页面/文件」这一步，所以每个页面单独一行，每行都要找到落点文件。
- **独立冷读**：一个全新上下文的子 agent 只拿 PRD 和 diff，自己从 PRD 推出全部可见行为，再逐条到 diff 里找实现。产出 MISSING、SIBLING-MISSED、MISMATCH 三类问题，不受实现者推理的影响。
- **浏览器验证**：用固定端口的 dev server 加专用 Chrome profile 跑真实页面，按清单逐页写 spec；接口没好的用 mock 构造数据态。
- **只查改动的静态检查**：`check.mjs` 包括以下几项：
  - biome；
  - tsc：改动行上的错误直接报；其余错误和 base 比对，只报本次新增；
  - code-rules：biome 和 tsc 管不到的约定；
  - rsc-hooks：服务端组件误引 hook；
  - legacy Vue2 语法检查；
  - 只跑改动过的测试文件。
- **陷阱规则**：都来自当年真实踩过的提测 bug。例如不编造后端字段、不用兄弟字段做算术反推、不按展示文案反推类型、枚举码未知时用明显非法的占位。

### skill 怎么演进

改 `prd-to-commit` 有固定门槛：
- 同类问题出现 2 次，并且能在回放中复现，才改；
- 改完要用 11 个已上线的真实需求做回放评分，得分不低于上一版、陷阱零违反才放行；
- 放行后打 tag `prd-to-commit-vX.Y[.Z]`，并在 `releases.md` 和 `iteration-ledger.md` 里记录；推送 main 时把 tag 一起推上去（`git push origin 'refs/tags/prd-to-commit-v*'`）。GitHub 上的 tag 列表就是版本历史。

完整纪律见 [labs/prd-to-commit/README.md](labs/prd-to-commit/README.md)。

## 需要特别注意的问题

### 体量上限

- `AGENT.md` ≤ 7000 字符，改完跑 `node ~/.ai-rules/scripts/check-resident.mjs`。
- `prd-to-commit/SKILL.md` ≤ 150 行、≤ 18KB（18432 字节），现在只剩二十几字节余量。要加规则，得先压缩别处。

### Git 与安全

- AI 的权限止于 `git commit`。没有当次明确授权，绝不 `git push`。
- 不用 `--no-verify` 跳过 Husky、lint-staged 和 biome；被 hook 拦下就修代码。
- **在 fameex-web 里禁止 `git stash`**：所有 worktree 共用一个 stash 栈，会串到别的需求。
- 提交时只 `git add` 具体文件，不用 `git add -A`。

### 浏览器验证

- 所有站点连 **dev 环境（pfyys）**，dev 上的写操作默认**真实执行**，交付说明会列出改了哪些 dev 数据。发往其他环境的写操作和所有登出请求一律拦截。不想动 dev 数据时，在 spec 里设 `strictWrites = true`，或者给接口写 mock。
- 需要登录的站点只有三个：`web`、`web-next`、`legacy-admin`。Next 后台和合约后台复用 legacy-admin 的 token，legacy-admin 登录后要先对它跑一次 `browser.mjs check`，另外两个后台才能拿到 token。
- 登录态按环境区分，换环境就要重新登录。不要尝试自动登录或绕过验证码。
- 16G 内存的机器同时最多开 4 个 dev server（`~/.config/prd-to-commit/dev/max-dev`），3 个以上 Next dev 同时冷启动容易卡死。
- `dev.mjs start` 默认会停掉其他 worktree 占着同一端口的 dev server。两个需求会话同时验证同一站点时，加 `P2C_PORT_OFFSET` 或 `--no-steal`。

### 交付物的局限

- **占位必须替换**：后端码值或接口未定时，代码里用明显非法的占位（如 `'-1'`），交付说明会列出文件:行。联调前必须替换，否则功能不生效。
- **legacy Vue2 模板没有编译检查**：check 会报 `not-covered`，需要浏览器或人工核对。`not-covered` 不等于通过。
- **埋点在浏览器里验不到**：dev 环境的 posthog 会丢弃事件，埋点参数靠纯函数单测覆盖。
- **MSW 基建还没进 online**：第一个需要 MSW mock 的需求，会把本地提交 `d4e3f12b86`（分支 `feature/msw-infra`）作为单独一个提交带上，随该需求合入。

### 工具差异

- **Codex CLI 沙箱**：`.git` 是只读的，提交会被打成 bundle 交回；沙箱里也不能监听端口，dev server 要在沙箱外起。Codex 桌面 App 没有这两个限制。
- **Lark 历史版本**：拉历史版本需要文档编辑权限，拉最新版不受影响。

### 已知未修的工具缺陷

不影响单个需求按流程正常跑完，详见 [releases.md](labs/prd-to-commit/releases.md) v1.6.1 节。
- `fetch-prd` 中途失败后，重跑会用到表格未展开的缓存。遇到时删掉 `~/.prd-cache/<ID>/r<rev>/` 重拉。
- 复用 worktree 时如果分支不对，`worktree.mjs` 只警告、不退出。
- 重命名或移动的文件会被当成整份新增来检查，可能报出原有问题。

### 其他

- `~/github/docs_tdd` 已冻结为只读归档。新需求不走它的流程。
- 不要把工作文件放在 `/tmp`，重启会被清空。过程文件统一放 `~/.prd-cache/`。
