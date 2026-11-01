> 何时读：App Router 实际运行 React 19 / Next 15 的运行时坑——tsc 与冷读查不出，只有浏览器能暴露。改 apps/web、apps/admin 的组件、service、路由参数、history 时读。
> 适用路径：["apps/web/src/**/*.tsx", "apps/web/src/**/*.ts", "apps/admin/src/**/*.tsx", "apps/admin/src/**/*.ts"]
> 个人本地规则（不进 fameex-web 仓库），由 `~/.ai-rules/rules/fameex-local.md` 路由。

# React 19 / Next 15 运行时坑（来自真实需求与回放，2026-10）

- **App Router 实际运行 React 19**（即使某些 package.json 看着是 18 系）：
  - 依赖 `findDOMNode` 的库挂载即崩（react-quill 白屏）。富文本用 `quill@1.3.7` 直接包一层（`apps/admin/src/components/QuillEditor.tsx`）。
  - antd 静态 `message.success()` / `Modal.confirm()` 不渲染、点了不发请求。用 `App.useApp()` 返回的 `message/modal`，或仓内 `@/utils` 的 message。写操作（取消、重试、重新生成）必须在浏览器里点到底、确认请求发出。
  - 用 `Form.useFormInstance()` 的组件必须在 `<Form>` 内，否则白屏。
- Next 路由参数（`params`、`useParams`、`searchParams`）运行时一律是字符串，即使类型标成 number；与接口返回的数字 id 比较前先 `Number()`。
- `cn`（tailwind-merge）会把自定义字号类和颜色类当成同组冲突吞掉其中一个；字号放内层元素，或用仓内登记的 token class。
- 被 Server Component（layout/page）import 的 service 文件里不能出现 hooks（`useEffect`/`usePathname`），否则整页 500；hook 拆进单独的 `'use client'` 文件。
- 手动 `history.replaceState/pushState` 第一个参数传 `null`；传回 Next 自己的 state 会让 `useSearchParams` 与地址栏不同步。
- apps/admin 的 `PageSearchTable` 用全局单例 `stores/useTableStore`：同一页挂两个会互相改分页/总数、无限更新白屏。一页两个列表时，第二个用独立 `useQuery` + antd Table，或放进 Tabs 并 `destroyInactiveTabPane`。
