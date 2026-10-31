#!/usr/bin/env node
// 统计一个需求在 Claude / Codex 里的真实消耗：会话数、模型调用、token、墙钟。结果打印并追加到 ~/.prd-cache/<ID>/run-log.md。
// 归属规则（Claude）：主会话按「工具调用输入里出现 ~/.prd-cache/<ID> 或 ~/github/<ID>」定位工作区间——相邻调用间隔 >60 分钟视为不同段，
// 取调用最多的一段（首尾各留 10 分钟）；聊天文本里的提及不算（总结、候选清单会反复点名所有需求）。
// 子 agent 文件按「首条任务提示或工具调用输入」提及该需求并入（注入的 git 状态等系统上下文会点名无关需求，不能用全文匹配）；
// 其首尾时间并入工作区间。这样同一会话连跑多个需求、agent 模式 cwd 不在 worktree 都能拆开。
// usage: stats.mjs <PROJECT-ID> [--days 3] [--no-append]
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const id = args[0]
if (!id || id.startsWith('--')) {
  console.error('usage: stats.mjs <PROJECT-ID> [--days 3] [--no-append]')
  process.exit(1)
}
const days = Number(args.includes('--days') ? args[args.indexOf('--days') + 1] : 3)
const since = Date.now() - days * 86400000

function walk(dir, pick) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path, pick)
    return pick(path) && statSync(path).mtimeMs >= since ? [path] : []
  })
}

function lines(file) {
  return readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    try {
      return line ? [JSON.parse(line)] : []
    } catch {
      return []
    }
  })
}

const textOf = (content) => (typeof content === 'string' ? content : (content ?? []).map((part) => part.text ?? '').join(' '))

// Claude：按 message.id 去重累计 usage；window = [start, end] 时只统计区间内的事件
function claudeUsage(files, window) {
  const seen = new Set()
  let tokens = 0
  const times = []
  for (const file of files) {
    for (const event of lines(file)) {
      if (window && event.timestamp && (event.timestamp < window[0] || event.timestamp > window[1])) continue
      if (event.timestamp) times.push(event.timestamp)
      const { id: messageId, usage } = event.message ?? {}
      if (!usage || !messageId || seen.has(messageId)) continue
      seen.add(messageId)
      tokens += (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.output_tokens ?? 0)
    }
  }
  times.sort()
  return { calls: seen.size, tokens, start: times[0], end: times.at(-1), times }
}

const rows = []
const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 项目号前后不能紧跟字母数字或连字符：PR-0193 不能匹配到 PR-01930 的会话
const idMention = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`)
// 路径提及要求项目号后不再跟字母数字或连字符，避免 REPLAY-01930 误配 REPLAY-01930-v4
const pathMention = new RegExp(`(?:\\.prd-cache|/github)/${escaped}(?![\\w-])`)
const mentionsText = (text) => idMention.test(text) || pathMention.test(text)
// 子 agent 是否属于该需求：首条非 meta 用户消息（任务提示）或任一工具调用输入提及
const subBelongs = (events) => {
  const prompt = events.find((event) => event.type === 'user' && !event.isMeta)
  return (prompt && mentionsText(textOf(prompt.message?.content))) || events.some(toolTouches)
}
// 工具调用输入（Bash 命令、Read/Edit 路径、子 agent 提示）里提及需求路径或项目号的事件
const toolTouches = (event) => (Array.isArray(event.message?.content) ? event.message.content : [])
  .some((part) => part.type === 'tool_use' && (pathMention.test(JSON.stringify(part.input ?? '')) || idMention.test(JSON.stringify(part.input ?? ''))))
const PAD = 10 * 60000
const GAP = 60 * 60000
const shift = (iso, ms) => new Date(new Date(iso).getTime() + ms).toISOString()
function workWindow(timestamps) {
  if (!timestamps.length) return undefined
  const clusters = [[timestamps[0]]]
  for (const time of timestamps.slice(1)) {
    const current = clusters.at(-1)
    if (new Date(time) - new Date(current.at(-1)) > GAP) clusters.push([time])
    else current.push(time)
  }
  const best = clusters.sort((a, b) => b.length - a.length)[0]
  return [shift(best[0], -PAD), shift(best.at(-1), PAD)]
}
for (const file of walk(join(homedir(), '.claude', 'projects'), (path) => path.endsWith('.jsonl') && !path.includes('/subagents/'))) {
  const events = lines(file)
  const cwd = events.find((event) => event.cwd)?.cwd ?? ''
  const subDir = file.replace(/\.jsonl$/, '/subagents')
  const subFiles = (existsSync(subDir) ? readdirSync(subDir).filter((name) => name.endsWith('.jsonl')).map((name) => join(subDir, name)) : [])
    .filter((sub) => subBelongs(lines(sub)))
  // agent 模式下需求由子 agent 整体执行：工作区间 = 主会话工具调用最密的一段 ∪ 所属子 agent 的首尾时间
  const subSpans = subFiles.map((sub) => {
    const times = lines(sub).map((event) => event.timestamp).filter(Boolean).sort()
    return [times[0], times.at(-1)]
  }).filter(([start]) => start)
  const touches = events.filter((event) => event.timestamp && toolTouches(event)).map((event) => event.timestamp).sort()
  if (!touches.length && !subSpans.length && !idMention.test(cwd)) continue
  const mainWindow = workWindow(touches)
  const starts = [...subSpans.map(([start]) => start), ...(mainWindow ? [mainWindow[0]] : [])].sort()
  const ends = [...subSpans.map(([, end]) => end), ...(mainWindow ? [mainWindow[1]] : [])].sort()
  const window = starts.length ? [starts[0], ends.at(-1)] : undefined
  const main = claudeUsage([file], window)
  const all = claudeUsage([file, ...subFiles], window)
  rows.push({ tool: 'claude', session: file.split('/').pop().slice(0, 8), subagents: subFiles.length, mainTokens: main.tokens, ...all })
}

// Codex：取每个会话最后一次 token_count 的累计值；子代理会话（session_meta.source.subagent）并入父会话
const codex = walk(join(homedir(), '.codex', 'sessions'), (path) => path.endsWith('.jsonl')).map((file) => {
  const raw = readFileSync(file, 'utf8')
  const events = lines(file)
  const meta = events.find((event) => event.type === 'session_meta')?.payload ?? {}
  const users = events.filter((event) => event.payload?.type === 'message' && event.payload?.role === 'user')
    .map((event) => textOf(event.payload.content)).filter((text) => !text.startsWith('# AGENTS.md') && !text.startsWith('<environment_context'))
  const usage = events.filter((event) => event.payload?.type === 'token_count' && event.payload.info).at(-1)?.payload.info.total_token_usage
  const times = events.map((event) => event.timestamp).filter(Boolean).sort()
  return {
    file, threadId: meta.id, parent: meta.source?.subagent?.thread_spawn?.parent_thread_id ?? null,
    matched: users.slice(0, 5).some((text) => idMention.test(text)) || idMention.test(meta.cwd ?? '') || pathMention.test(raw),
    calls: events.filter((event) => event.payload?.type === 'token_count').length,
    tokens: usage?.total_tokens ?? 0, start: times[0], end: times.at(-1), times,
  }
})
const byThread = new Map(codex.map((session) => [session.threadId, session]))
const rootOf = (session) => {
  let current = session
  while (current.parent && byThread.has(current.parent)) current = byThread.get(current.parent)
  return current
}
const groups = new Map()
for (const session of codex) {
  const root = rootOf(session)
  if (!root.matched && !session.matched) continue
  const key = (root.matched ? root : session).threadId
  groups.set(key, [...(groups.get(key) ?? []), session])
}
for (const [key, sessions] of groups) {
  const root = byThread.get(key)
  const times = sessions.flatMap((session) => [session.start, session.end]).filter(Boolean).sort()
  rows.push({
    tool: 'codex', session: root.threadId.slice(0, 8), subagents: sessions.length - 1,
    mainTokens: root.tokens, calls: sessions.reduce((sum, session) => sum + session.calls, 0),
    tokens: sessions.reduce((sum, session) => sum + session.tokens, 0), start: times[0], end: times.at(-1),
    times: sessions.flatMap((session) => session.times).sort(),
  })
}

const minutes = (row) => (row.start && row.end ? Math.round((Date.parse(row.end) - Date.parse(row.start)) / 60000) : 0)
// 活跃时长：相邻事件间隔超过 10 分钟的部分（等用户确认、额度暂停、过夜）不计，墙钟会把这些都算进去
const activeMinutes = (row) => {
  const ts = (row.times ?? []).map((t) => Date.parse(t)).filter(Number.isFinite)
  let ms = 0
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] <= 600000) ms += ts[i] - ts[i - 1]
  return Math.round(ms / 60000)
}
const m = (n) => `${(n / 1e6).toFixed(1)}M`
const table = [
  `| 工具 | 会话 | 子 agent | 模型调用 | token（含子 agent） | 主会话 token | 活跃 | 墙钟 | 起止 |`,
  '|-|-|-|-|-|-|-|-|-|',
  ...rows.map((row) => `| ${row.tool} | ${row.session} | ${row.subagents} | ${row.calls} | ${m(row.tokens)} | ${m(row.mainTokens)} | ${activeMinutes(row)} 分钟 | ${minutes(row)} 分钟 | ${row.start?.slice(5, 16)} → ${row.end?.slice(5, 16)} |`),
]
const total = rows.reduce((sum, row) => sum + row.tokens, 0)
const report = `\n## stats（${new Date().toISOString().slice(0, 16)}，最近 ${days} 天）\n\n${table.join('\n')}\n\n合计：${rows.length} 个会话，${m(total)} token，活跃 ${rows.reduce((sum, row) => sum + activeMinutes(row), 0)} 分钟（相邻事件间隔 >10 分钟的部分不计）\n`
console.log(report)
if (!args.includes('--no-append')) {
  mkdirSync(join(homedir(), '.prd-cache', id), { recursive: true })
  appendFileSync(join(homedir(), '.prd-cache', id, 'run-log.md'), report)
}
