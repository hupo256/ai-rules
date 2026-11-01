> 何时读：语言文件与命名空间的仓库事实——Web 只改 zh-CN、apps/web 与 apps/web-next 两套命名空间登记机制、插值转义、错误码表位置。新增或修改任何 locale/i18n 文件时读。
> 适用路径：["apps/web/src/i18n/**", "apps/web-next/src/i18n/**", "apps/*/legacy-admin/src/locale/**", "apps/admin/src/**/locales/**"]
> 个人本地规则（不进 fameex-web 仓库），由 `~/.ai-rules/rules/fameex-local.md` 路由。

# i18n 事实

- Web 项目翻译只改简体中文（`zh-CN` / `zh_CN`），新 key 也只加 zh-CN；其他语种由 Tolgee 同步（见仓库 AGENTS.md「Coding Style」）。
- **apps/web** 新增只有 zh-CN 的命名空间时登记到 `ZH_CN_SOURCE_ONLY_NAMESPACES`，否则其他语种加载报错。先 grep 确认该机制存在；不存在（较旧代码）就把 key 放进已有命名空间。
- **apps/web-next** 可以新建命名空间：登记 `src/i18n/core/namespaces.ts` + `src/i18n/i18next.d.ts`，并同步 `namespaces.test.ts`；缺语种时显示 `ns:key`；`t(($) => $.a.b)` selector 写法；route loader 读文案用 `hasI18nResource` 判空，`loadI18nResource` 缺语种会 throw。两套机制不要互套。
- 文案带 `& / <` 等符号又走插值会被 i18next 转义成 `&amp;`：能写死就写死，否则传 `interpolation: { escapeValue: false }`。
- 错误码文案表在 `apps/web/src/i18n/locales/zh-CN/errorCode.json`；写接口（报名、领取、下单、改单）按同业务前缀搜已有码分支，复用下单侧映射，不另写兜底文案。
- legacy 后台缺 key 显示空白，见 `legacy-admin-vue2.md`。
