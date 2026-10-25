#!/usr/bin/env node
// 在 worktree 里按固定端口启动/停止/查看本地 dev server（站点配置见 browser-sites.json）。
// usage: dev.mjs start|stop|status <worktree-path> --site web|admin|futures-admin|legacy-admin|futures-legacy-admin
import { execSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const [cmd, worktreeArg, ...rest] = process.argv.slice(2)
const site = rest.includes('--site') ? rest[rest.indexOf('--site') + 1] : 'web'
if (!['start', 'stop', 'status'].includes(cmd) || !worktreeArg) {
  console.error('usage: dev.mjs start|stop|status <worktree-path> --site <site>')
  process.exit(1)
}
const sites = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'browser-sites.json'), 'utf8'))
// P2C_PORT_OFFSET：并发回放各用一组端口（登录态按 origin 保存，偏移后的端口没有登录态，只适合 auth=false + mock 的 spec）
const portOffset = Number(process.env.P2C_PORT_OFFSET || 0)
const conf = sites[site] && { ...sites[site], port: sites[site].port + portOffset }
if (!conf) throw new Error(`未知站点 ${site}，可选：${Object.keys(sites).filter((k) => !k.startsWith('_')).join(', ')}`)
const worktree = resolve(worktreeArg)
const stateDir = join(homedir(), '.config', 'prd-to-commit', 'dev')
mkdirSync(stateDir, { recursive: true })
const stateFile = join(stateDir, portOffset ? `${site}-${conf.port}.json` : `${site}.json`)
const url = `http://localhost:${conf.port}`

const pidOnPort = () => {
  try {
    return execSync(`lsof -ti tcp:${conf.port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function waitReady(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}${conf.basePath}`, { redirect: 'manual' })
      if (res.status < 500) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 2000))
  }
  return false
}

if (cmd === 'status') {
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null
  console.log(JSON.stringify({ site, url, listening: pidOnPort().length > 0, worktree: state?.worktree ?? null }, null, 2))
  process.exit(0)
}

// public-hoist-pattern 把 @heroui/* 提升到根，新 worktree 可能提升成 web-next 的 3.x，apps/web 整站 500（R12/R15/R17-02172/R18-02306）。
// start 时把根软链临时指向本 app 声明的版本，stop 时还原；只动 node_modules 软链，不碰受跟踪文件。
// 备份按 worktree 区分：两个 worktree 交替启动同一站点时，接管方不会覆盖被接管方的备份
const hoistLinkOf = (wt) => join(wt, 'node_modules', '@heroui', 'react')
const hoistBackupOf = (wt) => join(stateDir, `${site}-${conf.port}-${createHash('sha1').update(wt).digest('hex').slice(0, 8)}.hoist`)
const hoistLink = hoistLinkOf(worktree)
const hoistBackup = hoistBackupOf(worktree)
function fixHoist() {
  try {
    const want = JSON.parse(readFileSync(join(worktree, conf.app, 'package.json'), 'utf8')).dependencies?.['@heroui/react']
    const cur = readlinkSync(hoistLink)
    if (!want || cur.includes(`@heroui+react@${want}_`)) return
    const hit = readdirSync(join(worktree, 'node_modules', '.pnpm')).find((d) => d.startsWith(`@heroui+react@${want}_`))
    if (!hit) return
    writeFileSync(hoistBackup, cur)
    unlinkSync(hoistLink)
    symlinkSync(`../.pnpm/${hit}/node_modules/@heroui/react`, hoistLink)
    console.log(`hoist: 根 @heroui/react 临时指向 ${want}（stop 时还原）`)
  } catch (e) {
    console.log(`hoist: 跳过（${e.message}）`)
  }
}
function restoreHoist(wt = worktree) {
  const backup = hoistBackupOf(wt)
  if (!existsSync(backup)) return
  try {
    unlinkSync(hoistLinkOf(wt))
    symlinkSync(readFileSync(backup, 'utf8'), hoistLinkOf(wt))
    console.log(`hoist: 已还原 ${wt} 的根 @heroui/react`)
  } catch (e) {
    console.log(`hoist: 还原失败（${e.message}），备份在 ${backup}`)
    return
  }
  rmSync(backup, { force: true })
}

if (cmd === 'stop') {
  // 只停自己 worktree 起的：端口被别的会话接管时，stop 不能把对方的 dev server 杀掉
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null
  if (state && state.worktree !== worktree) {
    restoreHoist()
    console.log(`not stopped: ${url} 现在属于 ${state.worktree}，不是 ${worktree}`)
    process.exit(0)
  }
  for (const pid of pidOnPort()) process.kill(Number(pid), 'SIGTERM')
  rmSync(stateFile, { force: true })
  restoreHoist()
  // Next dev 会改写已跟踪的 next-env.d.ts（引号/分号），留着会让 check.mjs 的 biome 报错（R17-02265）
  const nextEnv = join(conf.app, 'next-env.d.ts')
  try {
    if (execSync(`git -C "${worktree}" diff --name-only -- "${nextEnv}"`, { encoding: 'utf8' }).trim()) {
      execSync(`git -C "${worktree}" checkout -- "${nextEnv}"`)
      console.log(`restored ${nextEnv}`)
    }
  } catch {}
  console.log(`stopped ${site} (${url})`)
  process.exit(0)
}

// 全机限流：整台机器同时最多 maxDev 个（默认 4，可热调）由 dev.mjs 启动且仍在监听的 dev server，超出就排队等待。
// 依据：16G 内存的 mac 上 3 个以上 Next dev 同时冷启动会耗尽内存卡死（2026-10-18 三次强制重启）。
// 上限可热调：环境变量 > ~/.config/prd-to-commit/dev/max-dev 文件 > 默认 4（排队中每次重试都重新读取）
const readMaxDev = () => {
  if (process.env.P2C_MAX_DEV) return Number(process.env.P2C_MAX_DEV)
  try { return Number(readFileSync(join(stateDir, 'max-dev'), 'utf8').trim()) || 4 } catch { return 4 }
}
let maxDev = readMaxDev()
const liveDevServers = () => readdirSync(stateDir).filter((f) => f.endsWith('.json')).map((f) => {
  try {
    const st = JSON.parse(readFileSync(join(stateDir, f), 'utf8'))
    const port = Number(new URL(st.url).port)
    const alive = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN || true`, { encoding: 'utf8' }).trim().length > 0
    return alive ? { ...st, file: f } : null
  } catch {
    return null
  }
}).filter((st) => st && st.url !== url)
if (cmd === 'start') {
  const deadline = Date.now() + Number(process.env.P2C_DEV_WAIT_MIN || 40) * 60000
  let live = liveDevServers()
  while (live.length >= maxDev) {
    if (Date.now() > deadline) {
      console.log(`busy-slots: 全机已有 ${live.length} 个 dev server（上限 ${maxDev}），等待超时未启动：${live.map((l) => l.url).join(', ')}`)
      process.exit(5)
    }
    console.log(`waiting-slot: 全机已有 ${live.length}/${maxDev} 个 dev server（${live.map((l) => l.url).join(', ')}），30 秒后重试…`)
    await new Promise((r) => setTimeout(r, 30000))
    maxDev = readMaxDev()
    live = liveDevServers()
  }
}

// start：同一站点同一时间只跑一个 dev server（端口固定），占用者若是别的 worktree 就先停掉
const appDir = join(worktree, conf.app)
if (!existsSync(appDir)) throw new Error(`${appDir} 不存在`)
const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : null
const wantMsw = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true'
if (pidOnPort().length) {
  const ours = state?.worktree === worktree
  // MSW 开关只在启动时读：已在跑的进程开关不同，直接复用会让 mock 不生效（或该真连接口时被 mock）
  if (ours && Boolean(state.msw) === wantMsw && (await waitReady(5000))) {
    console.log(`already running: ${url}${conf.basePath}  (worktree ${worktree})`)
    process.exit(0)
  }
  // 别的 worktree 占着：对方 worktree 已不存在或启动超过 2 小时才视为遗留、自动接管；否则可能是另一个会话正在验证
  const stale = !state || !existsSync(state.worktree) || Date.now() - Date.parse(state.startedAt) > 2 * 3600000
  if (!ours && (rest.includes('--no-steal') || (!stale && !rest.includes('--steal')))) {
    console.log(`busy: ${url} 正被 ${state?.worktree ?? '未知进程'} 占用（启动于 ${state?.startedAt ?? '未知'}）。确认对方会话已结束后加 --steal 重跑；或用 P2C_PORT_OFFSET=<n> 换一组端口（无登录态，只适合 auth=false + mocks）`)
    process.exit(4)
  }
  if (ours) console.log(`restarting: MSW ${state.msw ? 'on' : 'off'} → ${wantMsw ? 'on' : 'off'}`)
  for (const pid of pidOnPort()) process.kill(Number(pid), 'SIGTERM')
  if (state && !ours) restoreHoist(state.worktree)
  await new Promise((r) => setTimeout(r, 2000))
}
if (conf.install && !existsSync(join(appDir, 'node_modules'))) {
  console.log(`installing deps for ${site} (${conf.install}) ...`)
  execSync(conf.install, { cwd: appDir, stdio: 'inherit' })
}
fixHoist()
const log = join(stateDir, portOffset ? `${site}-${conf.port}.log` : `${site}.log`)
const child = spawn('sh', ['-c', conf.start.replaceAll('{port}', String(conf.port))], {
  cwd: appDir, detached: true, stdio: ['ignore', openSync(log, 'w'), openSync(log, 'a')],
  env: { ...process.env, BROWSER: 'none' },
})
child.unref()
writeFileSync(stateFile, `${JSON.stringify({ site, worktree, url, pid: child.pid, log, msw: wantMsw, startedAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`starting ${site} in ${appDir} → ${url}${conf.basePath}  (log: ${log})`)
if (!(await waitReady(300000))) {
  console.error(`dev server 5 分钟内未就绪，看日志：${log}`)
  process.exit(1)
}
console.log(`ready: ${url}${conf.basePath}`)
