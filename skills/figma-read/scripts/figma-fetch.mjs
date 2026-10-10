#!/usr/bin/env node
// Reusable Figma reader (REST API). No MCP / no browser needed.
//
// Auth: export FIGMA_TOKEN=<Personal Access Token>
//   Create at Figma → Settings → Security → Personal access tokens (scope: File content read).
//
// Usage:
//   node figma-fetch.mjs <fileKeyOrUrl> <nodeId[,nodeId...]> [--image] [--raw] [--depth=N]
//
// Examples:
//   node figma-fetch.mjs KzvWxAYxqfgpoiYuKdxMAE 19782-4898
//   node figma-fetch.mjs "https://www.figma.com/design/KzvWxAYxqfgpoiYuKdxMAE/x?node-id=19782-4898" 19782:4898 --image
//
// Output: a compact geometry tree (id, type, name, size, cornerRadius, stroke, fill hex,
//   auto-layout padding/gap, text characters). --image also prints a rendered PNG URL.
//   --raw dumps the full node JSON. --depth limits tree depth (default 6).

const TOKEN = process.env.FIGMA_TOKEN
if (!TOKEN) {
  console.error('ERROR: set FIGMA_TOKEN (Figma personal access token) in env.')
  process.exit(2)
}

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const positionals = args.filter((a) => !a.startsWith('--'))
const depthFlag = [...flags].find((f) => f.startsWith('--depth='))
const MAX_DEPTH = depthFlag ? Number(depthFlag.split('=')[1]) : 6

const [fileArg, nodeArg] = positionals
if (!fileArg || !nodeArg) {
  console.error('Usage: node figma-fetch.mjs <fileKeyOrUrl> <nodeId[,nodeId...]> [--image] [--raw] [--depth=N]')
  process.exit(2)
}

// Accept a raw file key or a full Figma URL.
function parseFileKey(s) {
  const m = s.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)
  return m ? m[1] : s
}
// Figma node ids use ':' in the API but '-' in URLs.
const fileKey = parseFileKey(fileArg)
const ids = nodeArg.split(',').map((x) => x.trim().replace(/-/g, ':'))

async function api(path) {
  const res = await fetch(`https://api.figma.com/v1${path}`, { headers: { 'X-Figma-Token': TOKEN } })
  if (!res.ok) {
    console.error(`Figma API ${res.status} ${res.statusText} for ${path}`)
    console.error(await res.text())
    process.exit(1)
  }
  return res.json()
}

function toHex(c) {
  if (!c) return null
  const n = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  const hex = `#${n(c.r)}${n(c.g)}${n(c.b)}`
  return c.a != null && c.a < 1 ? `${hex} (a=${c.a.toFixed(2)})` : hex
}

function fillSummary(fills) {
  if (!Array.isArray(fills) || !fills.length) return null
  return fills
    .filter((f) => f.visible !== false)
    .map((f) => {
      if (f.type === 'SOLID') return toHex(f.color)
      if (f.type?.startsWith('GRADIENT')) return f.type
      if (f.type === 'IMAGE') return 'IMAGE'
      return f.type
    })
    .join(', ')
}

function strokeSummary(node) {
  const s = fillSummary(node.strokes)
  if (!s) return null
  return `${s} @${node.strokeWeight ?? '?'}px`
}

function radiusSummary(node) {
  if (node.rectangleCornerRadii) return `[${node.rectangleCornerRadii.join(',')}]`
  if (node.cornerRadius != null) return String(node.cornerRadius)
  return null
}

function box(node) {
  const b = node.absoluteBoundingBox
  return b ? `${Math.round(b.width)}x${Math.round(b.height)}` : null
}

function autoLayout(node) {
  if (!node.layoutMode || node.layoutMode === 'NONE') return null
  const pad = `p[${node.paddingTop ?? 0},${node.paddingRight ?? 0},${node.paddingBottom ?? 0},${node.paddingLeft ?? 0}]`
  return `${node.layoutMode} gap=${node.itemSpacing ?? 0} ${pad} align=${node.primaryAxisAlignItems ?? '-'}/${node.counterAxisAlignItems ?? '-'}`
}

function line(node, depth) {
  const parts = [
    `${'  '.repeat(depth)}${node.type}`,
    `"${node.name}"`,
    `#${node.id}`,
    box(node) && `size=${box(node)}`,
    radiusSummary(node) && `r=${radiusSummary(node)}`,
    strokeSummary(node) && `stroke=${strokeSummary(node)}`,
    fillSummary(node.fills) && `fill=${fillSummary(node.fills)}`,
    autoLayout(node),
    node.characters != null && `text=${JSON.stringify(node.characters)}`,
    node.style?.fontSize && `font=${node.style.fontSize}/${node.style.fontWeight ?? ''}`,
  ].filter(Boolean)
  return parts.join('  ')
}

function walk(node, depth) {
  if (depth > MAX_DEPTH) return
  console.log(line(node, depth))
  for (const child of node.children ?? []) walk(child, depth + 1)
}

const data = await api(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids.join(','))}`)

if (flags.has('--raw')) {
  console.log(JSON.stringify(data, null, 2))
} else {
  for (const id of ids) {
    const doc = data.nodes[id]?.document
    if (!doc) {
      console.log(`(node ${id} not found / no access)`)
      continue
    }
    console.log(`\n=== node ${id} ===`)
    walk(doc, 0)
  }
}

if (flags.has('--image')) {
  const img = await api(`/images/${fileKey}?ids=${encodeURIComponent(ids.join(','))}&scale=2&format=png`)
  console.log('\n=== rendered images ===')
  for (const [id, url] of Object.entries(img.images ?? {})) console.log(`${id}: ${url}`)
}
