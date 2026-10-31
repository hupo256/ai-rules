#!/usr/bin/env node
// 一条命令把一个真实需求准备到「可以派 agent」：preflight → fetch-prd → worktree → 生成 agent 提示（run-prompt.tpl）。
// usage: launch.mjs <PROJECT-ID> <lark-url> [--offset 100] [--mode direct|confirm] [--branch <name>] [--max-dev 1] [--force] [--refetch]
//   --mode direct：用户已说「直接做、绕开登录」（跳过 §3，浏览器 auth=false + mocks，strictWrites）；confirm：按 SKILL §3 停下等用户
//   --force：preflight 返回 10/20 也继续（10 需要同时给 --branch）
// 输出：提示文件 ~/.prd-cache/_runs/<ID>.prompt；之后由编排方用 Agent（Opus）执行该提示，或自己在主会话按提示跑。
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const [id, url] = args
if (!id || !url || id.startsWith('--')) {
  console.error('usage: launch.mjs <PROJECT-ID> <lark-url> [--offset 100] [--mode direct|confirm] [--branch <name>] [--max-dev 1] [--force] [--refetch]')
  process.exit(1)
}
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const offset = option('--offset', '100')
const mode = option('--mode', 'confirm')
const maxDev = option('--max-dev', '1')
const branchArg = option('--branch', undefined)
const scripts = dirname(fileURLToPath(import.meta.url))
const runsDir = join(homedir(), '.prd-cache', '_runs')
mkdirSync(runsDir, { recursive: true })
const node = (script, scriptArgs) => spawnSync(process.execPath, [join(scripts, script), ...scriptArgs], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

// 1. 预检：10（远端在途分支）要用户裁定分支/契约；20（已合入 base）进复核补缺模式——两种都先停，--force 才继续
const preflight = node('preflight.mjs', [id])
process.stdout.write(preflight.stdout)
const verdictLine = preflight.stdout.split('\n').find((line) => line.startsWith('结论')) ?? ''
if (preflight.status !== 0 && !args.includes('--force')) {
  console.error(`\npreflight 退出码 ${preflight.status}：先按上面的结论处理（10 → 问用户后加 --branch feature/${id}-p2c --force；20 → 确认进复核补缺模式后加 --force）`)
  process.exit(preflight.status)
}
if (preflight.status === 10 && !branchArg) {
  console.error('远端有在途分支：--force 必须同时给 --branch（如 feature/<ID>-p2c）')
  process.exit(10)
}

// 2. 拉 PRD（已缓存则复用；--refetch 重拉）
const fetched = node('fetch-prd.mjs', [id, url, ...(args.includes('--refetch') ? ['--refetch'] : [])])
process.stdout.write(fetched.stdout)
if (fetched.status !== 0) process.exit(fetched.status)
const cacheDir = join(homedir(), '.prd-cache', id)
const revDirs = readdirSync(cacheDir).filter((name) => /^r\d+$/.test(name)).sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))
if (!revDirs.length) throw new Error(`${cacheDir} 下没有 r<rev> 目录`)
const prdDir = join(cacheDir, revDirs[0])
const inputsDir = join(cacheDir, 'inputs')
const inputs = existsSync(inputsDir) && readdirSync(inputsDir).length ? `额外输入在 ${inputsDir}/（清单、编码、冷读都要引用）。` : ''

// 3. worktree
const worktree = node('worktree.mjs', [id, ...(branchArg ? ['--branch', branchArg] : [])])
process.stdout.write(worktree.stdout)
if (worktree.status !== 0) process.exit(worktree.status)
const worktreePath = join(homedir(), 'github', id)
const base = execFileSync('git', ['merge-base', 'HEAD', 'origin/online'], { cwd: worktreePath, encoding: 'utf8' }).trim().slice(0, 10)
const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: worktreePath, encoding: 'utf8' }).trim()

// 4. 提示
const modeLines = mode === 'direct'
  ? [
      '- 模式：用户要求「直接做，不要停，只要结果」——§3 用户确认跳过（plan 照写），待确认项按最合理的判断实现并在交付说明列出；最后只本地 commit，不 push。',
      '- 浏览器：用户要求绕开登录。所有 spec 用 `export const auth = false` + mocks（web/web-next/后台的免登录配方见 browser.md §2 与 auth-fallback.mjs），所有 spec `export const strictWrites = true`（写接口一律 mock，不动 dev 数据）。不要请求用户 login。',
    ]
  : [
      '- 模式：按 SKILL §3 把清单、待确认与计划交给用户确认后再继续（用 SubagentHandback/最终回复交回，等用户答复后由编排方续跑）；最后只本地 commit，不 push。',
      '- 浏览器：先 `browser.mjs check`，登录态失效按 browser.md 处理（请用户 login，期间先做不依赖登录的验证）。',
    ]
const template = readFileSync(join(scripts, 'run-prompt.tpl'), 'utf8')
const prompt = template
  .replaceAll('{{ID}}', id)
  .replaceAll('{{PRD}}', prdDir)
  .replaceAll('{{INPUTS}}', inputs)
  .replaceAll('{{BRANCH}}', branch)
  .replaceAll('{{BASE}}', base)
  .replaceAll('{{OFFSET}}', offset)
  .replaceAll('{{MAX_DEV}}', maxDev)
  .replaceAll('{{PREFLIGHT}}', verdictLine.replace(/^结论:\s*/, '') || '干净')
  .replaceAll('{{MODE_LINES}}', modeLines.join('\n'))
const promptFile = join(runsDir, `${id}.prompt`)
writeFileSync(promptFile, prompt)
console.log(`\nprompt: ${promptFile}\n下一步：Agent(general-purpose, opus) 的 prompt 填「先用 Read 完整读取 ${promptFile}，并严格按其中要求执行」；交付说明会写到 ${join(runsDir, `${id}.out`)}`)
