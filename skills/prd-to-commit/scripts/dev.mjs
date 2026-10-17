#!/usr/bin/env node
// 在 worktree 里按固定端口启动/停止/查看本地 dev server（站点配置见 browser-sites.json）。
// usage: dev.mjs start|stop|status <worktree-path> --site web|admin|futures-admin|legacy-admin|futures-legacy-admin
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

if (cmd === 'stop') {
  for (const pid of pidOnPort()) process.kill(Number(pid), 'SIGTERM')
  rmSync(stateFile, { force: true })
  console.log(`stopped ${site} (${url})`)
  process.exit(0)
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
