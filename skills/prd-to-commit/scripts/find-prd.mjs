#!/usr/bin/env node
// 只给需求 ID，从 FameEX 需求池（多维表格）查 PRD 链接。
// 查找路径：前端任务看板（任务分解表）没有 PRD 链接 → 项目管理表也只有文字 → 「🚀 FemeEx_需求池」的「需求描述/文档」字段是 PRD 链接，
// 「反馈描述」里常带原始 BRD 链接（可能在另一个租户域名下）。
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
const prd = links(pool['需求描述/文档']).find((l) => isLark(l.url))
const brd = links(pool['反馈描述']).find((l) => isLark(l.url) && l.url !== prd?.url)
const info = {
  id,
  prd: prd?.url ?? null,
  prdTitle: prd?.title ?? null,
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
  console.log(`prd: ${info.prd ?? '（需求池「需求描述/文档」里没有 Lark 链接）'}${info.prdTitle ? `  ${info.prdTitle}` : ''}`)
  if (info.brd) console.log(`brd: ${info.brd}  ${info.brdTitle}`)
}
process.exit(info.prd ? 0 : 2)
