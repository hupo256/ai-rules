#!/usr/bin/env node
// 只给需求 ID，从 FameEX 需求池（多维表格）查 PRD 链接。
// 查找路径：前端任务看板（任务分解表）没有 PRD 链接 → 项目管理表也只有文字 → 「🚀 FemeEx_需求池」的「需求描述/文档」字段是 PRD 链接，
// 「反馈描述」里常带原始 BRD 链接（可能在另一个租户域名下）。
// 需求池没填链接时兜底：按需求 ID 搜飞书文档（docs +search），排除准出 checklist / 测试用例 / 脑图 / QA 日报周报，
// 优先作者 = 需求池「产品负责人」、标题含【ID】的 DOCX；兜底结果标 source=search，交付前要人工核对。
// usage: find-prd.mjs <PROJECT-ID> [--json]
// 输出：prd: <url>（找不到 exit 2）；有 BRD 时多一行 brd: <url>；另打印需求名称、状态、上线时间、是否免测等辅助信息。
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const id = args[0]
if (!id || id.startsWith('--')) {
  console.error('usage: find-prd.mjs <PROJECT-ID> [--json]')
  process.exit(1)
}
const BASE_TOKEN = 'XhvBbIeHBa2DPAsSFO6l9GjZgDe'
const POOL_TABLE = 'tblkduGVsB2BFXGt' // 🚀 FemeEx_需求池：需求ID / 需求描述/文档 / 反馈描述
const PROJECT_TABLE = 'tblCwGnfVQCMDsC8' // ✈ 项目管理表：项目ID / 项目状态 / 上线时间 / 备注（免测等）

// lark-cli 的 @file 只认相对路径：在临时目录里写过滤条件再调用
const work = mkdtempSync(join(tmpdir(), 'find-prd-'))
const number = id.replace(/^[A-Za-z]+-?/, '')
function query(table, field) {
  writeFileSync(join(work, 'f.json'), JSON.stringify({ conjunction: 'and', conditions: [{ field_name: field, operator: 'contains', value: number }] }))
  const out = execFileSync('lark-cli', ['base', '+record-list', '--base-token', BASE_TOKEN, '--table-id', table, '--filter-json', '@./f.json', '--limit', '20', '--format', 'json'], { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const res = JSON.parse(out)
  if (!res.ok) throw new Error(`lark-cli ${table}: ${JSON.stringify(res.error)}`)
  const { fields, data } = res.data
  // 「contains」会把 PR-0250 匹配到 PR-02506：再按完整 ID 精确过滤
  return data.map((row) => Object.fromEntries(fields.map((name, i) => [name, row[i]]))).filter((rec) => String(rec[field] ?? '').toUpperCase() === id.toUpperCase())
}
const text = (value) => (Array.isArray(value) ? value.map((v) => (v && typeof v === 'object' ? v.name ?? v.text ?? '' : v)).join(',') : value == null ? '' : String(value))
const links = (value) => [...text(value).matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)\]]+)/g)].map((m) => ({ title: m[1] ?? '', url: (m[2] ?? m[3]).replace(/[?&]from=from_copylink$/, '') }))

// 文档搜索兜底：只要标题含需求 ID 的 DOCX，去掉测试/QA 类文档，产品负责人写的优先
const NOT_PRD = /checklist|准出|测试|用例|脑图|日报|周报|技术方案|技术设计|复盘|对照/i
function searchPrd(owner) {
  const out = execFileSync('lark-cli', ['docs', '+search', '--query', id, '--page-size', '20', '--format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const res = JSON.parse(out)
  if (!res.ok) return []
  return (res.data?.results ?? [])
    .map((r) => ({ title: (r.title_highlighted ?? '').replace(/<\/?h>/g, '').trim(), url: r.result_meta?.url ?? '', owner: r.result_meta?.owner_name ?? '', type: r.result_meta?.doc_types ?? '', updated: (r.result_meta?.update_time_iso ?? '').slice(0, 10) }))
    .filter((d) => d.type === 'DOCX' && d.title.toUpperCase().includes(id.toUpperCase()) && !NOT_PRD.test(d.title) && !d.url.includes('#'))
    .sort((a, b) => (b.owner === owner) - (a.owner === owner) || (b.title.includes(`【${id}】`)) - (a.title.includes(`【${id}】`)))
}

let pool, project
try {
  pool = query(POOL_TABLE, '需求ID')[0]
  project = query(PROJECT_TABLE, '项目ID')[0]
} finally {
  rmSync(work, { recursive: true, force: true })
}
if (!pool) {
  console.error(`需求池里没有 ${id}`)
  process.exit(2)
}
const isLark = (url) => /larksuite\.com\/(wiki|docx|docs)\//.test(url)
let prd = links(pool['需求描述/文档']).find((l) => isLark(l.url))
let source = prd ? 'pool' : null
let candidates = []
if (!prd) {
  candidates = searchPrd(text(pool['产品负责人*']))
  if (candidates.length) {
    prd = { title: candidates[0].title, url: candidates[0].url }
    source = 'search'
  }
}
const brd = links(pool['反馈描述']).find((l) => isLark(l.url) && l.url !== prd?.url)
const info = {
  id,
  prd: prd?.url ?? null,
  prdTitle: prd?.title ?? null,
  source,
  candidates: candidates.slice(0, 5),
  brd: brd?.url ?? null,
  brdTitle: brd?.title ?? null,
  name: text(pool['需求名称*'] ?? pool['需求标准名称']),
  status: text(pool['需求状态*']),
  sides: text(pool['涉及研发端*']),
  launch: project ? text(project['上线时间']).slice(0, 10) : null,
  note: project ? text(project['备注']) : null,
}
if (args.includes('--json')) {
  console.log(JSON.stringify(info, null, 2))
} else {
  console.log(`${id} ${info.name}（${info.status}；涉及 ${info.sides}${info.launch ? `；上线 ${info.launch}` : ''}）`)
  if (info.note) console.log(`备注: ${info.note}`)
  console.log(`prd: ${info.prd ?? '（需求池没填链接，文档搜索也没找到）'}${info.prdTitle ? `  ${info.prdTitle}` : ''}${source === 'search' ? '  ← 需求池没填，按文档搜索兜底，请核对' : ''}`)
  if (source === 'search' && candidates.length > 1) for (const c of candidates.slice(1, 5)) console.log(`  其他候选: ${c.url}  ${c.title}（${c.owner}，${c.updated}）`)
  if (info.brd) console.log(`brd: ${info.brd}  ${info.brdTitle}`)
}
process.exit(info.prd ? 0 : 2)
