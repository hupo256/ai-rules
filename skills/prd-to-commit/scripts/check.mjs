#!/usr/bin/env node
// 只检查本次改动：
// - 现代工程：biome（改动文件）+ tsc（受影响 app，只报告落在「改动行」上的错误，存量错误不归本次）
// - 代码规则：code-rules.mjs（biome/tsc 不覆盖的 error 级约定，只看改动行；legacy 不扫）
// - legacy Vue2/JS（biome、tsc 都不覆盖）：JS 与 .vue 的 <script> 做 ESM 语法检查；.vue 模板无编译器，报 not-covered
// - 改动/新增的测试文件：vitest 只跑这些文件（app 有自己的 vitest.config 时在 app 目录用它跑）；
//   有失败时自动在 base 的临时 worktree 复跑，base 上同样失败的标为 pre-existing、不算本次 FAIL
// - 服务端组件误引 hook：rsc-hooks-check.mjs（从 app/**/page|layout 出发沿非 'use client' 模块找到改动文件里的 hook 调用）
// - TanStack 路由（有 src/routeTree.gen.ts 的 app）：routes 有增删改名但路由树没更新时直接报出
// usage: check.mjs [--base origin/online]   （在 worktree 根目录运行；--base 可为分支或 commit）
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'origin/online'
const sh = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim()

const mergeBase = sh('git', ['merge-base', 'HEAD', base])
// 新建文件先登记为 intent-to-add（冷读本来就要求 add -N）：之后统一走 git diff，`mv` 移动/拆分的文件才能按重命名比对，
// 不会把整份文件（连同存量 tsc 错误、300 行等）当成本次新增
const newFiles = sh('git', ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
if (newFiles.length) execFileSync('git', ['add', '-N', '--', ...newFiles])
const untracked = sh('git', ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
// 新路径 → 旧路径
const renames = new Map(sh('git', ['diff', '--name-status', '-M', mergeBase]).split('\n')
  .filter((line) => line.startsWith('R')).map((line) => line.split('\t')).map(([, from, to]) => [to, from]))
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
  const paths = renames.has(file) ? ['-M', mergeBase, '--', renames.get(file), file] : [mergeBase, '--', file]
  for (const [, start, count] of sh('git', ['diff', '-U0', ...paths]).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
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
}

// tsc：改动行上的错误直接 FAIL；其余错误（未改动的调用方、改动文件的未改行）与 base 上同一工程的 tsc 结果比对，多出来的算本次引入。
// 改 packages/* 时跑该包并附带 apps/web；只删文件也要跑（调用方可能断引用）
const deletedCode = sh('git', ['diff', '--name-only', '--diff-filter=D', mergeBase]).split('\n')
  .filter((file) => /\.(tsx?|jsx?)$/.test(file) && !isLegacy(file))
const tsRoots = [...new Set([...code, ...deletedCode].flatMap((file) => {
  const pkg = file.match(/^(packages\/[^/]+)\//)?.[1]
  return pkg ? [pkg, 'apps/web'] : [file.match(/^(apps\/[^/]+)\//)?.[1]]
}))].filter((root) => root && existsSync(`${root}/tsconfig.json`))

function runTsc(root, cwd) {
  const result = spawnSync('npx', ['tsc', '--noEmit', '-p', root], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  const errors = output.split('\n').filter((line) => /error TS\d+/.test(line) && !/(^|\/)\.next\//.test(line))
  // 解析不到任何错误行却非 0 退出（tsc 没装上、TS5xxx 配置错误等）算工具失败，不能当 pass
  const broken = Boolean(result.error) || (result.status !== 0 && !errors.length)
  return { errors, broken, tail: output.split('\n').slice(-15).join('\n') }
}
// 只按「文件 + TS 码」比：同一条存量错误在两次运行里打印的长类型（属性顺序、... N more ...）会不同，比全文会误报
// 当前侧的路径先映射回 base 上的旧路径，移动过的文件里的存量错误才能对上
const errorKey = (line, current = false) => {
  const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+)/)
  if (!match) return line
  return `${current ? (renames.get(match[1]) ?? match[1]) : match[1]} ${match[2]}`
}

if (tsRoots.length) {
  const lineMap = new Map(code.map((file) => [file, changedLines(file)]))
  const results = tsRoots.map((root) => {
    const { errors, broken, tail } = runTsc(root, process.cwd())
    const onChangedLines = []
    const elsewhere = []
    for (const line of errors) {
      const match = line.match(/^(.+?)\((\d+),\d+\): error/)
      const file = match && code.find((f) => f === match[1] || f === `${root}/${match[1]}`)
      if (file && lineMap.get(file).has(Number(match[2]))) onChangedLines.push(line)
      else elsewhere.push(line)
    }
    return { root, broken, tail, onChangedLines, elsewhere }
  })
  const needBase = results.filter((r) => !r.broken && r.elsewhere.length).map((r) => r.root)
  const baseErrors = needBase.length ? baseTscErrors(needBase) : new Map()
  for (const { root, broken, tail, onChangedLines, elsewhere } of results) {
    if (broken) {
      failed = true
      console.log(`\n[tsc ${root}] FAIL (tool failure)\n${tail}`)
      continue
    }
    const baseResult = baseErrors.get(root)
    if (elsewhere.length && baseResult.broken) {
      failed = true
      console.log(`\n[tsc ${root}] FAIL (base tool failure：无法区分存量与新增，${elsewhere.length} 个改动行以外的错误未核对)\n${baseResult.tail}`)
      continue
    }
    // 按多重集合比对：存量错误随改动挪行不算新增，同一文件同类错误多出一次算新增
    const remaining = new Map()
    for (const line of baseResult?.errors ?? []) remaining.set(errorKey(line), (remaining.get(errorKey(line)) ?? 0) + 1)
    const introduced = elsewhere.filter((line) => {
      const key = errorKey(line, true)
      const left = remaining.get(key) ?? 0
      if (left > 0) remaining.set(key, left - 1)
      return left === 0
    })
    if (onChangedLines.length || introduced.length) {
      failed = true
      if (onChangedLines.length) console.log(`\n[tsc ${root}] ${onChangedLines.length} error(s) on changed lines\n${onChangedLines.slice(0, 40).join('\n')}`)
      if (introduced.length) console.log(`\n[tsc ${root}] ${introduced.length} error(s) introduced outside changed lines（base ${mergeBase.slice(0, 10)} 上没有）\n${introduced.slice(0, 40).join('\n')}`)
    } else console.log(`[tsc ${root}] pass${elsewhere.length ? `（${elsewhere.length} 个存量错误与 base 一致，已忽略）` : ''}`)
  }
}

// base 的 tsc 结果按 merge-base + 锁文件缓存在 ~/.prd-cache/_tsc-base/，同一需求反复 check 只算一次
function baseTscErrors(roots) {
  const lock = existsSync('pnpm-lock.yaml') ? createHash('sha1').update(readFileSync('pnpm-lock.yaml')).digest('hex').slice(0, 10) : 'nolock'
  const cacheDir = join(homedir(), '.prd-cache', '_tsc-base')
  const cacheFile = (root) => join(cacheDir, `${mergeBase.slice(0, 12)}-${lock}-${root.replace(/\//g, '_')}.json`)
  const out = new Map()
  const missing = []
  for (const root of roots) {
    if (existsSync(cacheFile(root))) out.set(root, JSON.parse(readFileSync(cacheFile(root), 'utf8')))
    else missing.push(root)
  }
  if (missing.length) {
    console.log(`[tsc] 在 base ${mergeBase.slice(0, 10)} 上跑 tsc 做存量比对：${missing.join(', ')}（首次较慢，之后走缓存）`)
    withBaseWorktree(missing, (dir) => {
      mkdirSync(cacheDir, { recursive: true })
      for (const root of missing) {
        const result = runTsc(root, dir)
        out.set(root, result)
        if (!result.broken) writeFileSync(cacheFile(root), JSON.stringify(result))
      }
    })
  }
  return out
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

// 服务端组件误引 hook（Next App Router）：page/layout 经非 'use client' 模块引到带 hook 的改动文件，运行时整页 500，tsc 查不出（4 次回放踩到）
if (code.length) {
  const script = fileURLToPath(new URL('./rsc-hooks-check.mjs', import.meta.url))
  const rsc = spawnSync('node', [script, '--base', base], { encoding: 'utf8' })
  if (rsc.status !== 0) {
    failed = true
    console.log(`\n[rsc-hooks] FAIL\n${(rsc.stdout + rsc.stderr).trim()}`)
  } else console.log(`[rsc-hooks] ${rsc.stdout.trim()}`)
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
  // node 能解析不代表 legacy 构建链能编译：futures-admin（vue-cli 3 + webpack4）脚本不支持 ?. / ??；Vue 2.5/2.6 模板表达式两个后台都不支持
  const MODERN = /\?\.(?=[\w$[(])|\?\?/
  for (const file of legacy) {
    const lines = changedLines(file)
    const source = readFileSync(file, 'utf8').split('\n')
    const tplEnd = file.endsWith('.vue') ? source.findIndex((l) => /^<\/template>/.test(l)) : -1
    for (const n of lines) {
      const text = (source[n - 1] ?? '').replace(/\/\/.*$/, '').replace(/<!--.*?-->/g, '')
      if (!MODERN.test(text)) continue
      const inTemplate = tplEnd >= 0 && n - 1 < tplEnd
      if (inTemplate || /\/futures-admin\/legacy-admin\//.test(file)) {
        syntaxErrors.push(`${file}:${n} ${inTemplate ? 'Vue 2 模板' : 'futures-admin legacy（vue-cli 3/webpack4）'}不支持 ?. / ??，改用 && 或 == null 判断\n  ${text.trim().slice(0, 120)}`)
      }
    }
  }
  if (syntaxErrors.length) {
    failed = true
    console.log(`\n[legacy syntax] FAIL\n${syntaxErrors.join('\n')}`)
  } else console.log(`[legacy syntax] pass (${legacy.length} files: JS + .vue <script>，含 ?. / ?? 构建链兼容检查)`)
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

// pnpm 的 workspace 依赖是相对软链（apps/web/node_modules/@fameex/types → ../../../../packages/types）：整目录软链过去会解析回
// 当前 worktree 的 packages，base 上看到的就是改过的包。逐项镜像，指向当前 worktree 内（node_modules 之外）的链接改指 base 里的同一路径
function mirrorNodeModules(rel, dir, links) {
  const src = join(process.cwd(), rel)
  mkdirSync(join(dir, rel), { recursive: true })
  for (const name of readdirSync(src)) {
    const from = join(src, name)
    const stat = lstatSync(from)
    if (name.startsWith('@') && stat.isDirectory()) {
      mirrorNodeModules(join(rel, name), dir, links)
      continue
    }
    let target = from
    if (stat.isSymbolicLink()) {
      try {
        const inside = relative(process.cwd(), realpathSync(from))
        if (!inside.startsWith('..') && !inside.split('/').includes('node_modules')) target = join(dir, inside)
      } catch {}
    }
    symlinkSync(target, join(dir, rel, name))
    links.push(join(rel, name))
  }
}

// base 的临时 worktree：复用当前 worktree 的依赖，用来复跑失败的测试和比对 tsc 存量错误
function withBaseWorktree(apps, fn) {
  const dir = join(tmpdir(), `p2c-base-${mergeBase.slice(0, 10)}-${process.pid}`)
  const added = spawnSync('git', ['worktree', 'add', '--detach', dir, mergeBase], { encoding: 'utf8' })
  if (added.status !== 0) throw new Error(`无法创建 base worktree：${added.stderr.trim()}`)
  // 所有 workspace 包的依赖都要镜像：apps/web 编译时会读 packages/* 源码，缺了它们的 node_modules 类型会退化成 any，base 报错偏少
  const workspaces = ['apps', 'packages'].flatMap((top) => (existsSync(top) ? readdirSync(top).map((name) => join(top, name)) : []))
  const roots = [...new Set(['.', ...workspaces, ...apps.filter(Boolean)])]
  const links = []
  try {
    for (const root of roots) {
      if (existsSync(join(root, 'node_modules'))) mirrorNodeModules(join(root, 'node_modules'), dir, links)
      // next-env.d.ts 被 gitignore，base 没有它会多出一批图片/样式模块的类型错误
      const nextEnv = join(root, 'next-env.d.ts')
      if (existsSync(nextEnv) && !existsSync(join(dir, nextEnv))) {
        symlinkSync(join(process.cwd(), nextEnv), join(dir, nextEnv))
        links.push(nextEnv)
      }
    }
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
