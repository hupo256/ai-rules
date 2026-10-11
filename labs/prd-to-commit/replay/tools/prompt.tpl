你在做一次需求开发（回放模式）。请严格按 skill 文件 /Users/aven/.ai-rules/skills/prd-to-commit/SKILL.md 的流程执行（先完整读它）。全程中文。

参数：
- 项目号：{{RUN}}
- PRD 已落盘（跳过 §1 的 fetch 脚本）：{{PRD}}/prd.md（可能是 Markdown 与 Lark XML 混排；`<del>` 是删除线；`src="media/..."` 指向同目录 media/ 下的本地图片，必须逐张看；标注「图片未落盘，仅有描述」的只有文字描述可用；如有 sheets/ 也要读）
- 清单、plan、run-log 写到 /Users/aven/.prd-cache/{{RUN}}/
- Worktree 已建好（跳过 §4 脚本）：/Users/aven/github/{{RUN}}，分支 replay/{{RUN}}，base commit {{BASE}}。所有代码改动只在这个目录。check.mjs 用 `--base {{BASE}}`，冷读的 <BASE> 用 {{BASE}}。
- 回放模式：§3 用户确认跳过（plan 照写），待确认项按你最合理的判断处理并在交付说明中列出；不 push。§10 的 stats.mjs 不用跑。
- 范围：{{SCOPE}}

公平性约束（违反则回放作废）：
- 不得查看 {{BASE}} 之后的任何 git 历史、其他分支或提交（不要运行 git log --all、git show <其他提交>、git branch -a 等）。
- 不得读取 /Users/aven/.ai-rules/labs（回放基准与评分标准）、/Users/aven/github/docs_tdd、/Users/aven/github/auto_pilot、/Users/aven/github/fameex-web（主仓工作区）、其他 ~/github/REPLAY-* 或 PR-* 目录，以及 ~/.prd-cache 下除 {{RUN}} 以外的目录。
- 只用 PRD 原文和 worktree 中的代码。冷读子代理的提示里也要带上这些约束（填进 <额外约束>）。

完成后把交付说明同时写入 /tmp/p2c-bench/{{RUN}}.out，并输出：提交 SHA 与改动文件列表；清单要点与待确认/待联调；冷读各轮发现与处理；check.mjs 输出摘要（含 not-covered）；skill 哪里不清楚或多余（简短）。
