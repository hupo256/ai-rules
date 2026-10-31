// 登录态失效 / 偏移端口（无登录态）时浏览器 spec 的通用兜底，提炼自 R12–R14 回放里反复手写的同一套 mock。
// 用法（spec 里）：
//   import { ok, webAuthMocks, fakeLoginWithPublicCache } from '/Users/aven/.ai-rules/skills/prd-to-commit/scripts/auth-fallback.mjs'
//   export const auth = false
//   export const mocks = [...webAuthMocks, /* 本需求接口放在后面：同一 URL 后注册的优先 */]
//   export default async ({ page, goto, step }) => {
//     await fakeLoginWithPublicCache(page, goto, '/zh-CN/copy-trading/futures', { mocks })   // 需要「已登录」页面时调用；mocks 传 spec 自己的
//     ...
//   }
// 注意：带假 token 的签名请求会被后端返回 10002 并触发前端登出，所以「公共接口」要先匿名访问一次拿真实响应缓存起来，
// 「用户接口」用 webAuthMocks 兜底。SSR 预取的数据 mocks 拦不到，只能用 dev 真实数据。

export const ok = (data) => ({ code: '0', msg: 'success', data })

// apps/web 已登录页面普遍会请求的用户态接口（只给最小可用数据；需要具体数据态的接口在 spec 里另写，放在数组后面覆盖）
// 字段按 apps/web 的 UserDataSchema / contractUserConfigSchema 必填项给全（2026-10 online 口径；schema 再收紧时按 pageerror 里的 ZodError 补字段）
export const webUserInfo = {
  account_status: 0, agent_status: 0, auth_level: 2, country_code: '86', email: 'mock@fameex.test',
  force_open_google_auth: '0', google_status: 1, id: 10001, invite_code: 'MOCK01', is_capital_pword_set: 1,
  is_open_mobile_check: 0, is_password: true, auth_users: [], mobile_number: '', nick_name: 'mock',
  co_agent_user_permission: { id: null, uid: null, enable_front_sub_position_list: null, enable_add_junior_agent: null, enable_profit_loss: null },
  user_account: 'mock@fameex.test', withdraw_whitelist_flag: 0, user_type: 0, has_first_deposit: true,
}
export const webContractUserConfig = (openContract = 1) => ({
  marginModel: 1, openContract, marginModelCanSwitch: 1, nowLevel: 10, minLevel: 1, maxLevel: 100,
  positionModel: 1, positionModelCanSwitch: 1, pcSecondConfirm: 1, coUnit: 1, currentTimeMillis: Date.now(),
  uid: 10001, orginUid: 10001, userMaxLevel: 100, multiplierCoin: 'BTC', limitDomesticUserTrade: 0, leverCeiling: null,
  leverOriginCeiling: null, transStatus: 1, expireTime: 1, couponTag: 0, futuresLocalLimit: 0, forceKycOpen: 0,
  authLevel: 2, over500xWhite: 0, priceBasis: 0, externalMaker: 0, marketStp: 0,
})

// 新代码用 zCamel 把 snake_case 转成 camelCase 再解析，旧起点直接按 camelCase 解析：两种键名都给，哪种都能过（R17-02306 报旧起点整包 ZodError）
const withCamel = (obj) => Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => {
  const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  const val = v && typeof v === 'object' && !Array.isArray(v) ? withCamel(v) : v
  return camel === k ? [[k, val]] : [[k, val], [camel, val]]
}))
export const webUserInfoBothCases = withCamel(webUserInfo)

export const webAuthMocks = [
  { url: /\/fe-ex-api\/common\/user_info_v1/, json: ok(webUserInfoBothCases) },
  { url: /\/fe-ex-api\/finance\//, json: ok(null) },
  { url: /\/fe-ex-api\/message\//, json: ok(0) },
  { url: /\/fe-ex-api\/reward_center_info/, json: ok(null) },
  { url: /\/fe-ex-api\/(v2\/)?user\//, json: ok(null) },
  { url: /\/fe-co-api\/user\/get_user_config/, json: ok(webContractUserConfig()) },
]

// 用户态路径（不缓存、不回放；交给 mocks）
const USER_PATH = /\/user\/|user_config|user_info|\/finance\/|\/message\/|reward_center|cptrade|\/order\/|\/position\//

/**
 * 先匿名打开 warmPath，把 dev 公共接口（非用户态、code=0）的真实响应缓存下来；
 * 再注入假 token（前端据此判定已登录），之后公共接口一律用缓存回放，避免假 token 触发 10002 登出。
 * tokenKey/tokenValue：apps/web 用 localStorage.accessToken（JSON 字符串）。
 */
export async function fakeLoginWithPublicCache(page, goto, warmPath, { mocks = [], host = /pfyys\.com$/, tokenKey = 'accessToken', tokenValue = '"mock-token"', warmMs = 8000 } = {}) {
  const cache = new Map()
  const unmatched = new Set()
  const onRes = async (res) => {
    const u = new URL(res.url())
    if (!host.test(u.hostname) || USER_PATH.test(u.pathname)) return
    try {
      const body = await res.text()
      if (/"code":"?0"?[,}]/.test(body.slice(0, 60))) cache.set(`${res.request().method()} ${u.pathname}`, body)
    } catch {}
  }
  page.on('response', onRes)
  for (const path of [].concat(warmPath)) {
    await goto(path) // 可传数组：把目标页面用到的公共接口都预热一遍
    await page.waitForTimeout(warmMs)
  }
  page.off('response', onRes)
  await page.route((url) => host.test(new URL(url).hostname), (route) => {
    const u = new URL(route.request().url())
    const body = cache.get(`${route.request().method()} ${u.pathname}`)
    if (body) return route.fulfill({ status: 200, contentType: 'application/json', body })
    // 交给 spec 的 mocks（后注册的 route 优先，所以这里要显式放行给它们）
    if (mocks.some((m) => m.url.test(route.request().url()) && (!m.method || m.method === route.request().method()))) return route.fallback()
    // 既没缓存也没 mock：不能打到后端（带假 token 会返回 10002 → 前端清 token 登出），回空成功响应并记下来
    unmatched.add(`${route.request().method()} ${u.pathname}`)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) })
  })
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [tokenKey, tokenValue])
  // 返回 unmatched：被兜底成 ok(null) 的接口，页面数据不对时看这里，再给它们写 mock
  return { cached: cache.size, unmatched }
}

// ---- 后台（Next admin / legacy-admin / futures-legacy-admin）免登录 ----
// PR-02254（Next 后台）、PR-02012（legacy 后台）各自手写过同一套：后台 LoginRouter 不拦截，只看 token；
// 侧栏、路由兜底、按钮级权限都由 /operate-api/menus 返回的 actionList / actionY 决定（Next 后台按 localStorage.ADMIN_ACTIONY 的 indexOf 判断）。
// items 照兄弟页面登记的 menus 写：{ id, parentId, atName, atUrl, atDes, atType: 1, sortCode }，按钮级权限 atType -1、atName 为接口路径；
// 必须含到达目标页的整条菜单链（父 → 子 → 页），只给 '*' 到不了页面。
// 注意：合约后台 futures-legacy-admin 的 menus 结构不同（`{ navList, menuList, actionList: { [atName]: [] } }`，R23-02127），这两个 helper 只适用 Next 后台/现货 legacy，合约后台照兄弟页面的真实响应手写 mock。
export const adminMenus = (items) => ({ actionList: items, actionY: items.map((item) => item.atName).join(',') })
export const adminAuthMocks = (items) => [
  { url: /\/operate-api\/menus/, json: ok(adminMenus(items)) },
]
/**
 * 页面加载前注入后台假登录态。context/base 取 spec 的 helpers；
 * token 同时写 localStorage（Next 后台）、cookie admin_token（legacy-admin，main.js 按 cookie 判断）与 admin-token（futures legacy，App.vue 从 window.name 落 cookie，未实测）。
 */
export async function fakeAdminLogin(page, context, base, items) {
  await context.addCookies([
    { name: 'admin_token', value: 'p2c-fake-token', url: base },
    { name: 'admin-token', value: 'p2c-fake-token', url: base },
  ])
  await page.addInitScript(({ actionY }) => {
    localStorage.setItem('admin_token', JSON.stringify('p2c-fake-token'))
    localStorage.setItem('ADMIN_USERINFO', JSON.stringify({ user_id: '9001', nickname: 'p2c', user_name: 'p2c', username: 'p2c', name: 'p2c' }))
    localStorage.setItem('ADMIN_ACTIONY', actionY)
    localStorage.setItem('ADMIN_LANGUAGE', JSON.stringify({ zh_CN: '简体中文' }))
  }, { actionY: adminMenus(items).actionY })
}

// ---- web-next（Vite + TanStack Start）免登录 ----
// R20/R21-01507 两次回放各自摸索过同一套：dev server 下 localStorage key 带环境前缀（`makeStorageKey`：`dev__accessToken`、`dev__uid`），
// 值是 JSON 字符串；登录态判定靠首页请求 `/fe-ex-api/common/user_info_v1`（POST），用 webAuthMocks 兜底即可（同一后端，字段同 apps/web）。
// 假 token 打到 dev 后端同样会 10002 登出，所以复用 fakeLoginWithPublicCache 的「先匿名预热缓存公共接口」。
export const WEB_NEXT_TOKEN_KEY = 'dev__accessToken'
export const WEB_NEXT_UID_KEY = 'dev__uid'
export const webNextAuthMocks = webAuthMocks
// 用法同 apps/web：spec 里 `export const mocks = [...webNextAuthMocks, /* 本需求接口 */]`，再把同一个 mocks 传进来（这里只用它判断放行，不注册路由）。
export async function fakeWebNextLogin(page, goto, warmPath, { mocks = [], uid = '10001', ...rest } = {}) {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v), [WEB_NEXT_UID_KEY, JSON.stringify(uid)])
  return fakeLoginWithPublicCache(page, goto, warmPath, { mocks, tokenKey: WEB_NEXT_TOKEN_KEY, ...rest })
}
