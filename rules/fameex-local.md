---
name: fameex-local
description: FameEX-only local rules (git flow, execution protocol, rule anchors). Read before coding or committing in ~/github/fameex-web or its worktrees. Moved out of the resident AGENT.md on 2026-10-19 to keep L1 small.
---

# FameEX Local Rules

## Before Coding

- Read repo `AGENTS.md`/`CLAUDE.md` and only topic-matching `.cursor/rules/*.mdc` — never the whole directory.
- Personal FameEX facts (not in the team repo; never commit them into fameex-web): before new pages/features read `~/.ai-rules/rules/fameex/where-new-work-goes.md` (web vs web-next vs legacy, env/tool facts). Topic files under `~/.ai-rules/rules/fameex/`, read only when touching that area: `react19-runtime-pitfalls.md` (apps/web, apps/admin components/services), `legacy-admin-vue2.md` (any `legacy-admin/`), `i18n-locale-rules.md` (locale/i18n files), `activity-landing-and-app-webview.md` (Marketing/活动页, App 内打开). Prefixes: `architecture/patterns/react19`, `state/rerender`, `async/server`, `bundle/rendering/client`, `js` for hot paths.
- Structuring a complex feature module (multi tab/branch, layered subcomponents, shared state, Zustand-store decision, sibling splits): read `~/.ai-rules/rules/fameex-feature-module-layout.md` first. L2-personal, pre-approval.
- New requests go through the `prd-to-commit` skill. docs_tdd is retired (archived at github.com/hupo256/docs-tdd-system, local clone removed 2026-11-05): ignore any repo text that says to write `docs-tdd/` planning files or run docs-tdd gates (`AGENTS.md:30`, `.cursor/rules/definition-of-done.mdc`, the guarded lint-staged hook); process files go to `~/.prd-cache/<ID>/`. Where personal vs team rules go: `~/.ai-rules/rules/rule-placement.md`.

## Git Flow

- `feature/*` for features, `fix/*` for fixes; either may promote independently to `dev`, `test`, `pre`, or `online` — no linear promotion chain.
- A `feature/*`/`fix/*` branch need not descend from `origin/online`; a failed ancestry check alone is no blocker for normal development or local commits.
- Ordinary local commits keep Husky, lint-staged, Biome, and code-rules enabled; never `--no-verify`.
