# Claude Code 第二阶段：web 前端项目最佳实践（2026-11-01）

- 来源文章：《Claude Code 用到第二阶段，最容易卡在这 8 个问题》（码哥 / 脚本之家，2026-08-23）。逐节读书笔记与两张图见 [2026-11-01-claude-code-stage2-8-problems.md](./2026-11-01-claude-code-stage2-8-problems.md)，本文不重复摘要。
- 引用核对：文中引用的往期（061 skills.sh vs plugin、062 拆 system prompt、071 PPT Skill、072 PDF Token Saver、073 sense 代码图谱）正文无外链。能找到的原始出处：073 → 掘金《给 Claude Code 装代码图谱，工具调用少 47%》（sense 官方 A/B：工具调用 19→10、Token 228K→156K、成本 $0.42→$0.31、质量不降）；072 → GitHub Marktechpost/Token-Saver（BM25+embedding 混合检索，20 页约省 14%、300 页约省 94%，README 不讲图表与扫描件）；Skill 写法 → 作者博客园《我写了 50 个 Claude Code Skill 才发现，前 30 个都白写了》（七个反模式）。文末 5 条链接是公众号推荐位，与主题无关。
- 官方核对：按 Claude Code 2.1.289 的官方文档（skills / memory / cli-reference / mcp）逐条核过，文章判断方向都对，细节有 6 处要修正或补强，见 §1。
- 一句话：**文章的八个问题在前端项目里全部成立，但落点不是「再装一个 Skill」，而是把「全局行为 / 项目事实 / 任务流程 / 本轮边界」四层各归其位，并把「索引 ≠ 真相」的规矩延伸到前端自己的那堆缓存（TS 类型、Storybook、mock、Figma 节点、构建缓存）。**

## 1. 文章结论 vs 官方口径（先对齐事实）

| 文章说法 | 官方口径（2.1.289） | 对前端项目的影响 |
|---|---|---|
| 同名 Skill 多处存在会「抢着发言」，只留一个权威来源 | 同名时固定优先级：企业 > 个人（`~/.claude/skills`）> 项目（`.claude/skills`）；plugin Skill 自带命名空间永不冲突；项目根与子目录 Skill 都加载，子目录的叫 `/apps/web:deploy` | 个人目录里的 Skill 会**静默压掉**项目同名 Skill。项目级 Skill 用前缀命名（`fameex-*`），别和个人目录撞名 |
| description 要写「什么时候用我」 | 只有 `description`（+ `when_to_use`）常驻上下文，正文在触发后才加载；两者合计 1,536 字符截断，关键用例放最前；`disable-model-invocation: true` 会把描述从上下文移除，只能 `/name` 手动调 | 前端 Skill 的 description 要写用户真会说的话（「接 Figma」「改 schema」「加 loading 态」）和排除项（`Do not use for ...`） |
| 工作流别写进 CLAUDE.md | CLAUDE.md 建议 < 200 行；多步流程 → Skill；只对部分文件有效的规则 → `.claude/rules/*.md` 带 `paths:` 前置元数据，碰到匹配文件才加载；`@import` 只是组织方式，**不省上下文** | fameex-web 的 CLAUDE.md 180 行 + AGENTS.md 113 行，超了；Admin UI / Icon / Page UI 这类分区规则应改成 path-scoped rules |
| （未提）同时有 AGENTS.md 和 CLAUDE.md | 工作目录或其上层**只要有** `CLAUDE.md` / `.claude/CLAUDE.md` / `CLAUDE.local.md`，就**只读 CLAUDE.md，不读 AGENTS.md**；要两份都读，在 CLAUDE.md 里写 `@AGENTS.md` 或把 `/config` 的 Project instructions 改为 `claude-md-and-agents-md` | fameex-web 的 `AGENTS.md`（真正的规范）当前没被 Claude Code 自动加载，只靠 `fameex-local.md` 里「读 AGENTS.md」那句手动补救 |
| `--system-prompt` 替换、`--append-system-prompt` 追加 | 一致。另有 `--system-prompt-snapshot off` 用于迭代追加文本；`--exclude-dynamic-system-prompt-sections` 提升多机缓存命中 | 追加文本只放三类：安全边界、本会话权限、输出格式。能用权限旗标表达的别写进提示词：`--disallowedTools "Bash(git push *)"` 比「禁止 push」可靠 |
| MCP 接 20 个会误路由，先接少量 | 工具搜索默认开启：会话启动只加载**工具名 + server instructions**，工具定义按需加载，服务器数量对上下文影响小；server instructions 与常驻工具描述 4,096 字符截断、延迟加载的工具描述 16,384 字符截断，关键词要放前面；输出超 10,000 token 告警、默认上限 25,000 token | 数量不再是主要问题，**描述质量**才是：路由靠 server instructions 的前几行。Figma / Lark / Playwright 这类 MCP 要在 instructions 里写「什么任务来搜我、返回后怎么核」 |
| 排障先查链路再改 Prompt | 官方给了现成工具：`/context` 看哪些 memory 文件真的加载了；`/doctor prompt-audit` 扫过期/冲突指令；`claude mcp list` / `claude mcp get <name>` 看 `Issue:` 行 | 先跑这三条，再怀疑模型 |

另外两条官方事实，文章没提但前端项目常踩：

- CLAUDE.md 是**上下文不是强制**。要硬拦（禁 push、禁改 `online` 分支、禁 `pnpm i`），用 PreToolUse hook 或 permissions deny，不要靠大写「绝对不要」。
- `.mcp.json` 里 `${VAR}` 会展开，`ANTHROPIC_API_KEY` 等凭证变量在远程 `url` / `headers` 里读为空，防项目配置外泄；项目级 MCP 首次要在交互会话里批准。

## 2. 四层在前端项目怎么放

判断标准沿用文章那句：**这句话复制到另一个项目还成立吗。** 成立放全局；不成立放项目；只做某类任务才用做 Skill；只对本轮有效写进对话。

### L0 全局行为：system prompt / `--append-system-prompt` / 权限

- 只追加三类：安全边界（本会话只改 `apps/web/`、不碰 `apps/web-next/` 的登录入口）、权限范围（不执行发布、不 `git push`）、输出格式。
- 能用旗标或 settings 表达的，不写进提示词：`--permission-mode plan` 先规划、`--disallowedTools "Bash(git push *)" "Bash(pnpm i*)"`、`--tools` 限制内置工具。
- 互相冲突的约束不要同时塞（「先规划再改」vs「立即改」；「每条命令确认」vs「无人值守」）。
- 永远不要用 `--system-prompt` 补一条规则，它会把默认的工具使用策略整个换掉。

### L1 用户级 CLAUDE.md（`~/.ai-rules/AGENT.md`，软链到 `~/.claude/CLAUDE.md` 与 `~/.codex/AGENTS.md`）

- 只放跨项目仍成立的手艺规则：React/TS 硬规则、验证经济学、子代理分工、按需加载路由。现在 4.9KB / ≤ 7000 字符预算，是对的。
- 不放：任何仓库的命令、分支名、目录名、测试号。这些一旦进全局，换仓库就带着旧地图（文章 §3 的「旧表名」）。
- 「按需加载路由」（命中主题才读某个 skill 文件）本质是手工版的 Skill 路由。保留它，但每条路由句子要和对应 Skill 的 description 说同一件事，否则两套触发条件会打架。

### L2 项目级：CLAUDE.md + `.claude/rules/` + `CLAUDE.local.md`

- 一个项目一份事实源。fameex-web 现在 `CLAUDE.md`（泛介绍）与 `AGENTS.md`（真规范）并存且**未导入**，Claude Code 只读前者。两条路选一：
  1. `CLAUDE.md` 顶部加一行 `@AGENTS.md`，并把 CLAUDE.md 里和 AGENTS.md 重复的架构介绍删掉，只留 Claude 专有的内容；或
  2. 删 `CLAUDE.md`，让 Claude Code 直接读 `AGENTS.md`（2.1.277+ 支持），Codex 也读同一份。推荐第 2 条，一份文件两个宿主，和 `~/.ai-rules/AGENT.md` 的做法一致。
- 常驻正文只留「每轮都要知道」的事实，目标 < 200 行：技术栈、`pnpm test`（vitest --run）/ `pnpm type-check` / `pnpm lint` 怎么跑、apps 与 packages 边界、禁区（`auth-entry-web-next-only`）、git flow（feature/fix 独立升级，never `--no-verify`）。
- 分区规则下沉到 `.claude/rules/<topic>.md` 带 `paths:`。例如：

  ```markdown
  ---
  paths:
    - "apps/admin/**/*.{ts,tsx}"
    - "apps/futures-admin/**/*.{ts,tsx}"
  ---
  # Admin UI
  - 表格列定义走 columns 常量，不在 JSX 里内联 ...
  ```

  这样「Admin UI / Admin Routing / Icon / Page UI」只在碰到对应文件时进上下文。
- `.cursor/rules/*.mdc` 现有 40 个文件是 Cursor 的适配层，Claude Code 不会发现 `.mdc`。不要手工维护第三份：要么把 `.mdc` 的正文当核心层、用脚本生成 `.claude/rules/*.md`（只改前置元数据），要么在 CLAUDE.md 里按主题前缀点名（现状 `fameex-local.md` 的做法），二选一，别两头都写。
- 个人沙箱地址、测试号、本地端口放 `CLAUDE.local.md` 并 gitignore；多 worktree 共用的话改成 `@~/.claude/fameex-local-prefs.md` 导入。注意：一旦项目里有 `CLAUDE.local.md`，AGENTS.md 就不再自动加载（见 §1），所以第 2 条路要配合 `/config` → Project instructions = `claude-md-and-agents-md`。

### L3 Skill：可复用的任务流程

- 前端项目典型的四类 Skill，对应现有的四个：需求交付（`prd-to-commit`）、质量清单（`coding-quality`）、设计稿读取（`figma-read`）、改动边界（`change-scoping`）。这个切分是对的：每个都能说清触发条件、输入、验收。
- description 写法（1,536 字符上限内，关键用例放最前）：
  - 触发短语用用户原话：「接 Figma」「还原设计稿」「改 schema / mapper」「加 loading / empty / error 态」「把 X 类都改成 Y」。
  - 写排除项：`Do not use for pure copy changes` / `日常改单一实体不必读`（change-scoping 已这么写）。
  - 正文 ≤ 500 行，细则拆 `references/`，主文件只给流程与 Gotchas。
  - 副作用型流程（发布、推 MR、重启服务）加 `disable-model-invocation: true`，只允许 `/name` 手动触发。
- Skill 里不写工具调用细节（那是 MCP 的事），只写「什么时候用哪个工具、返回后怎么核」。
- 排障顺序固定：`/skill-name` 显式调一次 → 能跑说明发现层和执行层通，查 description → 不能跑查路径和命令。显式调用失败就别改 description。

### L4 本轮对话：任务边界

- 每个任务开头三句话：改哪些目录、不改什么、什么算完成（跑哪条测试、看哪个页面）。这是最便宜的路由证据，也是 MCP 会不会被选中的决定因素（「先用 Figma 取节点再对现有组件」vs「还原这个页面」）。

## 3. 「索引 ≠ 真相」在前端对应什么

文章 §7 讲代码图谱是缓存不是真相，三条规矩：先查更新时间与分支；图谱只缩小范围，命中文件必须回源读；写操作再看测试与调用方。前端项目没接图谱也有一堆同性质的「索引」，规矩照搬：

| 前端里的「索引」 | 过期方式 | 回源动作 |
|---|---|---|
| TS 类型 / 自动生成的 API 类型 | 后端 schema 变了，生成物没重跑 | 以接口真实返回和 schema 文件为准，`pnpm type-check` 只是下限 |
| MSW mock（`apps/web/src/mocks`） | mock 数据按旧契约写，真实接口已改 | mock 只做开发态，验收在 pre / uat 真实环境（AGENTS 规则：uat 可用 verify.envAccounts 测试号） |
| Storybook | 组件改了 story 没改 | 验收以页面实际渲染为准，story 只是入口 |
| Figma 节点数据 | 设计稿改版、节点被替换 | `figma-read` 的原子节点核对（圆角 / 描边 / 品牌色），截图与节点数据对照 |
| i18n key 表 | key 删了、文案改了 | 源码里 key 字面量 + `i18n:sync`，不信 IDE 缓存 |
| `.next` / Turbo / tsbuildinfo 缓存 | 切分支后残留 | 行为诡异先 `pnpm clean`，再怀疑代码 |
| 代码图谱（若接） | 刚改完未增量、分支切换、`dist`/`legacy` 产物被扫入 | 每天进项目 `sense scan`；排除 `.next` `dist` `node_modules` 与 legacy 产物目录；只用它缩范围 |

fameex-web 是 7 个 app + 11 个 package 的 monorepo，跨包调用多、同名符号多，属于文章说「值得接图谱」的类型。但先用 `tsc --noEmit` + grep 跑两周，统计 Agent 反复翻源码的次数，再决定接不接；接了也把省下的调用用于验证，不是省略验证。

## 4. 「文字走检索，图走多模态」在前端对应什么

文章 §8 的核心：文本抽取拿不到箭头方向和颜色分组，图表问题必须保留视觉通道。前端的对应物：

- PRD：`lark-cli` 拉下来的是文本，流程图、原型图、状态流转表要**另存图片**并让模型看图。`prd-to-commit` 的「落盘一次」要把图一起落。
- 设计稿：Figma 的节点 JSON 是「文本抽取」，截图是「视觉通道」。两路合并：几何、颜色、圆角从节点取，整体布局与层级从截图核。
- 验收：DOM 断言是文本通道，截图对比是视觉通道。涉及布局、动效、响应式的改动必须跑真浏览器截图，这和全局规则「不写 `.test.tsx`、用浏览器验」一致。
- 表格数字（接口字段、金额、状态枚举）：先文本取，再对原页核，防列错位、单位错。

## 5. MCP 在前端项目的接法

- 先接高价值的三类：设计（Figma）、需求与协作（Lark）、浏览器（Playwright / 内置浏览器）。其余按需。
- 每个 MCP 的 server instructions 前 200 字说清三件事：处理哪类任务、什么时候来搜我、返回后怎么核（「取到节点后仍需对照仓库现有组件与 token」）。4,096 字符外的内容模型看不到。
- 四步排障照文章图 2，但用官方命令：

  ```bash
  claude mcp list                 # ① 注册 + 健康状态
  claude mcp get <name>           # ② 看 Issue: 行、环境变量是否展开
  # ③ 描述：读 server instructions 前几行，是否写了触发时机与核对要求
  # ④ 路由：任务里点名第一步「先用 X 查，再回源」，缩小工具集合再试
  ```

- MCP 返回是线索不是结论：Figma 节点 → 回源看现有组件；Lark PRD → 回源看图；浏览器截图 → 回源看 DOM。

## 6. 一套 Skill 给 Claude Code 和 Codex 用

现有做法已经是文章说的「核心层 + 适配层」：核心层在 `~/.ai-rules`，两个宿主各用软链挂。要补的是把适配层说明确：

| 内容 | 放哪 |
|---|---|
| 检查清单、领域术语、流程、验收标准 | 核心层 `~/.ai-rules/skills/*/SKILL.md` |
| 文件路径、命令 | 核心层，但只写仓库相对路径和 `pnpm` 脚本名 |
| MCP 工具名（`mcp__claude_ai_Figma__*`）、`/doctor`、`/context` 这类宿主命令 | 适配层：Claude 专用说明放 `references/claude-code.md`，Codex 专用放 `references/codex.md`，主文件只写「用设计稿读取工具」 |
| 权限、确认机制、`disable-model-invocation` | 各宿主单独配，不复制 |

自检命令：`grep -rn "mcp__\|/doctor\|/context\|--append-system-prompt" ~/.ai-rules/skills/*/SKILL.md`，命中的行就是混进核心层的宿主绑定。

## 7. 体检脚本（前端 + 双宿主版）

文章的 `claude-code-doctor.sh` 只查「目录在不在」。按官方规则补四项：散落的 `.md` 不会被当 Skill、同名 Skill 跨层级遮蔽、description 缺失或占位、CLAUDE.md 行数与 AGENTS.md 是否被遮蔽。只读，不改任何配置。

```bash
#!/usr/bin/env bash
# 用法：在项目根目录执行。只读。
set -u
proj="$(pwd)"
echo "project: $proj"

echo "## skills"
for dir in "$HOME/.claude/skills" "$HOME/.codex/skills" "$proj/.claude/skills"; do
  [ -d "$dir" ] || { echo "missing: $dir"; continue; }
  find "$dir" -maxdepth 1 -name '*.md' -print | sed 's/^/loose-md-not-a-skill: /'
  for f in "$dir"/*/SKILL.md; do
    [ -f "$f" ] || continue
    name=$(basename "$(dirname "$f")")
    desc=$(awk '/^---$/{c++; next} c==1 && /^description:/{sub(/^description:[ ]*/,""); print; exit}' "$f")
    len=${#desc}
    flag=""
    [ "$len" -eq 0 ] && flag="NO-DESCRIPTION"
    printf '%s' "$desc" | grep -qi 'TODO' && flag="PLACEHOLDER"
    [ "$len" -gt 1536 ] && flag="OVER-1536"
    echo "skill: $name desc=${len}c lines=$(wc -l <"$f") ${flag}"
  done
done
echo "## duplicate skill names across user/project (user wins silently)"
{ ls "$HOME/.claude/skills" 2>/dev/null; ls "$proj/.claude/skills" 2>/dev/null; } | sort | uniq -d

echo "## instructions"
for f in CLAUDE.md .claude/CLAUDE.md CLAUDE.local.md AGENTS.md; do
  [ -f "$proj/$f" ] && echo "$f: $(wc -l <"$proj/$f") lines"
done
if [ -f "$proj/AGENTS.md" ] && { [ -f "$proj/CLAUDE.md" ] || [ -f "$proj/.claude/CLAUDE.md" ] || [ -f "$proj/CLAUDE.local.md" ]; }; then
  grep -q '@AGENTS.md' "$proj/CLAUDE.md" "$proj/.claude/CLAUDE.md" 2>/dev/null \
    || echo "WARN: AGENTS.md is shadowed by CLAUDE.md and not imported"
fi
ls "$proj/.claude/rules" 2>/dev/null | sed 's/^/rule: /'

echo "## mcp"
[ -f "$proj/.mcp.json" ] && echo "project .mcp.json present" || echo "no project .mcp.json"
command -v claude >/dev/null && { claude --version; claude mcp list 2>&1 | head -20; } || echo "claude: not in PATH"
```

脚本正常而 Skill 仍不触发：回到 description 和本轮任务描述查路由；MCP 仍不调用：看 server instructions 前几行。

## 8. 对本机与 fameex-web 的行动清单（按收益排序）

1. **fameex-web 事实源二选一**：删 `CLAUDE.md` 让 Claude Code 直接读 `AGENTS.md`，或在 `CLAUDE.md` 顶部 `@AGENTS.md` 并删掉重复的架构介绍。现状是 180 + 113 行、两份且后者没被加载。
2. **AGENTS.md 分区规则下沉**：Admin UI、Admin Routing、Icon、Page UI 四节改成 `.claude/rules/<topic>.md` 带 `paths:`，常驻正文压到 200 行内。
3. **`.cursor/rules/*.mdc` 与 `.claude/rules` 定一个源**：不手工维护两份。
4. **清理散落文件**：`~/.claude/skills/tailwind-cleanup.md` 是裸文件，永远不会被发现，改成 `tailwind-cleanup/SKILL.md` 或删；`~/.codex/skills/lark-read` 的 description 还是 `[TODO: ...]` 占位，补上或删，并决定它是否进核心层（现在只有 Codex 有）。
5. **在 fameex-web 跑 `/doctor prompt-audit` 和 `/context`**：前者找过期与冲突指令，后者确认实际加载了哪些 memory 文件。
6. **项目级 Skill 一律带前缀**（`fameex-*`），避免被个人目录同名 Skill 静默遮蔽。
7. **硬约束改成硬拦**：「不 push」「不 `--no-verify`」「不碰 `online`」用 permissions deny 或 PreToolUse hook 落地，CLAUDE.md 里只保留一句说明。
8. **代码图谱先观察两周再决定**；接的话用 sense，每天 `sense scan`，排除构建产物目录。
