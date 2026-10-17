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

export const webAuthMocks = [
  { url: /\/fe-ex-api\/common\/user_info_v1/, json: ok(webUserInfo) },
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
