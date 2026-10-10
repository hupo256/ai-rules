#!/usr/bin/env node
// 建立或复用 ~/github/<PROJECT-ID> worktree（默认 feature/<ID>，--fix 用 fix/<ID>，--branch 自定义），按需安装依赖。
// usage: worktree.mjs <PROJECT-ID> [--fix | --branch <name>] [--base origin/online] [--repo ~/github/fameex-web] [--skip-install]
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const id = args[0]
if (!id || id.startsWith('--')) {
  console.error('usage: worktree.mjs <PROJECT-ID> [--fix | --branch <name>] [--base origin/online] [--repo <path>] [--skip-install]')
  process.exit(1)
}
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const repo = option('--repo', join(homedir(), 'github', 'fameex-web'))
const base = option('--base', 'origin/online')
const branch = option('--branch', `${args.includes('--fix') ? 'fix' : 'feature'}/${id}`)
const path = join(homedir(), 'github', id)
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: repo, encoding: 'utf8' }).trim()

if (existsSync(path)) {
  const current = execFileSync('git', ['branch', '--show-current'], { cwd: path, encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: path, encoding: 'utf8' }).trim()
  console.log(`reuse: ${path}\nbranch: ${current || '(detached)'}\ndirty: ${dirty ? 'yes' : 'no'}`)
  if (current && current !== branch) console.log(`WARNING: expected ${branch}`)
} else {
  if (base.startsWith('origin/')) git('fetch', 'origin', base.slice('origin/'.length))
  // 远端已有同名分支：通常是历史实现或别人的分支，不要在其上叠加，提示后由用户决定
  const remote = git('ls-remote', '--heads', 'origin', branch)
  const branchExists = git('branch', '--list', branch) !== ''
  if (remote && !branchExists) {
    console.log(`WARNING: origin/${branch} 已存在（${remote.slice(0, 10)}）。如需另起分支，用 --branch <其他名字>（例如 ${branch}-v2）重跑；如要在远端分支上继续，先 git fetch 并建本地跟踪分支。本次不创建。`)
    process.exit(3)
  }
  if (branchExists) git('worktree', 'add', path, branch)
  else git('worktree', 'add', '-b', branch, path, base)
  console.log(`created: ${path}\nbranch: ${branch}${branchExists ? ' (existing local)' : ` from ${base}`}`)
}

if (!args.includes('--skip-install') && !existsSync(join(path, 'node_modules'))) {
  console.log('installing deps (pnpm install --prefer-offline)...')
  execFileSync('pnpm', ['install', '--prefer-offline', '--frozen-lockfile'], { cwd: path, stdio: 'inherit' })
}
console.log(`base: ${execFileSync('git', ['merge-base', 'HEAD', base], { cwd: path, encoding: 'utf8' }).trim()}`)
