#!/usr/bin/env node
// 在 worktree 里按固定端口启动/停止/查看本地 dev server（站点配置见 browser-sites.json）。
// usage: dev.mjs start|stop|status <worktree-path> --site web|admin|futures-admin|legacy-admin|futures-legacy-admin
import { execSync, spawn } from 'node:child_process'
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
const hoistLink = join(worktree, 'node_modules', '@heroui', 'react')
const hoistBackup = join(stateDir, `${site}-${conf.port}.hoist`)
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
function restoreHoist() {
  if (!existsSync(hoistBackup)) return
  try {
    unlinkSync(hoistLink)
    symlinkSync(readFileSync(hoistBackup, 'utf8'), hoistLink)
    console.log('hoist: 已还原根 @heroui/react')
  } catch (e) {
    console.log(`hoist: 还原失败（${e.message}），备份在 ${hoistBackup}`)
    return
  }
  rmSync(hoistBackup, { force: true })
}

if (cmd === 'stop') {
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
if (pidOnPort().length) {
  if (state?.worktree === worktree && (await waitReady(5000))) {
    console.log(`already running: ${url}${conf.basePath}  (worktree ${worktree})`)
    process.exit(0)
  }
  // --no-steal：多个会话并发验证时，不停掉别人的 dev server，交给调用方稍后重试
  if (rest.includes('--no-steal')) {
    console.log(`busy: ${url} 正被 ${state?.worktree ?? '未知 worktree'} 占用（--no-steal，未启动）`)
    process.exit(4)
  }
  for (const pid of pidOnPort()) process.kill(Number(pid), 'SIGTERM')
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
writeFileSync(stateFile, `${JSON.stringify({ site, worktree, url, pid: child.pid, log, startedAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`starting ${site} in ${appDir} → ${url}${conf.basePath}  (log: ${log})`)
if (!(await waitReady(300000))) {
  console.error(`dev server 5 分钟内未就绪，看日志：${log}`)
  process.exit(1)
}
console.log(`ready: ${url}${conf.basePath}`)
