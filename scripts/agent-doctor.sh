#!/bin/zsh
# 只读体检：Skill 层（目录/软链/重复/裸文件）、项目事实层（CLAUDE/AGENTS 体积、mdc 常驻数）、全局层（AGENT.md 预算）、工具层（CLI/MCP/pnpm/playwright/lark-cli/残留 dev server）。
# 不修改任何配置。usage: agent-doctor.sh [<repo-dir>]（默认 ~/github/fameex-web）
# 每行一项：ok | warn | missing。脚本全绿而 Agent 仍不触发时，问题在 description 或任务描述（路由层），不在这里。
set -u
repo="${1:-$HOME/github/fameex-web}"
AI="$HOME/.ai-rules"
ok(){ print -r -- "ok       $1" }; warn(){ print -r -- "warn     $1" }; missing(){ print -r -- "missing  $1" }

print -r -- "== Skill 层"
typeset -A seen
for base in "$HOME/.claude/skills" "$HOME/.codex/skills" "$repo/.claude/skills"; do
  [ -d "$base" ] || { [[ "$base" == "$repo"* ]] && ok "无项目级 Skill 目录 $base" || missing "skill-dir $base"; continue }
  for entry in "$base"/*(N); do
    name=$(basename "$entry")
    [[ "$name" == synced ]] && { ok "$base/synced（claude.ai 只读订阅，勿改勿同名）"; continue }
    if [ -L "$entry" ]; then
      target=$(readlink -f "$entry" 2>/dev/null || true)
      [ -n "$target" ] && [ -d "$target" ] || { missing "软链断了 $entry → $(readlink "$entry")"; continue }
    fi
    if [ -f "$entry" ]; then warn "裸文件不会被路由 $entry（做成 <name>/SKILL.md 或删除）"; continue; fi
    if [ ! -f "$entry/SKILL.md" ]; then warn "没有 SKILL.md $entry"; continue; fi
    desc=$(grep -m1 '^description:' "$entry/SKILL.md" | cut -c1-200)
    [[ "$desc" == *TODO* || ${#desc} -lt 40 ]] && warn "description 太短/占位 $entry: $desc" || ok "$entry"
    real=$(readlink -f "$entry")
    if [ -n "${seen[$name]:-}" ] && [ "${seen[$name]}" != "$real" ]; then warn "同名 Skill 两份来源 $name: ${seen[$name]} vs $real"; fi
    seen[$name]="$real"
  done
done

print -r -- "== 全局层"
node "$AI/scripts/check-resident.mjs" 2>&1 | sed 's/^/         /'
for link in "$HOME/.claude/CLAUDE.md" "$HOME/.codex/AGENTS.md"; do
  [ -L "$link" ] && [ -f "$link" ] && ok "$link → $(readlink "$link")" || warn "$link 不是指向 AGENT.md 的软链"
done

print -r -- "== 项目事实层 ($repo)"
for f in CLAUDE.md AGENTS.md; do
  if [ -f "$repo/$f" ]; then n=$(wc -c < "$repo/$f" | tr -d ' '); [ "$n" -gt 20000 ] && warn "$f ${n}B（>20K，考虑按主题拆到 .cursor/rules）" || ok "$f ${n}B"; else missing "$repo/$f"; fi
done
if [ -d "$repo/.cursor/rules" ]; then
  total=$(ls "$repo"/.cursor/rules/*.mdc 2>/dev/null | wc -l | tr -d ' ')
  always=$(grep -l '^alwaysApply: true' "$repo"/.cursor/rules/*.mdc 2>/dev/null | wc -l | tr -d ' ')
  noglob=$(for f in "$repo"/.cursor/rules/*.mdc; do grep -q '^globs:' "$f" || grep -q '^alwaysApply: true' "$f" || basename "$f"; done)
  [ "$always" -le 3 ] && ok ".cursor/rules: $total 条，常驻 $always 条" || warn ".cursor/rules: $total 条，常驻 $always 条（>3，每轮对话都加载）"
  [ -n "$noglob" ] && warn "既无 globs 也不常驻（永远不会命中）: $(echo $noglob | tr '\n' ' ')"
else missing "$repo/.cursor/rules"; fi
grep -qi "context7\|always use .* mcp" "$repo/CLAUDE.md" 2>/dev/null && warn "CLAUDE.md 里有对未安装 MCP 的硬性要求"

print -r -- "== 工具层"
command -v claude >/dev/null && ok "claude $(claude --version 2>/dev/null | head -1)" || missing "claude 不在 PATH"
command -v claude >/dev/null && { mcp=$(claude mcp list 2>/dev/null | grep -vi "no mcp\|^$" | wc -l | tr -d ' '); [ "$mcp" -gt 0 ] && ok "MCP 已注册 $mcp 个" || ok "本机无自装 MCP（Figma/Lark 走 claude.ai 连接器与 lark-cli）"; }
for c in node pnpm lark-cli; do command -v $c >/dev/null && ok "$c $($c --version 2>/dev/null | head -1)" || missing "$c 不在 PATH"; done
if [ -f "$repo/package.json" ]; then
  want=$(grep -o '"packageManager": *"pnpm@[^"]*"' "$repo/package.json" | grep -o 'pnpm@[0-9.]*' | cut -d@ -f2)
  have=$(pnpm --version 2>/dev/null)
  [ "$want" = "$have" ] && ok "pnpm 版本与 packageManager 一致 ($have)" || warn "pnpm $have ≠ packageManager $want"
fi
ls "$repo"/node_modules/.pnpm 2>/dev/null | grep -q '^playwright@' && ok "playwright 在 $repo" || warn "playwright 不在 $repo/node_modules（browser.mjs 会找不到）"
for f in "$HOME"/.config/prd-to-commit/dev/*.json(N); do
  port=$(python3 -c "import json;print(json.load(open('$f'))['url'].split(':')[-1])" 2>/dev/null)
  lsof -ti tcp:${port:-0} -sTCP:LISTEN >/dev/null 2>&1 && warn "dev server 仍在跑 $(basename $f) :$port" || warn "残留状态文件 $(basename $f)（进程已不在，可删）"
done
print -r -- "== 完"
