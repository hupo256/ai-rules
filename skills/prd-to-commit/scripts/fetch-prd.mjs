#!/usr/bin/env node
// 拉取 Lark PRD 一次并落盘：prd.md（阅读用，内嵌表格原位展开）、prd.xml（带 block id，回查用）、media/（全部图片/画板）、sheets/（内嵌表格 CSV）。
// usage: fetch-prd.mjs <PROJECT-ID> <lark-url> [--revision <N>]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const [id, url, ...rest] = process.argv.slice(2)
if (!id || !url) {
  console.error('usage: fetch-prd.mjs <PROJECT-ID> <lark-url> [--revision <N>]')
  process.exit(1)
}
const revIndex = rest.indexOf('--revision')
const revision = revIndex >= 0 ? rest[revIndex + 1] : '-1'
const env = { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' }

function lark(args, cwd) {
  for (let attempt = 1; ; attempt++) {
    try {
      return execFileSync('lark-cli', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 60000 })
    } catch (error) {
      if (attempt >= 3 || /403|permission|unauthori/i.test(String(error.stderr ?? error.message))) throw error
    }
  }
}

function fetchDoc(format, detail) {
  let out
  try {
    out = lark(['docs', '+fetch', '--doc', url, '--as', 'user', '--detail', detail,
      '--doc-format', format, '--revision-id', revision, '--format', 'json'])
  } catch (error) {
    const message = String(error.stderr || error.message).match(/"message":\s*"([^"]+)"/)?.[1] ?? String(error.message).slice(0, 300)
    // 历史 revision 需要文档编辑权限；只读用户只能拉最新版
    console.error(`Lark 读取失败：${message}${revision !== '-1' ? '\n提示：读取历史 revision 需要编辑权限，可去掉 --revision 拉最新版。' : ''}`)
    process.exit(1)
  }
  const doc = JSON.parse(out).data?.document
  if (!doc?.content) throw new Error(`Lark 返回缺少正文（${format}）`)
  return doc
}

const xmlDoc = fetchDoc('xml', 'with-ids')
const rev = String(xmlDoc.revision_id)
const dir = join(homedir(), '.prd-cache', id, `r${rev}`)
if (existsSync(join(dir, 'prd.md'))) {
  console.log(`cached: ${dir}`)
  process.exit(0)
}
mkdirSync(join(dir, 'media'), { recursive: true })
writeFileSync(join(dir, 'prd.xml'), xmlDoc.content)
writeFileSync(join(dir, 'prd.md'), fetchDoc('markdown', 'simple').content)

const media = []
const failed = []
const tag = /<(img|image|whiteboard)\b[^>]*?\b(?:token|src)="([\w-]{2,})"[^>]*>/g
let index = 0
for (const [, kind, token] of xmlDoc.content.matchAll(tag)) {
  const prefix = `asset-${String(++index).padStart(2, '0')}`
  try {
    // lark-cli 只接受相对 --output 路径
    lark(['docs', '+media-download', '--as', 'user', '--token', token,
      '--type', kind === 'whiteboard' ? 'whiteboard' : 'media', '--output', `media/${prefix}`, '--format', 'json'], dir)
    const file = readdirSync(join(dir, 'media')).find((name) => name.startsWith(prefix))
    media.push({ token, kind, file: file ? `media/${file}` : null })
  } catch (error) {
    failed.push({ token, kind, error: String(error.stderr ?? error.message).slice(0, 200) })
  }
}

// 内嵌电子表格：导出 CSV 到 sheets/，并在 prd.md 原位展开，避免字段/文案整段漏读
const sheets = []
mkdirSync(join(dir, 'sheets'), { recursive: true })
let markdown = readFileSync(join(dir, 'prd.md'), 'utf8')
const sheetTag = /<sheet\b[^>]*?\bsheet-id="([\w-]+)"[^>]*?\btoken="([\w-]+)"[^>]*>(?:<\/sheet>)?/g
const seenSheets = new Set()
for (const [, sheetId, token] of xmlDoc.content.matchAll(sheetTag)) {
  if (seenSheets.has(sheetId)) continue
  seenSheets.add(sheetId)
  try {
    const data = JSON.parse(lark(['sheets', '+csv-get', '--as', 'user', '--spreadsheet-token', token, '--sheet-id', sheetId,
      '--range', 'A1:AZ1000', '--include-row-prefix=false', '--format', 'json'])).data
    const file = `sheets/${sheetId}.csv`
    writeFileSync(join(dir, file), `${data.annotated_csv}\n`)
    sheets.push({ sheetId, token, file, rows: data.row_count, truncated: Boolean(data.has_more) })
    if (data.has_more) failed.push({ token, kind: 'sheet', error: `${sheetId} 超过 A1:AZ1000，已截断` })
    const block = `\n\n**内嵌表格 ${sheetId}**（${file}）\n\n\`\`\`csv\n${data.annotated_csv}\n\`\`\`\n\n`
    markdown = markdown.replace(new RegExp(`<sheet\\b[^>]*?sheet-id="${sheetId}"[^>]*>(?:</sheet>)?`, 'g'), block)
  } catch (error) {
    failed.push({ token, kind: 'sheet', sheetId, error: String(error.stderr ?? error.message).slice(0, 200) })
  }
}
writeFileSync(join(dir, 'prd.md'), markdown)

// 其他嵌入（多维表格、iframe、同步块等）不自动展开，只登记出来提醒人工处理
const unexpanded = [...new Set([...xmlDoc.content.matchAll(/<(bitable|iframe|synced_reference|embed)\b/g)].map((m) => m[1]))]

writeFileSync(join(dir, 'meta.json'), `${JSON.stringify({
  id, url, documentId: xmlDoc.document_id, revision: rev, fetchedAt: new Date().toISOString(), media, sheets, unexpanded, failed,
}, null, 2)}\n`)
console.log(`saved: ${dir}\nrevision: ${rev}\nmedia: ${media.length} ok, sheets: ${sheets.length} ok, ${failed.length} failed`)
if (unexpanded.length) console.log(`WARNING: 未展开的嵌入类型 ${unexpanded.join(', ')}，需人工查看`)
if (failed.length) process.exitCode = 2
