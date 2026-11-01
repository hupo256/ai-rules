---
name: fameex-local
description: FameEX-only local rules (git flow, execution protocol, rule anchors). Read before coding or committing in ~/github/fameex-web or its worktrees. Moved out of the resident AGENT.md on 2026-10-19 to keep L1 small.
---

# FameEX Local Rules

## Before Coding

- Read repo `AGENTS.md`/`CLAUDE.md` and only topic-matching `.cursor/rules/*.mdc` — never the whole directory.
- Personal FameEX facts (not in the team repo; never commit them into fameex-web): before new pages/features read `~/.ai-rules/rules/fameex/where-new-work-goes.md` (web vs web-next vs legacy, env/tool facts). Topic files under `~/.ai-rules/rules/fameex/`, read only when touching that area: `react19-runtime-pitfalls.md` (apps/web, apps/admin components/services), `legacy-admin-vue2.md` (any `legacy-admin/`), `i18n-locale-rules.md` (locale/i18n files), `activity-landing-and-app-webview.md` (Marketing/活动页, App 内打开). Prefixes: `architecture/patterns/react19`, `state/rerender`, `async/server`, `bundle/rendering/client`, `js` for hot paths.
- Structuring a complex feature module (multi tab/branch, layered subcomponents, shared state, Zustand-store decision, sibling splits): read `~/.ai-rules/rules/fameex-feature-module-layout.md` first. L2-personal, pre-approval.
- New requests go through the `prd-to-commit` skill. Do not run `docs-tdd.mjs context/changed/gate/doctor` or build evidence suites: `~/github/docs_tdd` is a frozen read-only archive; a legacy v1/v2 project under its `prds/` follows its own README only when that project is the task.

## Git Flow

- `feature/*` for features, `fix/*` for fixes; either may promote independently to `dev`, `test`, `pre`, or `online` — no linear promotion chain.
- A `feature/*`/`fix/*` branch need not descend from `origin/online`; a failed ancestry check alone is no blocker for normal development or local commits.
- Ordinary local commits keep Husky, lint-staged, Biome, and code-rules enabled; never `--no-verify`.
