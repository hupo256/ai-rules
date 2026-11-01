# 宿主差异（Claude Code / Codex / Cursor）

核心流程（清单规则、冷读提示、同因搜索、验收口径）与宿主无关；下面只写各宿主不同的地方。换 Agent 只改这一个文件。

| 事项 | Claude Code | Codex CLI / App | Cursor |
|---|---|---|---|
| 派子 agent（读图、Explore、编码、冷读、浏览器） | `Agent` 工具；可并行的在**同一条消息**里一次发多个；续跑用 `SendMessage` 到同一个 agent；结果经 SubagentHandback 回主会话 | 子代理或新会话；没有「等待」原语，主会话等报告文件（`coldread-N.md`、`browser-roundN.md`）出现再读 | 无子 agent；冷读改为新开一个对话窗口只贴冷读提示词 |
| 全新上下文冷读 | 新 `Agent`，只给 `coldread-prompt.md` 那段话 | 新会话，同上 | 新对话 |
| dev server / 端口 | 本机直接 `dev.mjs start` | **沙箱禁止监听端口（EPERM）**：由编排方或沙箱外执行 `dev.mjs start`，Codex 只写 spec 和跑 `browser.mjs run`；Codex 桌面 App 无此限制 | 本机直接起 |
| 提交 | 本机 `git commit`（不 push） | 沙箱 `.git` 只读时 `git bundle create /tmp/<ID>.bundle <base>..HEAD`，交付说明写 SHA 与 bundle 路径 | 本机 `git commit` |
| 权限与确认 | 权限模式由用户选；被拒的调用不重试 | 沙箱策略；高风险写操作先停下 | 编辑器内确认 |
| 文件读取 | `Read`（可读 png 截图） | 读文件；截图需另开查看 | 编辑器 |
| 规则加载 | `~/.claude/CLAUDE.md` → `~/.ai-rules/AGENT.md`；Skill 在 `~/.claude/skills`（软链） | `~/.codex/AGENTS.md` → 同一 AGENT.md；Skill 在 `~/.codex/skills`（软链） | 仓库 `.cursor/rules/*.mdc` 按 globs 命中；本 skill 需手动贴 |
| stats | `stats.mjs` 读 `~/.claude/projects` 转录 | `stats.mjs` 读 `~/.codex/sessions` | 无 |
| 回放基准 | `replay/tools/prepare.sh` + Opus agent | `replay/tools/codex-run.sh` | — |
