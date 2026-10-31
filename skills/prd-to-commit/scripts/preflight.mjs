#!/usr/bin/env node
// 开工前预检（§0）：远端有没有同需求分支、是否已合入 online、base 历史里是否已有该需求提交、本地 worktree 是否存在。
// usage: preflight.mjs <PROJECT-ID> [--repo ~/github/fameex-web] [--base origin/online]
// exit: 0 干净 | 10 远端有在途分支（先问用户） | 20 已合入 online（复核补缺模式）
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const id = args[0]
if (!id || id.startsWith('--')) {
  console.error('usage: preflight.mjs <PROJECT-ID> [--repo <path>] [--base origin/online]')
  process.exit(1)
}
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const repo = option('--repo', join(homedir(), 'github', 'fameex-web'))
const base = option('--base', 'origin/online')
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const tryGit = (...gitArgs) => { try { return git(...gitArgs) } catch { return '' } }

// 只按编号匹配（PR-01723 与 fix/BUG-01723 同号不同前缀，仍列出但标明类型），编号前后不能紧跟数字
const number = id.replace(/^[A-Za-z]+-?/, '').replace(/^0+/, '')
const numberPattern = new RegExp(`(^|[^0-9])0*${number}([^0-9]|$)`)
const prefix = (id.match(/^[A-Za-z]+/) ?? [''])[0].toUpperCase()

if (base.startsWith('origin/')) tryGit('fetch', '-q', 'origin', base.slice('origin/'.length))
const baseSha = git('rev-parse', '--short', base)

const remoteBranches = git('ls-remote', '--heads', 'origin').split('\n')
  .map((line) => line.split('\t')[1]?.replace('refs/heads/', ''))
  .filter((name) => name && numberPattern.test(name))

const branches = remoteBranches.map((name) => {
  // 前缀要整词匹配：R20-02306 的前缀 R 不能命中 feature/PR-02306
  const samePrefix = prefix ? new RegExp(`(^|[^A-Z])${prefix}[-_]`).test(name.toUpperCase()) : true
  // 同编号不同前缀（fix/BUG-01723、feature/PM-2003）大概率不是同一需求：只列出，不 fetch
  if (!samePrefix) return { name, merged: false, ahead: 0, last: '', samePrefix }
  tryGit('fetch', '-q', 'origin', `${name}:refs/remotes/origin/${name}`)
  let merged = false
  try { git('merge-base', '--is-ancestor', `origin/${name}`, base); merged = true } catch { merged = false }
  const ahead = Number(tryGit('rev-list', '--count', `${base}..origin/${name}`) || 0)
  const last = tryGit('log', '-1', '--format=%cs %an', `origin/${name}`)
  return { name, merged, ahead, last, samePrefix }
})

// base 历史里提交信息提及该编号（同事首轮已合入时常见）
const baseHits = tryGit('log', '--format=%h %cs %s', '-i', '--grep', `${prefix ? `(^|[^A-Za-z])${prefix}[-_]?` : ''}0*${number}([^0-9]|$)`, '-E', base)
  .split('\n').filter(Boolean)
const worktree = join(homedir(), 'github', id)
const worktreeExists = existsSync(worktree)

const inProgress = branches.filter((b) => b.samePrefix && !b.merged && b.ahead > 0)
const merged = branches.filter((b) => b.samePrefix && b.merged)
const otherPrefix = branches.filter((b) => !b.samePrefix)

console.log(`preflight ${id}（base ${base} = ${baseSha}）`)
for (const b of branches) {
  if (!b.samePrefix) { console.log(`  远端 ${b.name}: 编号同、前缀不同，视为无关`); continue }
  console.log(`  远端 ${b.name}: ${b.merged ? '已合入 base' : `领先 base ${b.ahead} 提交`}，最近 ${b.last || '-'}`)
}
if (!branches.length) console.log('  远端: 无同编号分支')
console.log(`  base 历史提及该需求的提交: ${baseHits.length}${baseHits.length ? `（最早 ${baseHits.at(-1)}；最近 ${baseHits[0]}）` : ''}`)
console.log(`  本地 worktree ${worktree}: ${worktreeExists ? '已存在' : '无'}`)

let verdict
let code = 0
if (inProgress.length) {
  verdict = `远端有在途分支（${inProgress.map((b) => b.name).join(', ')}）：先问用户——是否以该分支的契约层为准、本次用什么分支名；分支里的产出未经用户指定不作为输入。`
  code = 10
} else if (merged.length || baseHits.length) {
  verdict = '该需求已有实现合入 base：进入「复核补缺」模式——清单每行先核对 base 现状，已满足写「已兼容」，冷读提示注明行为可能已在 base 实现。'
  code = 20
} else {
  verdict = `干净：可直接建 worktree（feature/${id}）。${otherPrefix.length ? '注意同编号不同前缀的分支与本需求无关。' : ''}`
}
console.log(`结论: ${verdict}`)
process.exit(code)
