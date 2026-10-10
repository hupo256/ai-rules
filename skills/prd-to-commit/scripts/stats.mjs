#!/usr/bin/env node
// 统计一个需求在 Claude / Codex 里的真实消耗：会话数、模型调用、token、墙钟。结果打印并追加到 ~/.prd-cache/<ID>/run-log.md。
// 归属规则：会话前 5 条用户文本消息之一或 cwd 含项目号（Claude 子 agent 文件并入父会话）。
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

// Claude：按 message.id 去重累计 usage
function claudeUsage(files) {
  const seen = new Set()
  let tokens = 0
  const times = []
  for (const file of files) {
    for (const event of lines(file)) {
      if (event.timestamp) times.push(event.timestamp)
      const { id: messageId, usage } = event.message ?? {}
      if (!usage || !messageId || seen.has(messageId)) continue
      seen.add(messageId)
      tokens += (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.output_tokens ?? 0)
    }
  }
  times.sort()
  return { calls: seen.size, tokens, start: times[0], end: times.at(-1) }
}

const rows = []
for (const file of walk(join(homedir(), '.claude', 'projects'), (path) => path.endsWith('.jsonl') && !path.includes('/subagents/'))) {
  const events = lines(file)
  const userTexts = events.filter((event) => event.type === 'user' && !event.isMeta)
    .map((event) => event.message?.content)
    .filter((content) => typeof content === 'string' || content?.some?.((part) => part.type === 'text'))
    .slice(0, 5).map(textOf)
  const cwd = events.find((event) => event.cwd)?.cwd ?? ''
  if (!userTexts.some((text) => text.includes(id)) && !cwd.includes(id)) continue
  const subDir = file.replace(/\.jsonl$/, '/subagents')
  const subFiles = existsSync(subDir) ? readdirSync(subDir).filter((name) => name.endsWith('.jsonl')).map((name) => join(subDir, name)) : []
  const main = claudeUsage([file])
  const all = claudeUsage([file, ...subFiles])
  rows.push({ tool: 'claude', session: file.split('/').pop().slice(0, 8), subagents: subFiles.length, mainTokens: main.tokens, ...all })
}

// Codex：取每个会话最后一次 token_count 的累计值；子代理会话（session_meta.source.subagent）并入父会话
const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 路径提及要求项目号后不再跟字母数字或连字符，避免 REPLAY-01930 误配 REPLAY-01930-v4
const pathMention = new RegExp(`(?:\\.prd-cache|/github)/${escaped}(?![\\w-])`)
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
    matched: users.slice(0, 5).some((text) => text.includes(id)) || (meta.cwd ?? '').includes(id) || pathMention.test(raw),
    calls: events.filter((event) => event.payload?.type === 'token_count').length,
    tokens: usage?.total_tokens ?? 0, start: times[0], end: times.at(-1),
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
  })
}

const minutes = (row) => (row.start && row.end ? Math.round((Date.parse(row.end) - Date.parse(row.start)) / 60000) : 0)
const m = (n) => `${(n / 1e6).toFixed(1)}M`
const table = [
  `| 工具 | 会话 | 子 agent | 模型调用 | token（含子 agent） | 主会话 token | 墙钟 | 起止 |`,
  '|-|-|-|-|-|-|-|-|',
  ...rows.map((row) => `| ${row.tool} | ${row.session} | ${row.subagents} | ${row.calls} | ${m(row.tokens)} | ${m(row.mainTokens)} | ${minutes(row)} 分钟 | ${row.start?.slice(5, 16)} → ${row.end?.slice(5, 16)} |`),
]
const total = rows.reduce((sum, row) => sum + row.tokens, 0)
const report = `\n## stats（${new Date().toISOString().slice(0, 16)}，最近 ${days} 天）\n\n${table.join('\n')}\n\n合计：${rows.length} 个会话，${m(total)} token\n`
console.log(report)
if (!args.includes('--no-append')) {
  mkdirSync(join(homedir(), '.prd-cache', id), { recursive: true })
  appendFileSync(join(homedir(), '.prd-cache', id, 'run-log.md'), report)
}
