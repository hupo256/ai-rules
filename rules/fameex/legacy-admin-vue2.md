> 何时读：Vue2 legacy 后台（apps/admin/legacy-admin、apps/futures-admin/legacy-admin）的约束——无 tsc/biome 兜底、语法限制、菜单登记、i18n 空白。改 legacy-admin 下任何文件时读。
> 适用路径：["apps/admin/legacy-admin/**", "apps/futures-admin/legacy-admin/**"]
> 个人本地规则（不进 fameex-web 仓库），由 `~/.ai-rules/rules/fameex-local.md` 路由。

# Vue2 legacy 后台约束

- 后台页面有两套：Next（`apps/admin/src`、`apps/futures-admin/src`，futures 的 Next 工程已停用）和 Vue2 legacy。**新页面跟随同一菜单分组的兄弟页面放**；改既有页面时两套都要搜。不要两套都做，也不要篡改/注入后端 `/operate-api/menus` 的返回。
- 新页面照兄弟页面登记 `routes`、`siderItems`（兜底与登录后跳转依赖它）、`contentSettings`、权限点；交付时提醒后端登记菜单。合约后台 menus 结构与现货不同（`{ navList, menuList, actionList: { [atName]: [] } }`）。
- legacy 不在 biome 与 tsc 覆盖内，只有语法检查。删除/改名方法或变量后必须全仓 grep 残留引用（含模板里的 `@click`/插值），否则保存时才报错。
- futures-admin legacy 是 vue-cli 3 + webpack4：脚本不支持 `?.` / `??`（整个工程编译失败）；两个后台的 Vue 2.5/2.6 模板表达式同样不支持。改用 `&&` 或 `== null`。
- legacy 只有 zh_CN 时缺 key 显示**空白**（不是 key 名）；只改 zh_CN 要确认 fallback。
- 首次启动 `npm install` 可能改写受跟踪的 `package-lock.json`，装完 `git checkout -- package-lock.json`。
