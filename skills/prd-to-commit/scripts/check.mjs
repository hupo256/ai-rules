#!/usr/bin/env node
// 只检查本次改动：
// - 现代工程：biome（改动文件）+ tsc（受影响 app，只报告落在「改动行」上的错误，存量错误不归本次）
// - legacy Vue2/JS（biome、tsc 都不覆盖）：JS 与 .vue 的 <script> 做 ESM 语法检查；.vue 模板无编译器，报 not-covered
// - 改动/新增的测试文件：vitest 只跑这些文件
// usage: check.mjs [--base origin/online]   （在 worktree 根目录运行；--base 可为分支或 commit）
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/online'
const sh = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim()

const mergeBase = sh('git', ['merge-base', 'HEAD', base])
const untracked = sh('git', ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
const changed = [...new Set([
  ...sh('git', ['diff', '--name-only', '--diff-filter=ACMR', mergeBase]).split('\n'),
  ...untracked,
])].filter((file) => file && existsSync(file))
const isLegacy = (file) => /\/legacy-admin\//.test(file)
const code = changed.filter((file) => /\.(tsx?|jsx?)$/.test(file) && !isLegacy(file))
const legacy = changed.filter((file) => isLegacy(file) && /\.(js|vue)$/.test(file))
const tests = changed.filter((file) => /\.test\.(tsx?|jsx?)$/.test(file))
console.log(`changed: ${changed.length} files (${code.length} code, ${legacy.length} legacy, ${tests.length} test)`)

// 每个改动文件的新增/修改行号集合
function changedLines(file) {
  if (untracked.includes(file)) return new Set(readFileSync(file, 'utf8').split('\n').map((_, i) => i + 1))
  const lines = new Set()
  for (const [, start, count] of sh('git', ['diff', '-U0', mergeBase, '--', file]).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    for (let i = 0; i < Number(count ?? 1); i++) lines.add(Number(start) + i)
  }
  return lines
}

let failed = false

if (code.length) {
  const biome = spawnSync('npx', ['biome', 'check', '--no-errors-on-unmatched', '--files-ignore-unknown=true', ...code], { encoding: 'utf8' })
  if (biome.status !== 0) {
    failed = true
    console.log(`\n[biome] FAIL\n${(biome.stdout + biome.stderr).split('\n').slice(-60).join('\n')}`)
  } else console.log('[biome] pass')

  const apps = [...new Set(code.map((file) => file.match(/^(apps\/[^/]+)\//)?.[1]).filter(Boolean))]
  for (const app of apps) {
    if (!existsSync(`${app}/tsconfig.json`)) continue
    const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', app], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const errors = (tsc.stdout + tsc.stderr).split('\n').filter((line) => /error TS\d+/.test(line))
    const appFiles = code.filter((file) => file.startsWith(`${app}/`))
    const lineMap = new Map(appFiles.map((file) => [file, changedLines(file)]))
    const inFiles = []
    const onChangedLines = []
    for (const line of errors) {
      const match = line.match(/^(.+?)\((\d+),\d+\): error/)
      if (!match) continue
      const file = appFiles.find((f) => f === match[1] || f === `${app}/${match[1]}`)
      if (!file) continue
      inFiles.push(line)
      if (lineMap.get(file).has(Number(match[2]))) onChangedLines.push(line)
    }
    if (onChangedLines.length) {
      failed = true
      console.log(`\n[tsc ${app}] ${onChangedLines.length} error(s) on changed lines\n${onChangedLines.slice(0, 40).join('\n')}`)
    } else console.log(`[tsc ${app}] pass`)
    const preexisting = inFiles.length - onChangedLines.length
    if (preexisting) console.log(`  note: ${preexisting} pre-existing error(s) in changed files on untouched lines (ignored); ${errors.length} total in app`)
  }
}

if (legacy.length) {
  const syntaxErrors = []
  for (const file of legacy) {
    const source = readFileSync(file, 'utf8')
    const script = file.endsWith('.vue') ? source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1] : source
    if (script == null) continue
    const result = spawnSync('node', ['--input-type=module', '--check'], { input: script, encoding: 'utf8' })
    if (result.status !== 0) syntaxErrors.push(`${file}\n${result.stderr.split('\n').slice(0, 6).join('\n')}`)
  }
  if (syntaxErrors.length) {
    failed = true
    console.log(`\n[legacy syntax] FAIL\n${syntaxErrors.join('\n')}`)
  } else console.log(`[legacy syntax] pass (${legacy.length} files: JS + .vue <script>)`)
  const vueFiles = legacy.filter((file) => file.endsWith('.vue'))
  console.log(`[legacy] not-covered: biome/tsc 不覆盖 legacy；${vueFiles.length} 个 .vue 模板未编译校验，需人工或浏览器核对`)
}

if (tests.length) {
  const vitest = spawnSync('npx', ['vitest', 'run', ...tests], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const tail = (vitest.stdout + vitest.stderr).split('\n').filter((line) => /Test Files|Tests |FAIL|✗|×/.test(line)).slice(0, 20).join('\n')
  if (vitest.status !== 0) {
    failed = true
    console.log(`\n[vitest] FAIL\n${tail}`)
  } else console.log(`[vitest] pass\n${tail}`)
}

process.exit(failed ? 1 : 0)
