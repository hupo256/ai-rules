#!/usr/bin/env node
// 服务端组件误引 hook 检查（Next App Router）：从 app/**/page|layout|template|default|loading|error|not-found 等服务端入口出发，
// 沿「没有 'use client'」的模块往下找 import，若链上有本次改动的文件调用了 React hook，就报出来（整页 500，tsc 查不出）。
// usage: rsc-hooks-check.mjs [--base <rev>]   （在 worktree 根目录运行）
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/online'
const sh = (c, a) => execFileSync(c, a, { encoding: 'utf8' }).trim()
const root = process.cwd()
const mergeBase = sh('git', ['merge-base', 'HEAD', base])
const changed = new Set([
  ...sh('git', ['diff', '--name-only', '--diff-filter=ACMR', mergeBase]).split('\n'),
  ...sh('git', ['ls-files', '--others', '--exclude-standard']).split('\n'),
].filter(Boolean).map((f) => resolve(root, f)))

const ENTRY = /^(page|layout|template|default|loading|error|not-found|route)\.(t|j)sx?$/
const HOOK = /\buse(State|Effect|LayoutEffect|Memo|Callback|Ref|Context|Reducer|Pathname|Router|SearchParams|Params|Query|Mutation|InfiniteQuery|SuspenseQuery|QueryClient|Translation|T|Store|AtomValue|Atom)\s*[(<]/
const isClient = (src) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(src)
const read = (f) => { try { return readFileSync(f, 'utf8') } catch { return '' } }

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (ENTRY.test(name)) out.push(p)
  }
  return out
}

function resolveImport(spec, fromFile, srcRoot) {
  let target
  if (spec.startsWith('@/')) target = join(srcRoot, spec.slice(2))
  else if (spec.startsWith('.')) target = resolve(dirname(fromFile), spec)
  else return null
  for (const cand of [target, ...['.ts', '.tsx', '.js', '.jsx'].map((e) => target + e), ...['ts', 'tsx', 'js', 'jsx'].map((e) => join(target, `index.${e}`))]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand
  }
  return null
}

const problems = []
for (const app of readdirSync(join(root, 'apps'))) {
  const srcRoot = join(root, 'apps', app, 'src')
  const appDir = join(srcRoot, 'app')
  if (!existsSync(appDir)) continue
  for (const entry of walk(appDir)) {
    const src = read(entry)
    if (isClient(src)) continue
    // BFS 只穿过服务端模块（没有 'use client'）；碰到 'use client' 边界就停
    const seen = new Set([entry])
    const queue = [[entry, [entry]]]
    while (queue.length) {
      const [file, chain] = queue.shift()
      const code = read(file)
      if (file !== entry && changed.has(file) && HOOK.test(code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''))) {
        problems.push({ file, chain })
      }
      if (chain.length > 6) continue
      for (const [, typeOnly, spec] of code.matchAll(/(?:import|export)\s+(type\s)?[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
        if (typeOnly) continue
        const next = resolveImport(spec, file, srcRoot)
        if (!next || seen.has(next)) continue
        seen.add(next)
        if (isClient(read(next))) continue
        queue.push([next, [...chain, next]])
      }
    }
  }
}

// 起点版本里同一文件已经调用 hook（存量引用链，本次没新引入）→ 记 pre-existing，不算 FAIL（R17-01973 误报 markets/layout → public-info）
const stripComments = (code) => code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
const baseHasHook = (file) => {
  try { return HOOK.test(stripComments(execFileSync('git', ['show', `${mergeBase}:${relative(root, file)}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))) } catch { return false }
}
const preExisting = problems.filter((p) => baseHasHook(p.file))
for (const p of preExisting) console.log(`rsc-hooks: pre-existing（起点已有，不计 FAIL）${relative(root, p.file)}`)
const uniq = new Map(problems.filter((p) => !baseHasHook(p.file)).map((p) => [p.file, p]))
if (!uniq.size) {
  console.log('rsc-hooks: pass（服务端入口可达的改动文件里没有 hook 调用）')
} else {
  console.log(`rsc-hooks: FAIL ${uniq.size} 个文件被服务端组件 import 却调用了 hook（运行时整页 500）：`)
  for (const { file, chain } of uniq.values()) {
    console.log(`  - ${relative(root, file)}\n      引用链：${chain.map((f) => relative(root, f)).join(' → ')}\n      修法：把 hook 拆到单独的 'use client' 文件，或让服务端入口只 import 不含 hook 的纯模块`)
  }
  process.exitCode = 1
}
