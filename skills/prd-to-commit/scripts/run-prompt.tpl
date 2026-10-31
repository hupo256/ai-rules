你在做一次真实需求开发。请严格按 skill 文件 /Users/aven/.ai-rules/skills/prd-to-commit/SKILL.md 的流程执行（先完整读它；它要求在各阶段先读 references/ 下的对应文件，必须照做）。全程中文。

参数：
- 项目号：{{ID}}
- §0 预检已由编排方完成（结论：{{PREFLIGHT}}），不要再跑 preflight.mjs。
- PRD 已落盘（跳过 §1 的 fetch 脚本）：{{PRD}}/prd.md（图片在同目录 media/，sheets/ 已展开在 prd.md 内，附件在 attachments/；meta.json 记录映射）。{{INPUTS}}
- 清单、plan、run-log 写到 /Users/aven/.prd-cache/{{ID}}/
- Worktree 已建好（跳过 §4 脚本）：/Users/aven/github/{{ID}}，本地分支 {{BRANCH}}，base commit {{BASE}}。所有代码改动只在这个目录。check.mjs 用 `--base {{BASE}}`，冷读的 <BASE> 用 {{BASE}}。
{{MODE_LINES}}
- 并发约束：可能有别的需求同时在跑。所有 `dev.mjs`/`browser.mjs` 命令前加 `P2C_PORT_OFFSET={{OFFSET}}`，`dev.mjs start` 一律带 `--no-steal`；返回 4（端口占用）或输出 `waiting-slot` 时先做不依赖浏览器的事，不要绕过、不要手动起 dev。本需求同一时间最多 {{MAX_DEV}} 个 dev server；结束前 stop 自己起的全部 dev server。
- 效率：按 delegation.md 判定可并行的批次，**在同一条消息里一次发出多个 Agent 调用**才是真并行；冷读与浏览器子 agent 同样在同一条消息里一起派。
- 环境事实：macOS 没有 `timeout` 命令；类型检查以 check.mjs 输出为准。lark-cli `--output`/`@file` 只接受相对路径。

数据公平性（本次实跑用于 skill 迭代数据，违反则数据作废）：
- 远端可能已有同事的同名分支：**不得查看**任何非 {{BASE}} 祖先的提交或分支（不要 git log --all、git show 其他分支、git branch -a、git fetch 他人分支）。
- 不得读取 /Users/aven/.ai-rules/labs、/Users/aven/github/docs_tdd、/Users/aven/github/fameex-web（主仓工作区）、其他 ~/github/PR-*、R*-* 目录，以及 ~/.prd-cache 下除 {{ID}} 以外的目录。
- 不得把 dev 环境真实返回的码值/字段当契约（浏览器连 dev 只为跑页面，看到的真实码值只能记待联调）。冷读、浏览器子代理的提示里也要带上这些约束（填进 <额外约束>）。

run-log 要求：每条时间用 `date` 取真实时间；记录每个阶段起止、每个子 agent 的用途/返回摘要/tool 次数与 token（任务通知里的 usage）、返工原因、偏离 skill 的地方与原因、工具问题。

完成后把交付说明写入 /Users/aven/.prd-cache/_runs/{{ID}}.out，并在最终回复里输出：提交 SHA 与改动文件数；目标工程与依据；清单要点与待确认/待联调/占位（联调前不可用的首行写明）；冷读、浏览器各轮发现与处理；check.mjs 摘要（含 not-covered）；子 agent 数量与 usage 合计；墙钟起止；skill 哪里不清楚、多余或互相冲突（简短）；实际读了 references/ 下哪些文件、在哪一步读的。
