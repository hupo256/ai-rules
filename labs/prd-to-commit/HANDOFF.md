# prd-to-commit 迭代交接（2026-10-18 晚，token 用尽暂停）

> 下次接手：先读完本文件，再按「§4 恢复步骤」逐条做。不用重读对话历史。
> 用户原始要求：用 docs_tdd 里已上线的真实项目当新需求，用 prd-to-commit 真实跑，记录数据，对照当时 bug 表，全面优化 skill，让它能自动化 web 开发（准确性、效率、质量、token 都要有保障）；只要结果，不要过程。

## 1. 已完成

### 1.1 基准（11 个，全部基于已上线真实需求）
- 原有 6 个：02306、02022、02265、02273、02172、01930（另有 01507，未参与本轮）。
- 本轮新建 5 个：01973、02006、02074、01947、01988。评分标准 `~/.ai-rules/labs/prd-to-commit/replay/PR-*.md`，PRD 快照 `~/.prd-cache/REPLAY-<号>/`，配置 `replay/tools/bench.json`，均已提交。
- 检查点来自 PRD 原文 + bug 表（Lark 多维表格 `JLwLbtpzQa9qFDslu8RlsROCgoQ / tblixFWWJv0grMMH`，lark-cli `base +record-list` 可拉）。

### 1.2 skill 版本（`~/.ai-rules`，git 仓库，未 push）
| 版本 | 提交 | 要点 |
|---|---|---|
| v1.4 | tag `prd-to-commit-v1.4` | 起点 |
| v1.5-rc → rc6 | 878b815 … 128ce91 | 读图转写子 agent、Explore 落点地图、浏览器验证独立子 agent 与冷读并行、截图预算、范围外泛化、冷读 2b 契约核对、待确认≠不做、显隐条件、同因含被替换展示字段 |
| v1.6-rc | 79be680 | 原型规则细化（正文列举的按钮以正文为准）、已兼容须对照 PRD 核实、≤5 张图自己看、批次 0 最小调用点、literal pathspecs、子 agent 不跑 git；check.mjs 加 rsc-hooks（服务端组件误引 hook）与 legacy `?.`/`??` 拦截；fameex.md/browser.md 补坑 |
| v1.6-rc2 | e2d59d0 | 编码 UI 前必须看原图、已兼容行代入数值验证、浏览器子 agent 后台先派、单工程 ≤10 落点不派 Explore |
| 工具修复 | 886813c、38eb7f2、346df25、01694c9、f6ce506、0112cbb、c3b5f48、f1c5e6d 等 | browser check 不崩、web 端口 `-p`、`--no-steal`、`P2C_PORT_OFFSET`、写接口误放行、auth-fallback.mjs（假登录）、fixture 双键名、**dev.mjs 全机限流 P2C_MAX_DEV=2** |

SKILL.md 当前 18430 字节（上限 18432），再加规则必须先压缩。

### 1.3 回放成绩（详见 `replay/results/2026-10-17-R11-v1.4.md` 与 `2026-10-18-ledger-rows-R12-R16.md`）
| 基准 | v1.4（R11 等） | rc6（R15） | v1.6-rc（R17） |
|---|---|---|---|
| 02306 | 7/7 | 7/7 | 6/7（两次中断续跑） |
| 01947 | 11/13 | **13/13** | 未完成 |
| 01973 | 15/15 | 15/15 | 未完成 |
| 01988 | 15/15 | 15/15 | 未开始 |
| 01930 | 15/15 | 15/15 | 未开始 |
| 02006 | 13/15 | 14/15 | 未完成 |
| 02265 | 12/14 | 12/14 | 未开始 |
| 02273 | 13/14 | 13/14 | 13/14 |
| 02172 | 13/14 | **14/14** | 未完成 |
| 02022 | 12/12 | 11/12 | 9/12 踩 T2（两次中断续跑） |
| 02074 | 12/14 | 10、11/14 | 10/14 |
| 合计 | — | **139/148（93.9%），陷阱 0** | — |

历史首轮（当年人工+旧流程）同口径：新 5 基准净 25/72。成本：rc6 下小需求约 15M、中 28–74M、大 53–108M token，墙钟 32–90 分钟（含浏览器全覆盖）。

## 2. 进行中（中断时状态）

R17 = v1.6-rc 放行回放；R18 = 中断干扰判定用的干净重跑。worktree 都在 `~/github/<RUN>`，过程文件 `~/.prd-cache/<RUN>/`（看 `run-log.md` 末尾定位进度），任务说明 `~/.prd-cache/_bench/<RUN>.prompt`。

| RUN | 进度 | 下一步 |
|---|---|---|
| R17-02006 | 代码写完（35 个未提交），check 全绿，部分浏览器结果在 | 续：重派冷读+浏览器 → 修复 → 提交 |
| R17-01973 | 代码写完（42 个未提交），check 已跑 | 同上 |
| R17-02172 | 代码写完（37 个未提交），check 通过 | 同上 |
| R17-01947 | 代码写了（20 个未提交） | 同上 |
| R17-02265 | 编码中（17 个未提交） | 续编码 |
| R17-01988、R17-01930 | 只建了 worktree + prompt | 从头跑 |
| R18-02022、R18-02306 | 只建了 worktree + prompt（测 rc2） | 从头跑 |
| R17-02022/02074/02273/02306 | 已提交并评分 | 无 |

后台 agent 的会话 ID 在旧会话里，新会话**不要试图 SendMessage 续它们**；直接新开 agent，prompt 写「项目号 X，任务说明在 ~/.prd-cache/_bench/X.prompt；先读 ~/.prd-cache/X/run-log.md 和 git status，从中断处继续，不要重做」。

## 3. 关键教训（已写入记忆）

1. **mac 卡死三次**（16G 内存，同时冷启动多个 Next dev）：dev.mjs 已全机限 2 个；**回放并发 ≤3 且每个间隔 5 分钟启动**，开前看 `uptime` 负载 <15。
2. **/tmp 会被重启清空**：回放工作目录已改到 `~/.prd-cache/_bench`。
3. 中断续跑的回放结果不可信（R17-02022、02306 退步就是这样），放行判定以干净跑为准。

## 4. 恢复步骤（下次按顺序做）

1. `uptime`、`ps aux | grep -c "next dev"` 确认机器干净；`git -C ~/.ai-rules log --oneline -3` 应看到 f1c5e6d 之后的提交。
2. 依次开（每个间隔 5 分钟，最多 3 个同时）：R18-02022、R18-02306（判断 v1.6-rc2 是否回退）→ R17-02006、R17-01973、R17-02172（只差冷读/浏览器）→ R17-01947、R17-02265 → R17-01988、R17-01930。prompt 若丢失：`~/.ai-rules/labs/prd-to-commit/replay/tools/prepare.sh PR-<号> <RUN> <端口偏移>` 重生成（worktree 复用）。
3. 每个回放完成后：`replay/tools/score-prompt.sh PR-<号> <RUN>` 生成评分 prompt，开一个 agent 评分；成本用 `python3 replay/tools/agent-cost.py <RUN>`。
4. 放行判定：11 个基准得分不低于 R15（rc6）且陷阱 0（02074 方差大，单列风险；02022 若 R18 仍丢 C12/T2，回滚 rc2 的读图改动或细化同因扩改规则）。
5. 放行后：
   - 打 tag `prd-to-commit-v1.6`；`releases.md` 顶部加 v1.6 节、`iteration-ledger.md` 并入 `results/2026-10-18-ledger-rows-R12-R16.md` 与 R17/R18 行、`replay/README.md` 补结果记录。
   - 写最终报告 `~/.ai-rules/labs/prd-to-commit/reports/2026-10-xx-final-report.md`（给用户看的结论：成绩对比历史首轮与 bug 表、成本、剩余风险）。
   - 清理已评完的 R11–R18 worktree（`git -C ~/github/fameex-web worktree remove --force <路径>`，先确认无未提交改动）。

## 5. 未决问题 / 观察项

- 02273 C14 BonusModal 精度：连续 7 轮漏，rc2 加了「已兼容代入数值」，待 R17 后续验证。
- 02074：C8（「更多结果」出现条件 PRD 未写）、C13（question vs groupItemTitle）每轮都丢，属口径争议，不立规则。
- 02006 C8 Banner：评分员自认边界争议。
- PRD 正文自相矛盾时「待确认≠不做」与「正文优先」给不出裁决（R15-01930，观察 1 次）。
- 差异率单位 ×100（R11/R14-01988 同基准 2 次，未立规则）。
