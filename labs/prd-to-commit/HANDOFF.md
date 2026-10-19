# prd-to-commit 迭代交接（2026-10-19 11:45，用户要求暂停存档）

> 下次接手：先读完本文件，再按「§4 恢复步骤」逐条做。不用重读对话历史。
> 用户原始要求：用 docs_tdd 里已上线的真实项目当新需求，用 prd-to-commit 真实跑，记录数据，对照当时 bug 表，全面优化 skill，让它能自动化 web 开发（准确性、效率、质量、token 都要有保障）；只要结果，不要过程。最新要求：一次跑 4 个回放、dev server 上限 4（不行再降）；尽快出结果让 prd-to-commit 上线。

## 1. 已完成

### 1.1 基准（11 个，全部基于已上线真实需求）
- 原有 6 个：02306、02022、02265、02273、02172、01930；本轮新建 5 个：01973、02006、02074、01947、01988。
- 评分标准 `replay/PR-*.md`，PRD 快照 `~/.prd-cache/REPLAY-<号>/`，配置 `replay/tools/bench.json`。bug 表：Lark 多维表格 `JLwLbtpzQa9qFDslu8RlsROCgoQ / tblixFWWJv0grMMH`。

### 1.2 skill 版本（`~/.ai-rules`，git 仓库，未 push，未打 v1.6 tag）
| 版本 | 提交 | 要点 |
|---|---|---|
| v1.4 | tag `prd-to-commit-v1.4` | 起点 |
| v1.5-rc → rc6 | 878b815 … 128ce91 | 读图转写子 agent、Explore 落点地图、浏览器验证独立子 agent 与冷读并行等 |
| v1.6-rc / rc2 | 79be680 / e2d59d0 | 原型规则细化、已兼容代入数值、批次 0 最小调用点、check.mjs 加 rsc-hooks 与 legacy `?.`/`??` 拦截 |
| v1.6-rc3 | e54db24 | 冷读/浏览器子 agent 结果先写 `~/.prd-cache/<ID>/coldread-N.md`、`browser-roundN.md` 再返回，中断后读文件续 |
| v1.6-rc4 | 8d0ddbf | 埋点参数由纯函数算出并单测断言取值；§8 第 2 轮冷读门槛 = 改 ≥3 个业务文件（不含测试） |
| v1.6-rc5 | 08b5acf | PRD 列了展示名时建「码→展示名」映射，不直出（02172 C14 四次丢） |
| v1.6-rc6 | a184479 | 禁止按展示文案/i18n label 反推类型，仓内已有此写法也不沿用（R17-02265 踩 T2） |
| 工具 | af26ce4、e86a60e、160327e、8a84f9a、e9b9552 | dev.mjs 全机上限默认 4 且可热调（`~/.config/prd-to-commit/dev/max-dev`）；rsc-hooks 起点已有 hook 记 pre-existing；dev.mjs stop 自动还原 next-env.d.ts；**dev.mjs start 自动把被提升成 3.2.0 的根 `@heroui/react` 临时指回 app 声明版本、stop 还原**（不再需要副本）；browser.md 副本须用 /private/tmp 真实路径 |

SKILL.md 当前 **18432 字节 = 上限**，再加规则必须先压缩。

### 1.3 回放成绩（逐轮细节见 `replay/results/2026-10-17-R11-v1.4.md` 末尾、`2026-10-18-ledger-rows-R12-R16.md`）
| 基准 | R15（rc6，放行基线） | v1.6 当前最好可信结果 | 状态 |
|---|---|---|---|
| 01973 | 15/15 | 15/15（R17） | ✅ |
| 01947 | 13/13 | 13/13（R17） | ✅ |
| 02022 | 11/12 | **12/12**（R18 干净跑；R17 中断续跑 9/12 踩 T2 判为中断干扰） | ✅ |
| 02306 | 7/7 | 7/7（R18 干净跑） | ✅ |
| 02273 | 13/14 | 13/14（R17） | ✅ |
| 02172 | 14/14 | 13/14（R17，丢 C14 → rc5） | 待 R19 验证 |
| 02265 | 12/14 | 8/14 踩 T2（R17 → rc6） | 待 R19 验证 |
| 02006 | 14/15 | 13/15（R17 中断续跑） | 待 R19 干净跑 |
| 02074 | 10–11/14 | 10/14（R17） | 方差大，单列风险，可不重跑 |
| 01988 / 01930 | 15/15 / 15/15 | 不重跑（三版本均满分，v1.6 改动不涉及） | ✅ |

历史首轮（当年人工+旧流程）同口径：新 5 基准净 25/72；R15 全体 139/148（93.9%）。

## 2. 暂停时进行中（4 个 R19 回放，均已停 agent、停 dev server，代码未提交但都在 worktree 里）

worktree `~/github/<RUN>`，过程文件 `~/.prd-cache/<RUN>/`（run-log.md 末尾 = 进度；coldread-N.md / browser-roundN.md 已落盘），任务说明 `~/.prd-cache/_bench/<RUN>.prompt`（端口偏移见括号）。

| RUN（偏移） | 验证什么 | 中断时进度 | 下一步 |
|---|---|---|---|
| R19-02022（3200） | rc4 埋点单测 | 冷读 2 轮完；浏览器 2 发现「invalidate 回源盖掉已读缓存→重弹」已修（去 onSuccess invalidate，仅 onError 回源），**等浏览器复跑** | 重派浏览器复跑受影响 spec → 提交 → 评分 |
| R19-02172（3300） | rc5 展示名映射 | 冷读 2 轮完，SIBLING-MISSED 已修（useThirdErrorBar 扩到 ThirdVerify/Create/Reg/Unite），**等浏览器第 3 轮** | 重派浏览器复跑 → 提交 → 评分（重点看 C14） |
| R19-02265（3400） | rc6 文案反推禁令 | 冷读 2 轮完。⚠️ 第 2 轮后**恢复了 FundsFlow/flowerDetail 的 withPlusSign**——接手先核对它是不是按金额正负加 +（合规）还是又按文案识别类型（踩 T2）；**等浏览器第 2 轮** | 核对上述 → 浏览器复跑 → 提交 → 评分（重点看 T2） |
| R19-02006（3500） | 干净跑 | 批次 1 四个子 agent 已返回，**正在逐个看 diff 合并**（35 个未提交改动） | 合并 → check.mjs → 冷读+浏览器 → 提交 → 评分 |

续跑 prompt 模板：「读取并严格执行 ~/.prd-cache/_bench/<RUN>.prompt。worktree 已在 ~/github/<RUN>。先读 ~/.prd-cache/<RUN>/run-log.md、已落盘的 coldread-N.md/browser-roundN.md 和 git status，从中断处继续，不要重做。用最新 SKILL.md。dev server 同时只起 1 个，用完 stop。不要 push。」回放用 Opus，评分用 Sonnet。

## 3. 关键教训（已写入记忆）

1. mac 卡死根因是同时冷启动多个 Next dev（16G）：dev.mjs 全机上限（当前 4，看门狗脚本 `~/.prd-cache/_bench/mem-watchdog.sh` 可在内存 <15% 时降到 2，暂停时已停）。
2. /tmp 会被重启清空：工作目录在 `~/.prd-cache/_bench`。
3. **中断续跑的回放结果不可信**（R17-02022 9/12→R18 12/12；R17-02306 6/7→R18 7/7），放行判定以干净跑为准。
4. 共享文件混入纯格式化改动（01973、01947 各 1 次）：来自仓库 Husky/Biome 提交钩子，不是 skill 能管的，仅观察。

## 4. 恢复步骤

1. `uptime`、`pgrep -fl "next dev"` 确认机器干净；`git -C ~/.ai-rules log --oneline -3` 应看到 e9b9552 之后的提交；`cat ~/.config/prd-to-commit/dev/max-dev` 应为 4。
2. 按 §2 续跑 4 个 R19（可同时 4 个，dev.mjs 自动排队）。各自完成后：`replay/tools/score-prompt.sh PR-<号> <RUN> > ~/.prd-cache/_bench/<RUN>.score.prompt`，开 Sonnet agent 评分；成本 `python3 -I replay/tools/agent-cost.py <RUN>`（只对本会话内跑的 agent 有效）。
3. 放行判定：各基准不低于 R15 且陷阱 0。02172 需 C14 ✅；02265 需 T2 未违反（C7/C8 是登记过的口径争议，可丢）；02006 ≥14/15；02074 单列风险。不达标就看丢分原因，属规则问题则改 SKILL（先压缩体量）再回放该基准。
4. 放行后：
   - 打 tag `prd-to-commit-v1.6`；`releases.md` 顶部加 v1.6 节；`iteration-ledger.md` 并入 `results/2026-10-18-ledger-rows-R12-R16.md` 与 R17/R18/R19 行；`replay/README.md` 补结果。
   - 写最终报告 `reports/2026-10-xx-final-report.md`（给用户：成绩对比历史首轮与 bug 表、成本、剩余风险、01988/01930 不重跑说明）。
   - 清理 R11–R19 worktree（`git -C ~/github/fameex-web worktree remove --force <路径>`，先确认已提交或可丢）。不 push。

## 5. 未决问题 / 观察项

- 02074：C8（「更多结果」出现条件 PRD 未写）、C13（question vs groupItemTitle）每轮都丢，属口径争议。
- 02006 C8 Banner：评分员自认边界争议。
- PRD 正文自相矛盾时「待确认≠不做」与「正文优先」给不出裁决（R15-01930，1 次）。
- 第 2 轮冷读与浏览器重跑的先后顺序未写明（R17-02172 反馈，1 次）。
- PRD 少写某个校验条件时，「补一行提示」还是「并入已有项」不明确（R18-02306 反馈，1 次）。
- 02273 C14 BonusModal 精度：rc2 加了「已兼容代入数值」，R17 仍 13/14，待观察。
