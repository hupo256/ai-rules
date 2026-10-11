# prd-to-commit 使用说明

> 当前版本与改动见 [releases.md](./releases.md) · 实测数据见[最终报告](./reports/2026-10-11-final-report.md)

## 怎么开始

在 Claude Code 或 Codex 里开一个新会话，发一句话：

```text
用 prd-to-commit，项目号 PR-xxxxx，PRD：<Lark 链接>
```

需要的话，可以在后面补充：

- Figma 链接
- 接口契约，可以给 YApi 导出或本地文件路径
- 范围限定，比如「只做 web」「只做后台」
- 修 bug 时说一句「这是 fix」，分支会建成 `fix/<ID>`

## 你只需要介入一次

AI 读完 PRD（内嵌表格和图片会自动落盘、展开）后，会给你三样东西，然后**停下来等你回复**：

1. **需求清单**：每个页面一行，写到具体的代码文件。
2. **待确认列表**：后端码值、接口字段、PRD 自相矛盾的地方等。
3. **执行计划**。

你要做的：

- 回答待确认里你能回答的，尤其是**枚举码、接口路径**。这一步答得越全，交付越完整。
- 不确定的就说「按你的判断」。

之后它会一路做到本地 commit，中间不打扰你。

## 你会拿到什么

- `~/github/<ID>` 下的 worktree，里面有一个本地 commit。**不会自动 push**。
- 一份交付说明，包含：
  - 提交 SHA
  - **上线前必须替换的占位**：码值、接口、配置 ID，列到文件:行
  - 清单完成情况
  - 冷读发现了什么、怎么处理的
  - 哪些检查跑了，哪些没跑
  - token/耗时统计
- 过程文件在 `~/.prd-cache/<ID>/`：checklist.md、plan.md、run-log.md。

## 预期效果（2026-10-11 回放实测，详见[最终报告](./reports/2026-10-11-final-report.md)）

| 需求规模 | 耗时 | token |
|---|---|---|
| 小（<15 个文件） | 10–22 分钟 | 4–13M |
| 中（15–30 个文件） | 23–34 分钟 | 20–36M |
| 大（30–40 个文件，跨 4 个工程） | 约 36 分钟 | 约 33M |

历史上同类需求是 73–208M token、活跃 3–12 小时。

## 需要知道的限制

- **浏览器核对已打通**（2026-10-11）：web、admin、legacy-admin、futures-legacy-admin 四个站点用固定端口的 dev server 加专用浏览器 profile 跑真实页面，**连 dev 环境**（接口先发 dev 联调，dev 也更好操作）。接口没好时，AI 会自行加最小化的 MSW mock 把页面写全，只在本地开发、开关打开时生效，接口上了 dev 就删；交付说明会列出这些 mock。写操作在 dev 上默认真实执行（交付说明会列出改了哪些 dev 数据），发往其他环境的写操作一律拦截。你只需要登录两次（web、现货后台；登录态按环境区分，换环境后要重新登录一次），登录态失效时 AI 会提示你执行 `node ~/.ai-rules/skills/prd-to-commit/scripts/browser.mjs login --site <web|legacy-admin>`。详见 skill 的 `references/browser.md`。后台各页面的验证脚本细节后续再补。
- **legacy Vue2 模板没有编译检查**：check 会报 `not-covered`，需要人工核对。
- **Codex CLI**：沙箱里 `.git` 是只读的，提交会失败，它会把提交打成 bundle。用 Codex 桌面 App 没有这个问题。
- **Lark 历史版本**：需要文档编辑权限，平时拉最新版不受影响。

## 维护规则

- skill 在 `~/.ai-rules/skills/prd-to-commit/`，用 git 管理，tag 是 `prd-to-commit-v1.x`；每次打 tag 都在 [releases.md](./releases.md) 记一节，并在 [iteration-ledger.md](./iteration-ledger.md) 记回放结果。
- 要改 skill，必须先满足两个条件：同类问题出现 2 次，并且能在回放里复现。改完要用 [`replay/`](./replay/README.md) 的基准回放验证，没有改善就撤回。
- 体量上限：SKILL.md 不超过 150 行、18KB。超了先精简，再加新规则。
- 回放工具在 [`replay/tools/`](./replay/tools/)：
  - `prepare.sh <基准> <RUN>`：建 worktree，生成 prompt。
  - `score-prompt.sh`：生成评分 prompt。
  - `run-cost.py`：统计这次回放的 token 和耗时。
  - `codex-run.sh`：用 Codex CLI 跑回放。
