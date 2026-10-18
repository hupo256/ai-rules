# -*- coding: utf-8 -*-
# v1.6-rc2：R17 期间积累的放行前改动。usage: python3 -I edit-v16-rc2.py <SKILL.md>
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()


def rep(a, b):
    global s
    if a not in s:
        sys.exit('NF: ' + a[:60])
    s = s.replace(a, b)


# 1. 读图：notes 开头每图一行摘要；编码 UI 前必须看原图核对位置/布局（R17-02022 转写把「贴卡片」写成「居中弹窗」）
rep("主会话读 notes 建清单，编码某页面 UI 时再看对应原图。",
    "notes 开头先列每图一行摘要。主会话读 notes 建清单；**编码某页面 UI 前必须看对应原图**核对位置、锚点与布局（转写会失真）。")

# 2. Explore 阈值（R12/R17-02306）
rep("- 找落点先派 1 个 Explore 子 agent（跨 ≥3 个工程时每工程一个）：",
    "- 单工程且落点 ≤10 处时主会话直接搜；否则先派 1 个 Explore 子 agent（跨 ≥3 个工程时每工程一个）：")

# 3. 浏览器子 agent 后台派、冷读前台（R17-02074：子 agent 内 Agent 调用会阻塞）
rep("**冷读子 agent 与浏览器子 agent 同时派出**（两者都不改业务代码），",
    "**冷读子 agent 与浏览器子 agent 同时派出**（浏览器用后台模式先派，再前台派冷读；两者都不改业务代码），")

# 4. 已兼容行代入数值（C14 BonusModal 连续 7 轮）
rep("不能只是「已有类似逻辑」；冷读对这类行按 PRD 原句复核。",
    "不能只是「已有类似逻辑」；涉及等式/精度的代入一组具体数值算一遍。冷读对这类行按 PRD 原句复核并代入数值。")

# 5. 压缩以腾出体量
for a, b in [
    ("- 用户另外给的输入（接口契约、YApi 导出、附件、Figma 链接）存到 `~/.prd-cache/<ID>/inputs/`，清单、编码和冷读都要引用。",
     "- 用户另给的输入（接口契约、YApi、附件、Figma）存 `~/.prd-cache/<ID>/inputs/`，清单、编码、冷读都要引用。"),
    ("- `meta.json.failed` 非空或有 Figma/原型链接读不到：告诉用户缺什么，然后继续其余部分。",
     "- `meta.json.failed` 非空或 Figma/原型读不到：告诉用户缺什么，继续其余部分。"),
    ("- 按清单逐行实现。实现完一行，就在清单「落点文件」列填上真实路径。",
     "- 按清单逐行实现，实现完一行就填上真实落点。"),
]:
    rep(a, b)

open(p, 'w', encoding='utf-8').write(s)
print('ok')

s = open(p, encoding='utf-8').read()
for a, b in [
    ("给它清单、`media-notes.md`、`git diff <BASE>` 命令、`references/browser.md`，要它按清单每个页面/入口写 spec、用 `dev.mjs`/`browser.mjs` 跑（接口没好就在 spec 里 mock）、逐张看截图对照 PRD/Figma，返回问题列表、spec 路径和 not-covered 项，不改业务代码；",
     "给它清单、`media-notes.md`、`git diff <BASE>`、`references/browser.md`，要它按清单每个页面/入口写 spec 跑（接口没好就在 spec 里 mock），返回问题列表、spec 路径和 not-covered 项，不改业务代码；"),
    ("i18n key 两种写法都要搜：扁平的 `\"a.b\"` 和嵌套的 `\"a\": { \"b\" }`。", "i18n key 扁平 `\"a.b\"` 与嵌套写法都要搜。"),
    ("不依赖契约的步骤（例如在现有枚举、文案里加项）不用等，和批次 0 同时开工。", "不依赖契约的零散步骤和批次 0 同时开工。"),
]:
    if a not in s:
        sys.exit('NF-c: ' + a[:40])
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
print('ok-c')

s = open(p, encoding='utf-8').read()
a = "app 未接入 MSW 时按 `references/fameex.md` 单独一个提交补齐；legacy Vue2 不接。接口上 dev 就删 handler 和登记行，基建保留。"
b = "未接入的 app 按 `references/fameex.md` 单独提交补齐（legacy 不接）；接口上 dev 就删 handler，基建保留。"
if a not in s:
    sys.exit('NF-d')
s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
print('ok-d')

s = open(p, encoding='utf-8').read()
a = "（转写会失真）"
if a not in s:
    sys.exit('NF-e')
s = s.replace(a, "")
open(p, 'w', encoding='utf-8').write(s)
print('ok-e')
