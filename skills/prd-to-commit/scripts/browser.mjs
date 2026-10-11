#!/usr/bin/env node
// 本地浏览器验证：每个站点一个专用 Chrome profile 持久保存登录态（人工登录一次，之后无头复用）。
//   login  --site web              打开有头浏览器到登录页，你手动登录（验证码/GA），关窗即保存
//   check  --site web              无头检查登录态是否仍有效
//   run    <spec.mjs> --id <ID>    执行验证脚本，截图 + 报告写到 ~/.prd-cache/<ID>/browser/<时间>/
// 依赖：对应站点的 dev server 已由 dev.mjs 启动；Playwright 取自 worktree 的 node_modules（回退全局）。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const cmd = args[0]
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const here = dirname(fileURLToPath(import.meta.url))
const sites = JSON.parse(readFileSync(join(here, 'browser-sites.json'), 'utf8'))
const profileRoot = join(homedir(), '.config', 'prd-to-commit', 'browser')

function loadPlaywright() {
  const roots = [opt('--worktree'), process.cwd(), join(homedir(), 'github', 'fameex-web')].filter(Boolean)
  for (const root of roots) {
    const store = join(root, 'node_modules', '.pnpm')
    if (!existsSync(store)) continue
    const dir = readdirSync(store).filter((d) => /^playwright@\d/.test(d)).sort().at(-1)
    if (dir) return createRequire(join(store, dir, 'node_modules', 'playwright', 'package.json'))('playwright')
  }
  try {
    return createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'x.js'))('playwright')
  } catch {
    throw new Error('找不到 playwright：在 fameex-web worktree 里运行，或 npm i -g playwright')
  }
}

function siteConf(name) {
  const conf = sites[name]
  if (!conf) throw new Error(`未知站点 ${name}`)
  return { ...conf, url: `http://localhost:${conf.port}`, profile: join(profileRoot, name) }
}

// 无头运行用 profile 副本，避免锁冲突，也允许并行
function profileCopy(conf) {
  const copy = join(tmpdir(), `p2c-profile-${conf.port}-${process.pid}`)
  rmSync(copy, { recursive: true, force: true })
  if (!existsSync(conf.profile)) {
    if (conf.tokenFrom) return copy
    throw new Error(`站点 ${conf.name} 还没登录过：先运行 browser.mjs login --site ${conf.name}`)
  }
  cpSync(conf.profile, copy, { recursive: true, filter: (src) => !/Singleton(Lock|Socket|Cookie)/.test(src) })
  return copy
}

// 登录检查：页面没被重定向到登录页，且（配置了 authProbe 的站点）鉴权接口没有返回「登录失效」
async function isLoggedIn(page, conf) {
  let probeFailed = false
  let probeSeen = false
  const onResponse = async (res) => {
    if (!conf.authProbe || !res.url().includes(conf.authProbe.url)) return
    probeSeen = true
    try {
      if (new RegExp(conf.authProbe.fail).test(await res.text())) probeFailed = true
    } catch {}
  }
  page.on('response', onResponse)
  await page.goto(`${conf.url}${conf.authCheckPath}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
  page.off('response', onResponse)
  // 配置了探针却没观察到探针请求，按未登录处理（宁可误报失效，也不误报有效）
  if (conf.authProbe && !probeSeen) return false
  return !probeFailed && !page.url().includes(conf.loggedOutPattern)
}

const { chromium } = loadPlaywright()


// 共享登录：从来源站点（tokenFrom.site）的登录快照取 admin_token 等，注入到当前站点
function sharedAuthPayload(conf) {
  if (!conf.tokenFrom) return null
  const source = sites[conf.tokenFrom.site]
  const stateFile = join(profileRoot, `${conf.tokenFrom.site}.state.json`)
  if (!existsSync(stateFile)) throw new Error(`共享登录来源 ${conf.tokenFrom.site} 还没登录：运行 browser.mjs login --site ${conf.tokenFrom.site}`)
  const state = JSON.parse(readFileSync(stateFile, 'utf8'))
  const origin = state.origins.find((o) => o.origin === `http://localhost:${source.port}`)
  const items = Object.fromEntries((origin?.localStorage ?? []).map((i) => [i.name, i.value]))
  const token = state.cookies.find((c) => c.name === 'admin_token')?.value ?? (items.admin_token ? JSON.parse(items.admin_token) : '')
  if (!token) throw new Error(`${conf.tokenFrom.site} 的登录快照里没有 admin_token：重新登录 ${conf.tokenFrom.site}`)
  return { mode: conf.tokenFrom.inject, token, items }
}

async function injectSharedAuth(context, conf) {
  const payload = sharedAuthPayload(conf)
  if (!payload) return
  await context.addInitScript(({ mode, token, items }) => {
    if (mode === 'localStorage') {
      for (const [key, value] of Object.entries(items)) if (!localStorage.getItem(key)) localStorage.setItem(key, value)
    } else if (mode === 'window.name' && !window.name) {
      window.name = token
    }
  }, payload)
}

async function restoreCookies(context, conf) {
  const stateFile = `${conf.profile}.state.json`
  if (!existsSync(stateFile)) return
  try {
    const { cookies } = JSON.parse(readFileSync(stateFile, 'utf8'))
    if (cookies?.length) await context.addCookies(cookies)
  } catch {}
}

// 浏览器内核：优先本机 Chrome（channel），其次 Playwright 缓存里的 Chromium，避免 worktree 的 playwright 版本与缓存内核不匹配
function launchOptions() {
  if (existsSync('/Applications/Google Chrome.app')) return { channel: 'chrome' }
  const cache = join(homedir(), 'Library', 'Caches', 'ms-playwright')
  const dir = existsSync(cache) && readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1)
  const exe = dir && join(cache, dir, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  return exe && existsSync(exe) ? { executablePath: exe } : {}
}

if (cmd === 'login') {
  const name = opt('--site', 'web')
  const conf = { ...siteConf(name), name }
  if (conf.tokenFrom && !args.includes('--force')) {
    console.log(`${name} 共用 ${conf.tokenFrom.site} 的登录态，无需单独登录：请运行 browser.mjs login --site ${conf.tokenFrom.site}（加 --force 可强制单独登录）`)
    process.exit(0)
  }
  mkdirSync(conf.profile, { recursive: true })
  const context = await chromium.launchPersistentContext(conf.profile, { ...launchOptions(), headless: false, viewport: null })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(`${conf.url}${conf.loginPath}`, { timeout: 180000 }).catch(() => {})
  console.log(`已打开 ${conf.url}${conf.loginPath}：请手动完成登录，然后关闭浏览器窗口（登录态保存在 ${conf.profile}）`)
  // 会话 cookie 关窗即丢，profile 存不住：登录窗口打开期间每 2 秒快照 cookies 到 state 文件，运行时再注入
  const stateFile = `${conf.profile}.state.json`
  const timer = setInterval(async () => {
    try {
      writeFileSync(stateFile, JSON.stringify(await context.storageState()), { mode: 0o600 })
    } catch {}
  }, 2000)
  await new Promise((r) => context.on('close', r))
  clearInterval(timer)
  console.log('已保存。可运行 browser.mjs check --site', name)
  process.exit(0)
}

if (cmd === 'check') {
  const name = opt('--site', 'web')
  const conf = { ...siteConf(name), name }
  const copy = profileCopy(conf)
  const context = await chromium.launchPersistentContext(copy, { ...launchOptions(), headless: true })
  await restoreCookies(context, conf)
  await injectSharedAuth(context, conf)
  const page = context.pages()[0] ?? (await context.newPage())
  const ok = await isLoggedIn(page, conf)
  console.log(ok ? `✅ ${name} 登录态有效（${page.url()}）` : `❌ ${name} 登录态失效：运行 browser.mjs login --site ${name} 重新登录`)
  await context.close()
  rmSync(copy, { recursive: true, force: true })
  process.exit(ok ? 0 : 2)
}

if (cmd === 'run') {
  const specPath = resolve(args[1])
  const id = opt('--id', 'adhoc')
  const spec = await import(pathToFileURL(specPath).href)
  const name = spec.site ?? 'web'
  const conf = { ...siteConf(name), name }
  const specName = specPath.split('/').pop().replace(/\.m?js$/, '')
  const outDir = join(homedir(), '.prd-cache', id, 'browser', `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${specName}`)
  mkdirSync(outDir, { recursive: true })
  const copy = spec.auth === false ? join(tmpdir(), `p2c-anon-${process.pid}`) : profileCopy(conf)
  const context = await chromium.launchPersistentContext(copy, { ...launchOptions(), headless: !args.includes('--headed'), viewport: spec.viewport ?? { width: 1440, height: 900 } })
  if (spec.auth !== false) {
    await restoreCookies(context, conf)
    await injectSharedAuth(context, conf)
  }
  const page = context.pages()[0] ?? (await context.newPage())
  const report = { site: name, spec: specPath, steps: [], consoleErrors: [], pageErrors: [], failedRequests: [], realWrites: [], blockedWrites: [], mocked: [] }

  // 1) mock：spec.mocks = [{ url: /regex/ 或 'glob', method?: 'POST', json?: {...}, status?: 200 }]
  for (const m of spec.mocks ?? []) {
    await context.route(m.url, (route) => {
      if (m.method && route.request().method() !== m.method) return route.fallback()
      report.mocked.push(`${route.request().method()} ${route.request().url()}`)
      return route.fulfill({ status: m.status ?? 200, contentType: 'application/json', body: JSON.stringify(m.json ?? { code: '0', msg: '', data: null }) })
    })
  }
  // 2) 写保护：未 mock 的写操作类请求默认拦截（避免改动 dev 环境数据）；spec.allowWrites = [/regex/] 可放行
  const WRITE = /(create|add|insert|update|edit|modify|delete|remove|submit|save|apply|bind|unbind|invalid|cancel|transfer|withdraw|deposit|place|order\/new)/i
  // 登出类接口无论如何都拦（放行会让服务端会话失效，保存的登录态就废了）
  const LOGOUT = /(log_?out|login_?out|sign_?out)/i
  await context.route(/^https?:\/\/(?!localhost)/, (route) => {
    const req = route.request()
    const method = req.method()
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return route.fallback()
    const path = new URL(req.url()).pathname
    if (LOGOUT.test(path)) {
      report.blockedWrites.push(`${method} ${req.url()} (logout)`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'blocked logout', data: null }) })
    }
    if ((spec.allowWrites ?? []).some((re) => re.test(req.url()))) {
      report.realWrites.push(`${method} ${req.url()}`)
      return route.fallback()
    }
    // 路径最后一段像查询（info/list/query/detail/get/page/count/stat）的放行，避免把 deposit_and_withdraw_info 之类误判成写
    const readLike = /(info|list|query|detail|get|page|count|stat|config|search)[^/]*$/i.test(path)
    if (WRITE.test(path) && !readLike && spec.strictWrites !== false) {
      report.blockedWrites.push(`${method} ${req.url()}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: '0', msg: 'blocked by browser.mjs (unmocked write)', data: null }) })
    }
    report.realWrites.push(`${method} ${req.url()}`)
    return route.fallback()
  })
  // 去掉开发态叠层（react-scan 组件标注/FPS、Next 开发角标），否则截图无法做视觉比对
  await context.route(/unpkg\.com\/react-scan/, (route) => route.abort())
  await context.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = 'nextjs-portal{display:none!important}'
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style))
  })
  page.on('console', (msg) => msg.type() === 'error' && report.consoleErrors.push(msg.text().slice(0, 300)))
  page.on('pageerror', (err) => report.pageErrors.push(String(err).slice(0, 300)))
  page.on('response', (res) => res.status() >= 400 && report.failedRequests.push(`${res.status()} ${res.url()}`))

  let n = 0
  const shot = async (label) => {
    const file = join(outDir, `${String(++n).padStart(2, '0')}-${label.replace(/[^\w一-龥-]+/g, '_')}.png`)
    await page.screenshot({ path: file, fullPage: false })
    return file
  }
  const helpers = {
    page, context, base: `${conf.url}${conf.basePath}`,
    goto: async (path) => {
      await page.goto(`${conf.url}${path.startsWith('/') ? path : `${conf.basePath}/${path}`}`, { waitUntil: 'domcontentloaded', timeout: 180000 })
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    },
    expectText: (text, timeout = 15000) => page.getByText(text, { exact: false }).first().waitFor({ timeout }),
    shot,
    step: async (label, fn) => {
      const started = Date.now()
      try {
        await fn()
        report.steps.push({ label, ok: true, ms: Date.now() - started, screenshot: await shot(label) })
      } catch (error) {
        report.steps.push({ label, ok: false, ms: Date.now() - started, error: String(error.message ?? error).split('\n')[0], screenshot: await shot(`${label}-FAIL`) })
      }
    },
  }

  if (spec.auth !== false && spec.authCheck !== false && !(await isLoggedIn(page, conf))) {
    report.steps.push({ label: '登录态', ok: false, error: `登录态失效：运行 browser.mjs login --site ${name}` })
  } else {
    await spec.default(helpers)
  }
  await context.close()
  rmSync(copy, { recursive: true, force: true })

  const failed = report.steps.filter((s) => !s.ok)
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const md = [
    `# 浏览器验证 ${id}（${name}）`, '',
    ...report.steps.map((s) => `- ${s.ok ? '✅' : '❌'} ${s.label}${s.error ? `：${s.error}` : ''} → ${s.screenshot ?? ''}`), '',
    `页面报错 ${report.pageErrors.length}、console error ${report.consoleErrors.length}、失败请求 ${report.failedRequests.length}`,
    `命中 mock ${report.mocked.length}；拦截的写操作 ${report.blockedWrites.length}；透传到后端的非 GET 请求 ${report.realWrites.length}（多为 POST 查询，明细见 report.json）`,
    ...report.blockedWrites.map((w) => `  - 拦截：${w}`),
    ...(report.failedRequests.length ? ['失败请求：', ...[...new Set(report.failedRequests)].slice(0, 10).map((r) => `  - ${r}`)] : []),
    ...(report.pageErrors.length ? ['页面报错：', ...report.pageErrors.slice(0, 5).map((e) => `  - ${e}`)] : []),
  ].join('\n')
  writeFileSync(join(outDir, 'report.md'), `${md}\n`)
  console.log(md)
  console.log(`\n截图与报告：${outDir}`)
  process.exit(failed.length ? 1 : 0)
}

console.error('usage: browser.mjs login|check --site <site>  |  browser.mjs run <spec.mjs> --id <ID> [--headed]')
process.exit(1)
