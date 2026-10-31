---
name: prd-to-commit
description: 只给 PRD（Lark 链接或正文）+ 项目号时，从拉 PRD 到本地 commit 的极简流程：预检 → 落盘一次 → 需求清单（原句→落点）→ plan 依赖分批 → 用户确认一次 → worktree → 编码 → 改动文件检查 → 冷读与浏览器验证（子 agent 并行）→ 修复 → commit。用于 FameEX Web 新需求；存量 docs_tdd v1/v2 项目不用。
---

# PRD → Commit

目标：第一次就把需求做全，过程尽量短。**不写阶段报告、不跑门禁引擎、不建项目文档目录。**产物只有代码提交、清单、plan 和 run-log。

脚本目录：`~/.ai-rules/skills/prd-to-commit/scripts/`（下称 `$S`）。本文件只保留流程骨架与各阶段的硬规则；每个阶段的细则在 `references/`，**到了那一步必须先完整读对应文件**，没读就等于规则不存在：

| 阶段 | 先读 |
| --- | --- |
| §2 建清单前 | `references/checklist-rules.md`（行怎么写、占位、冲突、校验、落点与同因搜索） |
| §3.5 写 plan 前（§1 转写、§2 Explore 子 agent 不用等它） | `references/delegation.md`（分批、编码/浏览器子 agent 的提示内容、run-log） |
| §4 起 dev server / 浏览器验证 | `references/browser.md` |
| §7 冷读 | `references/coldread-prompt.md`（提示词全文） |
| 碰到 FameEX 具体坑 | `references/fameex.md`（工程归属、App WebView、口径与错误码、i18n、MSW、运行时坑） |

## 0. 预检（拉 PRD 前）

```bash
node $S/preflight.mjs <ID>      # 0 干净 | 10 远端有在途分支 | 20 已合入 online
```

- **10**：停下问用户——是否以该分支的契约层为准、本次用什么分支名；分支里的产出未经用户指定不作为输入。「直接做」模式下用 `--branch feature/<ID>-p2c`，交付说明首行写明远端分支存在。
- **20（复核补缺模式）**：该需求首轮实现已在 base。清单每行先核 base 现状，已满足写「已兼容」，只补偏差；冷读提示加上「复核补缺」那一行（`coldread-prompt.md`）。

## 1. 拉 PRD（只一次）

```bash
node $S/fetch-prd.mjs <ID> <lark-url>          # → ~/.prd-cache/<ID>/r<rev>/{prd.md,prd.xml,media/,sheets/,attachments/,meta.json}
```

- 完整读 `prd.md`。图片（`media/`、Figma 预览）超过 5 张时先派 1 个子 agent 逐张转写（否则自己看）到 `~/.prd-cache/<ID>/media-notes.md`：每张写对应 PRD 位置、页面/状态、**全部可见文字逐字**、红框/标注、与正文的冲突。notes 开头先列每图一行摘要。主会话读 notes 建清单；**编码某页面 UI 前必须看对应原图**核对位置、锚点与布局。之后只在疑点处回查本地文件，不重拉。
- 内嵌表格会自动导出到 `sheets/`，并在 prd.md 里原位展开成 csv 块，要和正文一起读完。附件（HTML/PDF 原型）下载到 `attachments/`，prd.md 原位有标记，只当文本读。`meta.json.unexpanded` 列出的多维表格、iframe 等需要人工查看。
- `meta.json.failed` 非空或 Figma/原型读不到：告诉用户缺什么，继续其余部分。
- 用户另给的输入（接口契约、YApi、附件、Figma）存 `~/.prd-cache/<ID>/inputs/`（仓内文件按原路径存，如 `inputs/apps/web/src/types/financeProduct.ts`，同名文件会互相覆盖），清单、编码、冷读都要引用。
- 用户直接贴正文时，把正文存为 `~/.prd-cache/<ID>/manual/prd.md`。

## 2. 需求清单 `~/.prd-cache/<ID>/checklist.md`

清单是整个流程的核心。漏需求几乎都漏在「条目 → 具体页面/文件」这一步，所以每条都必须落到具体位置：

```markdown
| # | PRD 原句（逐字，附章节/图号） | 端 | 页面/入口（全部列出） | 落点文件（找代码后填） | 文案（逐字，未指定写「未指定」） |
```

- **一个页面一行**。「登录/注册/找回/重置都要…」就拆成 4 行，不许合并成一行。
- 端：`web` / `web-next` / `admin` / `futures-admin` / `非前端`（非前端只留一行说明，不展开）。用户指定只做某端时，其余端标「不做」并注明。
- **目标工程判定先于找落点**：同一业务在 ≥2 个工程/应用有实现（web vs web-next、Next 后台 vs legacy）、或 PRD 写「独立系统/新站点」时，按 `fameex.md`「工程归属」的判据定目标，并把依据写在清单开头；定不了的作为**阻塞问题**在 §3 问用户，直接做模式写在交付说明首行。观察期 3/3 从零需求因此与同事落在不同工程。
- 其余行规则（已兼容、待确认不等于不做、口径字段、占位、镜像契约、冲突、校验、后台落点、同因搜索）全部在 `references/checklist-rules.md`，建清单前读完。

## 3. 用户确认（一次）

给用户看清单、待确认和 §3.5 的计划，**问完就停下等回复**。用户说「直接做」或回放模式下跳过（计划照写）。确认后不再中途打扰，一直做到 §9；真正阻塞（权限、账号、接口完全缺失）时再问一次具体问题，并继续做不受影响的部分。

## 3.5 计划与并行批次 `~/.prd-cache/<ID>/plan.md`

把清单行归并成步骤，每步写：覆盖的清单行、要改/新建的文件、依赖哪些步骤。按依赖分批，每批标明是否派子 agent 及理由。分批判据（批次 0 契约、并行条件、值不值得派）、子 agent 提示必带的内容、i18n 草稿合并、run-log 要求，按 `references/delegation.md`。

## 4. Worktree

```bash
node $S/worktree.mjs <ID> [--fix]              # → ~/github/<ID>，feature/<ID> 基于 origin/online，自动装依赖
```

已存在就复用；远端已有同名分支时脚本拒绝创建（§0 已处理过的用 `--branch <名字>`）。之后改动都在该路径内。

**禁止在 fameex-web 用 `git stash`**：所有 worktree 共用 stash 栈。对比改动前后用 `git show HEAD:<file>` 或临时 worktree。

需浏览器验证时，建完 worktree 就对涉及站点 `dev.mjs start` 后跑 `browser.mjs check`，失效立刻请用户 `login`、编码照常进行；legacy 站点先 `dev.mjs prewarm` 预装（`references/browser.md`）。

## 5. 编码

- 按 §3.5 批次推进，派出的由主会话合并、对齐契约。
- 遵守全局规则和仓库 `AGENTS.md`/`CLAUDE.md`、按主题命中的 `.cursor/rules/*.mdc`、`coding-quality` skill。
- 按清单逐行实现，实现完一行就填上真实落点。
- 文案按 PRD 逐字写入，语言文件范围按仓库规则。含 `&`、`/`、`<` 的文案能直接写就不走插值（会被转义成 `&amp;`）。
- 接口未就绪时按已知契约写好代码，清单标「待联调」，并**自行决定**加最小 MSW mock 把 UI/UX 写全：只为本需求新增/变更的接口写 handler 和 fixture（`src/mocks/<功能>/`，仅 `NEXT_PUBLIC_ENABLE_MSW=true` 生效，业务代码无 mock 分支）。未接入的 app 按 `references/fameex.md` 单独提交补齐（legacy 不接）；**base 无基建且不能引入非 base 祖先提交时不加 MSW**，交付记 `not-required`。接口上 dev 就删 handler，基建保留。边缘数据态写在浏览器 spec 的 mocks 里。
- PRD 要求埋点时，事件参数（步骤序号、来源页等）由纯函数算出并单测断言取值（浏览器验不到埋点）。
- 写操作（绑定/解绑/提交/删除/状态上报）成功后，要让依赖该数据的服务端状态刷新（React Query `invalidateQueries` 用户资料、列表等），不能只关弹窗、弹提示。

## 6. 检查（只查改动）

```bash
cd ~/github/<ID> && node $S/check.mjs [--base <BASE>]   # biome + tsc（改动行 + 比 base 新增的）+ code-rules（豁免写 `// code-rules-ignore <规则号如 CODE-ARCH-001>: <理由>`）；legacy JS/.vue 做语法检查；改动的测试文件跑 vitest
```

手动格式化（`biome check --write`）只传本次改动的文件，不传目录。`not-covered`（如 legacy `.vue` 模板）不算通过，交付说明如实写出。check.mjs 是唯一可信的类型检查入口（macOS 没有 `timeout`，手动 `timeout … tsc` 会静默不执行）。

**浏览器验证（改动涉及可见 UI 时必做）交给浏览器子 agent**，站点 ≥2 时每站点一个、同时派；提示内容按 `references/delegation.md`。§8 修完后用 SendMessage 让**同一个**子 agent 重跑受影响的 spec，只看 report 的通过/失败与 pageerror。跑不了的写 `not-covered: <原因>`，不假装通过。

静态检查通过后，**冷读子 agent（§7）与浏览器子 agent 同时派出**，**两者都返回后才改代码**（先回来的可先列修复方案，改代码会打断 spec）；**结果回来前不进 §8/§9、不结束或交回任务**。

## 7. 独立冷读（必须用子 agent，不能自查）

开一个**全新上下文**的子 agent（Claude 用 Agent 工具；Codex 用新会话或子代理）。只给它 `references/coldread-prompt.md` 里那段话（填好占位），不要附带你的推理过程。

`<BASE>` 默认取 `git merge-base HEAD origin/online` 的结果；回放时用指定的 base commit。冷读前先 `git -C ~/github/<ID> add -N .`，否则 diff 里看不到新建的文件。

## 8. 修复（最多 2 轮）

逐条处理 MISSING/SIBLING-MISSED/MISMATCH：修复，或给出理由（后端原因、PRD 明确不做）。**PRD 正文明确要求的改动，不因冷读的顾虑撤回或降级为 blocker**：实现保留，顾虑列待确认；确实缺数据且 schema 无现成字段才列 blocker。**同因** = 同一业务对象/字段在其他页面、入口、拷贝里的呈现，必须一起改，修复时也做一次同因搜索；**范围外** = 本需求没涉及的其他对象/渠道/类型的已有行为被连带改变，或新功能被泛化到它们身上（如只为 TradFi 做的 Tab 变成遍历全部板块），默认收窄（PRD 要求统一才保留）。同因扩展找不到口径依据时不做，列待确认。修完重跑 §6。

轮次：**第 1 轮修过 MISSING/SIBLING-MISSED，或修复改了 ≥3 个业务文件（不含测试）**，才开第 2 轮，否则主会话逐条核对并在 run-log 记一笔。第 2 轮 = 冷读第 2 轮与浏览器复跑同时派、**都回来后再改**（提示附第 1 轮问题与结论，只复核修复、新 diff、保留理由）。第 2 轮的问题主会话直接修；修的是运行时/视觉问题才让浏览器子 agent再复跑一次受影响 spec，不开第 3 轮冷读；仍有问题交给用户。

## 9. 提交

```bash
cd ~/github/<ID> && git --literal-pathspecs add -- <本次改动的具体文件...> && git commit -m "feat(<ID>): <一句话>"   # 文件多时用 --pathspec-from-file=<file>；--literal-pathspecs 防 [lang]、(group) 被当 glob
```

- 只 `git add` 具体文件，不用 `git add -A`。不 push。
- 被 hook 拦下就修代码，不用 `--no-verify`。
- 沙箱里 `.git` 只读、提交失败时（Codex CLI 常见）：`git bundle create /tmp/<ID>.bundle <base>..HEAD` 打包提交（可先在临时 `GIT_DIR` 里提交），并在交付说明里写明 SHA 和 bundle 路径，由用户 fetch 回来。

## 10. 交付说明（给用户，≤15 行）

包括：提交 SHA；目标工程与依据（§2 判定过的）；**上线前必须替换的占位**（码值、接口路径、配置 ID，逐个列文件:行，注明现在是否会被用户选到）；清单完成情况（✅ / 待联调 / 待确认）；MSW handler 与对应接口；冷读与浏览器发现及处理；哪些检查没跑（`not-required` 或原因）。

交付前运行 `node $S/stats.mjs <ID>`（追加到 run-log），交付说明末尾附一行 token 与墙钟合计。
