#!/usr/bin/env node
// 只检查本次改动：
// - 现代工程：biome（改动文件）+ tsc（受影响 app，只报告落在「改动行」上的错误，存量错误不归本次）
// - 代码规则：code-rules.mjs（biome/tsc 不覆盖的 error 级约定，只看改动行；legacy 不扫）
// - legacy Vue2/JS（biome、tsc 都不覆盖）：JS 与 .vue 的 <script> 做 ESM 语法检查；.vue 模板无编译器，报 not-covered
// - 改动/新增的测试文件：vitest 只跑这些文件（app 有自己的 vitest.config 时在 app 目录用它跑）；
//   有失败时自动在 base 的临时 worktree 复跑，base 上同样失败的标为 pre-existing、不算本次 FAIL
// - TanStack 路由（有 src/routeTree.gen.ts 的 app）：routes 有增删改名但路由树没更新时直接报出
// usage: check.mjs [--base origin/online]   （在 worktree 根目录运行；--base 可为分支或 commit）
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// TanStack Start 的路由树由 vite 插件在 dev/build 时生成；只增删 routes 文件而不重新生成，tsc 会报出难懂的路由类型错误。
// 逐个核对：新增/改名的路由文件要出现在 routeTree.gen.ts 的 import 里，删除的不能还在（`-` 前缀与 test/ 下的文件不是路由）
const isRouteFile = (file) => /^apps\/[^/]+\/src\/routes\//.test(file) && /\.(tsx?|jsx?)$/.test(file) &&
  !file.split('/').some((part) => part.startsWith('-') || part === 'test')
const routeEntry = (file) => `./${file.replace(/^apps\/[^/]+\/src\//, '').replace(/\.(tsx?|jsx?)$/, '')}'`
const routeChanges = [
  ...untracked.filter(isRouteFile).map((file) => ({ file, removed: false })),
  ...sh('git', ['diff', '--name-status', '--find-renames', mergeBase]).split('\n').filter(Boolean).flatMap((line) => {
    const [status, ...paths] = line.split('\t')
    if (status.startsWith('A')) return [{ file: paths[0], removed: false }]
    if (status.startsWith('D')) return [{ file: paths[0], removed: true }]
    if (status.startsWith('R')) return [{ file: paths[0], removed: true }, { file: paths[1], removed: false }]
    return []
  }).filter(({ file }) => isRouteFile(file)),
]
const staleRoutes = routeChanges.filter(({ file, removed }) => {
  const tree = `${file.match(/^(apps\/[^/]+)\//)[1]}/src/routeTree.gen.ts`
  if (!existsSync(tree)) return false
  return readFileSync(tree, 'utf8').includes(routeEntry(file)) === removed
})
if (staleRoutes.length) {
  failed = true
  console.log(`\n[routeTree] FAIL: 路由树未随 routes 更新（${staleRoutes.map(({ file, removed }) => `${removed ? '已删除' : '新增'} ${file}`).join('；')}）。用 dev.mjs start 起一次该 app 的 dev server 让插件重新生成 src/routeTree.gen.ts（生成后 stop），并一起提交`)
}

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

// 代码规则（code-rules.mjs）：biome/tsc 管不到的 error 级约定（组件直连 fetch、parse as、mock 泄漏、300 行等），只看改动行
// 除 code 外也要传 package.json/.scss/.env（E2E-001、STYLE-001、MOCK-004 看这些）；legacy 不扫；退出码 2 = 工具失败，同样算 FAIL
const ruleFiles = changed.filter((file) => !isLegacy(file))
if (ruleFiles.length) {
  const script = fileURLToPath(new URL('./code-rules.mjs', import.meta.url))
  const rules = spawnSync('node', [script, '--base', base, '--files', ruleFiles.join(',')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (rules.status !== 0) {
    failed = true
    console.log(`\n[code-rules] FAIL${rules.status === 1 ? '' : ' (tool failure)'}\n${(rules.stdout + rules.stderr).trim()}`)
  } else console.log('[code-rules] pass')
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

const vitestConfigNames = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs']

// 在 root（worktree 根目录）下跑 vitest，返回失败用例 id（仓库相对路径 > 用例名）与失败文件。
// app 自带 vitest.config 时在 app 目录用它跑（含 setupFiles、环境、别名）；否则根 vitest workspace 把 `@` 指向 apps/web/src，
// 其他 app 用临时配置把 `@` 改指本 app，否则带 `@` 导入的测试必然失败。
function runVitest(files, app, root) {
  const ownConfig = app ? vitestConfigNames.find((name) => existsSync(join(root, app, name))) : undefined
  let cwd = root
  let runFiles = files
  let configArgs = []
  if (ownConfig) {
    cwd = join(root, app)
    runFiles = files.map((file) => relative(app, file))
    configArgs = ['--config', ownConfig]
  } else if (app && app !== 'apps/web') {
    mkdirSync(join(root, 'node_modules/.cache'), { recursive: true })
    const config = join(root, `node_modules/.cache/p2c-vitest.${app.replaceAll('/', '_')}.mts`)
    writeFileSync(config, `import { defineConfig } from 'vitest/config'\nexport default defineConfig({ root: ${JSON.stringify(root)}, resolve: { alias: { '@': ${JSON.stringify(`${root}/${app}/src`)} } }, test: { include: ${JSON.stringify(files)} } })\n`)
    configArgs = ['--config', config]
  }
  const result = spawnSync('npx', ['vitest', 'run', ...configArgs, ...runFiles], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = result.stdout + result.stderr
  const prefix = ownConfig ? `${app}/` : ''
  const failures = new Set()
  const failedFiles = new Set()
  for (const [, file, name] of output.matchAll(/^\s*FAIL\s+(\S+?\.test\.[jt]sx?)(?:\s+\[[^\]]*\])?(?:\s+>\s+(.+?))?\s*$/gm)) {
    failedFiles.add(`${prefix}${file}`)
    failures.add(`${prefix}${file} > ${name ?? '(suite)'}`)
  }
  return { ok: result.status === 0, output, failures, failedFiles }
}

// base 的临时 worktree：复用当前 worktree 的依赖（软链 node_modules），只用来复跑失败的测试
function withBaseWorktree(apps, fn) {
  const dir = join(tmpdir(), `p2c-base-${mergeBase.slice(0, 10)}-${process.pid}`)
  const added = spawnSync('git', ['worktree', 'add', '--detach', dir, mergeBase], { encoding: 'utf8' })
  if (added.status !== 0) throw new Error(`无法创建 base worktree：${added.stderr.trim()}`)
  const links = ['node_modules', ...apps.filter(Boolean).map((app) => `${app}/node_modules`)].filter((path) => existsSync(path))
  try {
    for (const path of links) symlinkSync(join(process.cwd(), path), join(dir, path))
    return fn(dir)
  } finally {
    // 只解除软链（不能递归删除，否则会顺着软链删掉当前 worktree 的依赖），再移除临时 worktree
    for (const path of links) {
      const link = join(dir, path)
      if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link)
    }
    spawnSync('git', ['worktree', 'remove', '--force', dir])
  }
}

const existsAtBase = (file) => spawnSync('git', ['cat-file', '-e', `${mergeBase}:${file}`]).status === 0

if (tests.length) {
  const byApp = new Map()
  for (const file of tests) {
    const app = file.match(/^(apps\/[^/]+)\//)?.[1] ?? null
    // legacy 工程没有 `@` 别名约定，沿用根配置
    const key = isLegacy(file) ? null : app
    byApp.set(key, [...(byApp.get(key) ?? []), file])
  }
  const runs = [...byApp].map(([app, files]) => ({ app, files, run: runVitest(files, app, process.cwd()) }))
  const retry = runs.filter(({ run }) => !run.ok && [...run.failedFiles].some(existsAtBase))
  const baseFailures = new Set()
  if (retry.length) {
    withBaseWorktree(retry.map(({ app }) => app), (dir) => {
      for (const { app, run } of retry) {
        const files = [...run.failedFiles].filter(existsAtBase)
        for (const id of runVitest(files, app, dir).failures) baseFailures.add(id)
      }
    })
  }
  for (const { app, run } of runs) {
    const label = `[vitest${app ? ` ${app}` : ''}]`
    const tail = run.output.split('\n').filter((line) => /Test Files|Tests /.test(line)).slice(0, 4).join('\n')
    if (run.ok) {
      console.log(`${label} pass\n${tail}`)
      continue
    }
    const preexisting = [...run.failures].filter((id) => baseFailures.has(id))
    const fresh = [...run.failures].filter((id) => !baseFailures.has(id))
    // 解析不到失败用例（如运行器自身报错）时按 FAIL 处理，不做 pre-existing 豁免
    if (fresh.length || !run.failures.size) {
      failed = true
      const detail = fresh.length ? fresh.map((id) => `  × ${id}`).join('\n') : run.output.split('\n').slice(-30).join('\n')
      console.log(`\n${label} FAIL\n${tail}\n${detail}`)
    } else console.log(`${label} pass（除 base ${mergeBase.slice(0, 10)} 上同样失败的用例）\n${tail}`)
    if (preexisting.length) console.log(`  pre-existing: ${preexisting.length} 个用例在 base 上同样失败，不归本次：\n${preexisting.map((id) => `  - ${id}`).join('\n')}`)
  }
}

process.exit(failed ? 1 : 0)
