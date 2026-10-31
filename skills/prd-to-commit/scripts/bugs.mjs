#!/usr/bin/env node
// 拉取「EX项目bug统计表」里某个需求的全部提测 bug（项目ID 包含该编号），落盘供提测后补录缺陷分类与对照：
//   ~/.prd-cache/<ID>/bugs/{raw.json,bugs.json,bugs.md,img/}
// usage: bugs.mjs <PROJECT-ID> [--no-images]
// 依赖 lark-cli（已登录）。lark-cli 的 @file 与 --output 只认相对路径：脚本 cd 到输出目录再调用。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)
const id = args[0]
if (!id || id.startsWith('--')) {
  console.error('usage: bugs.mjs <PROJECT-ID> [--no-images]')
  process.exit(1)
}
// EX项目bug统计表（wiki Qaj7wDQQ5idt7VkPtr3lQnz6gsc → bitable）；表结构变了再改这里
const BASE_TOKEN = 'JLwLbtpzQa9qFDslu8RlsROCgoQ'
const TABLE_ID = 'tblixFWWJv0grMMH'
const FIELDS = ['bug编号', '涉及端口', '优先级', '严重程度', '归因分类', 'bug类型', '处理状态', '环境', '是否重复bug', '重开次数', '解决人员', '负责RD', '测试人员', '问题标题', '问题描述（复现步骤）', '备注', '创建时间']

const dir = join(homedir(), '.prd-cache', id, 'bugs')
mkdirSync(join(dir, 'img'), { recursive: true })
const lark = (cliArgs) => execFileSync('lark-cli', cliArgs, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })

// 项目ID 列是文本，按编号数字部分 contains 匹配（PR-02634 / PR02634 都能命中）
const number = id.replace(/^[A-Za-z]+-?/, '')
writeFileSync(join(dir, 'filter.json'), JSON.stringify({ conjunction: 'and', conditions: [{ field_name: '项目ID', operator: 'contains', value: number }] }))
const raw = JSON.parse(lark(['base', '+record-list', '--base-token', BASE_TOKEN, '--table-id', TABLE_ID, '--filter-json', '@./filter.json', '--limit', '200', '--format', 'json']))
if (!raw.ok) throw new Error(`lark-cli: ${JSON.stringify(raw.error)}`)
writeFileSync(join(dir, 'raw.json'), JSON.stringify(raw, null, 1))
const { fields: names, data: rows, has_more: hasMore } = raw.data
const index = Object.fromEntries(names.map((name, i) => [name, i]))
const cell = (row, name) => {
  const value = row[index[name]]
  if (value == null) return ''
  if (Array.isArray(value)) return value.map((item) => (item && typeof item === 'object' ? item.name ?? item.file_token ?? '' : String(item))).join(',')
  return String(value)
}
const attachments = (row, name) => (Array.isArray(row[index[name]]) ? row[index[name]].filter((item) => item && item.file_token) : [])

const bugs = rows.map((row) => {
  const bug = Object.fromEntries(FIELDS.filter((name) => name in index).map((name) => [name, cell(row, name)]))
  bug.images = []
  for (const name of ['问题截图', '测试结果截图', '返工测试结果截图']) {
    for (const file of attachments(row, name)) {
      const ext = (file.name ?? '').split('.').pop() || 'bin'
      const target = `img/${bug['bug编号']}-${file.file_token}.${ext}`
      if (!args.includes('--no-images') && !existsSync(join(dir, target))) {
        try {
          // 多维表格附件要带 bitablePerm 才能下载
          lark(['api', 'GET', `/open-apis/drive/v1/medias/${file.file_token}/download`, '--params', JSON.stringify({ extra: JSON.stringify({ bitablePerm: { tableId: TABLE_ID } }) }), '--output', target])
        } catch (error) {
          console.error(`附件下载失败 ${bug['bug编号']} ${file.file_token}: ${String(error.message).split('\n')[0]}`)
        }
      }
      bug.images.push({ field: name, path: target, name: file.name })
    }
  }
  return bug
})
writeFileSync(join(dir, 'bugs.json'), JSON.stringify(bugs, null, 1))

const valid = bugs.filter((bug) => bug['处理状态'] !== '不是问题' && bug['是否重复bug'] !== '是')
const md = [
  `# ${id} 提测 bug（${new Date().toISOString().slice(0, 10)} 拉取，共 ${bugs.length} 条，有效 ${valid.length} 条）`,
  '',
  '来源：EX项目bug统计表。有效 = 处理状态非「不是问题」且非重复。截图在 `img/`，原始数据 `raw.json`。',
  '',
  '| bug | 端 | 优先级 | 归因 | 类型 | 状态 | 解决人/RD | 标题 | 截图 |',
  '|---|---|---|---|---|---|---|---|---|',
  ...bugs.map((bug) => `| ${bug['bug编号']} | ${bug['涉及端口']} | ${bug['优先级']} | ${bug['归因分类']} | ${bug['bug类型']} | ${bug['处理状态']} | ${bug['解决人员'] || bug['负责RD']} | ${bug['问题标题'].replace(/\|/g, '\\|')} | ${bug.images.length} |`),
  '',
  '## 描述与备注',
  '',
  ...bugs.flatMap((bug) => [`### ${bug['bug编号']} ${bug['问题标题']}`, '', bug['问题描述（复现步骤）'] || '（无描述）', bug['备注'] ? `\n备注：${bug['备注']}` : '', ...bug.images.map((img) => `- ${img.field}：${img.path}`), '']),
  hasMore ? '\n> 超过 200 条，未全部拉取。' : '',
].join('\n')
writeFileSync(join(dir, 'bugs.md'), md)
console.log(`${id}: ${bugs.length} 条（有效 ${valid.length}），${bugs.reduce((sum, bug) => sum + bug.images.length, 0)} 张截图 → ${dir}/bugs.md`)
for (const bug of bugs) console.log(`  ${bug['bug编号']} | ${bug['涉及端口']} | ${bug['处理状态']} | ${bug['问题标题']}`)
