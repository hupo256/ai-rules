#!/usr/bin/env node
// 常驻规则体量检查：AGENT.md 被 ~/.claude/CLAUDE.md 与 ~/.codex/AGENTS.md 软链，每个会话都整份加载。
// 上限沿用 docs_tdd check-doc-budget 的 L1_RESIDENT_BUDGET（docs_tdd 已冻结，2026-10-19 迁到这里）。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUDGET = 7000 // 码点
const WARN = 6300
const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'AGENT.md')
const size = [...readFileSync(file, 'utf8')].length

if (size > BUDGET) {
  console.error(`❌ AGENT.md = ${size} / ${BUDGET} 字符，超 ${size - BUDGET}：长清单移到 skills/ 或 rules/，L1 只留跨仓硬规则与路由`)
  process.exit(1)
}
console.log(`${size > WARN ? '⚠' : '✅'} AGENT.md = ${size} / ${BUDGET} 字符（余 ${BUDGET - size}）`)
