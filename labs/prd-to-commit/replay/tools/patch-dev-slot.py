# -*- coding: utf-8 -*-
# dev.mjs：全机 dev server 限流。2026-10-18 三次卡死强制重启：16G 内存同时冷启动多个 Next dev（单个 2–3G、编译写盘 2GB/4 分钟）。
import os, sys
p = os.path.expanduser('~/.ai-rules/skills/prd-to-commit/scripts/dev.mjs')
s = open(p, encoding='utf-8').read()
a = "// start：同一站点同一时间只跑一个 dev server（端口固定），占用者若是别的 worktree 就先停掉\n"
b = """// 全机限流：整台机器同时最多 P2C_MAX_DEV 个（默认 2）由 dev.mjs 启动且仍在监听的 dev server，超出就排队等待。
// 依据：16G 内存的 mac 上 3 个以上 Next dev 同时冷启动会耗尽内存卡死（2026-10-18 三次强制重启）。
const maxDev = Number(process.env.P2C_MAX_DEV || 2)
const liveDevServers = () => readdirSync(stateDir).filter((f) => f.endsWith('.json')).map((f) => {
  try {
    const st = JSON.parse(readFileSync(join(stateDir, f), 'utf8'))
    const port = Number(new URL(st.url).port)
    const alive = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN || true`, { encoding: 'utf8' }).trim().length > 0
    return alive ? { ...st, file: f } : null
  } catch {
    return null
  }
}).filter((st) => st && st.url !== url)
if (cmd === 'start') {
  const deadline = Date.now() + Number(process.env.P2C_DEV_WAIT_MIN || 40) * 60000
  let live = liveDevServers()
  while (live.length >= maxDev) {
    if (Date.now() > deadline) {
      console.log(`busy-slots: 全机已有 ${live.length} 个 dev server（上限 ${maxDev}），等待超时未启动：${live.map((l) => l.url).join(', ')}`)
      process.exit(5)
    }
    console.log(`waiting-slot: 全机已有 ${live.length}/${maxDev} 个 dev server（${live.map((l) => l.url).join(', ')}），30 秒后重试…`)
    await new Promise((r) => setTimeout(r, 30000))
    live = liveDevServers()
  }
}

// start：同一站点同一时间只跑一个 dev server（端口固定），占用者若是别的 worktree 就先停掉
"""
if a not in s:
    sys.exit('NF1')
s = s.replace(a, b, 1)
a2 = "import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'"
if a2 not in s:
    sys.exit('NF2')
s = s.replace(a2, "import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'", 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok')
