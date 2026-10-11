---
name: fameex-feature-module-layout
layer: L2-personal (pre-approval; promote to repo .cursor/rules/*.mdc only after team review)
description: 复杂功能模块的目录结构、Zustand store 引入判据与切分、子组件与 hook 划分。参照 CopyTrading/CopySetting/SettingForm。
applies-when: 功能较重（多 tab/分支、多层子组件、跨组件共享状态）时组织目录/状态/拆分
---

# Structure a Complex Feature Module（复杂功能模块封装）

> 本文是 L2 个人试运行规则：编码手艺 + FameEX 锚点（`apps/web` 结构、`CopySetting` 样板）。团队评审批准前只在本地载体维护，不写进 tracked `.cursor/rules/*.mdc`。放置标准见 `~/github/docs_tdd/common/rules/rule-inheritance.md` §0（docs_tdd 已冻结，只读归档）。

功能较重（多个 tab/分支、多层子组件、有跨组件共享状态）时，按下面的目录结构与判据组织，而不是把所有东西堆进一个目录或一个巨型组件。以 `CopySetting/SettingForm/` 为参照：

```text
FeatureRoot/
  index.tsx              # 根组件：数据到达 + 状态编排 + 拼 tabs + 渲染顶层弹窗，不写具体分支的业务逻辑
  VariantA.tsx            # 每个 tab/分支一个文件，只做渲染，逻辑来自同名 hook
  VariantB.tsx
  hooks/
    useVariantAForm.ts    # 每个分支的业务逻辑（校验/提交/状态）单开一个 hook
    useSharedThing.ts      # 单文件即可实现的 hook，直接平铺
    useBigThing/           # 需要 hook + 测试等 >1 个文件时才开子目录
      index.ts
      useBigThing.test.ts
  store/
    useFeatureStore.ts     # 见下方「要不要上 store」
    useConfirmStore.ts     # 生命周期不同的独立小 store，不要塞进同一个大 store
  common/
    SomeField.tsx          # 单文件组件/样式常量/纯逻辑，直接平铺
    featureFieldStyles.ts
    tools/                 # 同类纯计算工具变多（≥3 个）时，收进一个子目录，而不是各自单开目录
      calcA.ts
      calcA.test.ts
```

**分组判据只有一条：这个概念自己是不是要用到 >1 个文件。** 单文件 → 平铺在所属目录（`common/`、`hooks/`）里；需要多个文件（实现 + 测试、或一组紧密耦合的子件）→ 单开一个以概念命名的子目录，主文件改名 `index.ts`/`index.tsx`。不要因为"这几个东西概念上相关"就预先建目录分组——文件名前缀已经是分组标记（如 `useFollowParams*`），能 grep 到就不需要额外目录层。

## 要不要引入 Zustand store，怎样切分

> **上位约束（L1，不可违背）**：server state 和 server 派生态归 React Query，**禁止复制进 Zustand**（AGENT.md「Keep server state in React Query…do not duplicate server state or derived state into stores」）。本节所有判据都从属于这条；凡与它冲突，以 L1 为准。

**上 store 的判据：同一份 client 状态被 2+ 个兄弟组件消费，且中间要连续转手 ≥2 层 props 才能到达消费者。** 只有一层父子传递（父组件直接渲染子组件并传 1-2 个 prop）就用 props，不要因为"看起来更整洁"就上 store——store 是解决"逐层转手"的问题，不是"我不想写 prop"。

**store 只装 client-only UI 状态**（多选、弹窗开合、跨兄弟共读的选中项、由用户交互驱动的 draft/working 值等）：这些原本就是某个祖先组件的 `useState`，直接把 ownership 搬进 store（是搬家，不是镜像），每个字段配一个语义化 setter/action，不要留一个万能 `setState(partial)`。

**深层组件要 server 数据、又不想逐层 prop 钻，怎么办**：在消费处**直接调用同一个 React Query hook**——cache 会去重，唯一真源仍是 React Query，零复制。这是 L1 认可的路径，**默认走这条**，不要把查询结果搬进 Zustand。

**唯一的镜像例外**（对应 L1 的 "unless existing architecture requires it"，是窄例外不是默认档）：数据以 **props 形式从"拥有该 query 的祖先"传进 feature root**、消费者无法干净地重调该 hook（不知道 key/hook，或祖先是弹窗容器持有查询），且要逐层转手 ≥2 层时，才允许根组件用**一个** `useEffect` 把这批 props 只读镜像进 store（一个 `setContext(partial)` action，store 内不发请求、不派生新事实）。用到时必须：(1) 注释显式标注为 deliberate L1 exception 及原因；(2) 优先评估能否抽一个共享 query hook 让消费者自读，从而消除镜像。不要因为"props 派生的看起来也算上下文"就把 server 数据往这里塞。

**不进 store 的**：每个分支/tab 各自独立、互不共享的本地状态——哪怕字段名字相同（比如"每个 tab 自己的表单校验状态"），只要实例不共享就说明它不是"公共数据"，该留在各自组件/hook 里，不要因为字段名一样就误判成可以合并进全局 store。

**独立的小 store**：像"确认弹窗"这种由一次性用户事件触发、和 props 同步节奏完全不同的 UI 状态，单开一个更小的 store（如 `useConfirmStore`），不要塞进主 store——两者的写入时机、生命周期不是一回事。

**消费方式**：每个消费者用单字段 selector（`useFeatureStore((s) => s.field)`），不要 `useFeatureStore((s) => s)` 整对象订阅，否则任何字段变化都会让不相关的消费者重渲染。

## 功能划分、子组件划分、导入导出

- 每个分支/tab 一个组件文件，业务逻辑（校验、提交、状态派生）抽成同名 `useXxxForm` hook；组件只保留渲染与从 hook 结果里取值，不在组件里堆逻辑（`.tsx` 300 行上限触发即拆）。
- 多个分支"结构同构、仅少数字段不同"时，用 `Record<Key, Config>` 查表 + 一个 resolver 函数收敛差异，不要写 if/else 分支各写一套几乎相同的 JSX；查表里如果有 i18n 文案，value 必须是字面量 `t('literal')` 调用，不能存 key 字符串再 `t(变量)`。
- 每个文件只做一件事：组件 / 纯逻辑 / 类型 / 样式常量 / hook 不混装在同一个文件里。
- 不用桶文件 `index.ts` 做纯 re-export（除非该文件本身就是某个多文件概念的入口，如 `hooks/useBigThing/index.ts`）；消费方直接从具体文件名 import。
- 跨到别的顶层目录（全局 `common/`、别的 feature）用 `@/` alias；同一功能目录树内用相对路径，不写超过 2 层的 `../../../`。
- 一个组件/hook 被 2+ 个兄弟文件消费，才提升到 `common/`/`hooks/`；只服务 1 个消费者的辅助逻辑留在调用者所在文件内，不预先抽象。
- 重构时顺手删掉发现的死代码（从未被真正赋值、一路都是 `undefined` 的 prop/字段），不要保留着掩盖问题；但不要额外删除与本次改动无关的既有死代码（除非任务本身就是清理）。

## 验证

结构调整后必须跑：`tsc --noEmit`、`biome check`、该功能目录下的既有单测，三者全绿才算完成；不要只凭代码审阅判断改动正确。
