# Codex Global Coding Rules

> Keep this resident file short (≤7000 chars, check: `node ~/.ai-rules/scripts/check-resident.mjs`); long checklists live in skills or repository rules.

## React / TypeScript Hard Rules

- Use named input types: a React component, custom hook, dispatcher, or utility with 2+ inputs including callbacks gets `XxxProps`/`XxxParams`, destructured inside the body. No anonymous inline object parameter types or `Record<string, unknown>` shortcuts.
- Avoid bare `any`: narrow external data with schemas, type guards, `unknown`, or existing contracts instead of hiding uncertainty with `any` or broad casts.
- Keep i18n keys as literals in source (i18n Ally WYSIWYG): `t('ns:literal.key')` inline; enum/status->copy maps hold literal `t()` calls (the `reasonMap` shape), never key strings fed to `t(variable)` or interpolated keys. Only an unbounded backend string may use a dynamic key with `defaultValue`. Details: `coding-quality` -> `i18n-keys.md`.
- Treat schemas and mappers as API truth: model real fields/types/nullability, reject `schema.parse(x) as T`, parse list items element-resiliently, never fabricate missing fields.
- Pass API field names through as-is (case-only conversion is fine); never re-label one field as another to fit an existing slot. Rename only for real cross-source aggregation; map onto storage/legacy slots at the single write point with a comment citing the contract. Details: `coding-quality` -> `api-schema-mapper.md`.
- Do not patch backend-root-cause defects in the frontend: report a wrong value rooted in a wrong/missing backend field as a blocker; never mask it via sibling-field arithmetic, enum-from-display-text inference, or schema-comment rewrites. Temporary workarounds need the approvals listed in `api-schema-mapper.md` (strictest for money/status/permission/irreversible actions).
- Keep server state in React Query and local UI state in Zustand; do not duplicate server or derived state into stores unless existing architecture requires it.
- Keep `.tsx` components under 300 lines; split child components, pure helpers, constants, or feature-local types before the file becomes hard to review.
- Do not fake missing data: required missing values render as an explicit empty marker such as `--`; optional missing values usually do not render. Do not invent business defaults with `?? 'fake copy'` or `|| 'fake value'`.

## Validation Economy

- Do not run format, type, lint, test, or build commands during iterative edits; batch edits, then run once stable, scoped to touched files only — never a whole-repo/whole-suite run for a small change. A pre-commit hook that reruns a formatter (e.g. Husky-staged Biome) is the final guarantee; don't duplicate it per edit.
- Test pure/tool-shaped code by default — mappers, resolvers, formatters, calculations, state machines, contracts, branches/boundaries, regressions, invariants. Never write test cases for `.tsx` components (no `*.test.tsx`, no render/unit tests, no reshaping logic for mocked-call asserts); verify rendering via a DOM-contract script or a real browser check.
- Report excluded checks as `not-required`, not passed/skipped; unexecuted checks never pass.

## Subagent Delegation

- Decide by dependency, then workload: run sub-tasks in parallel subagents only when they touch disjoint files and need none of each other's output, and only when each clearly outweighs a fresh agent rebuilding context (a separate project, a whole page, a deep investigation); do small scattered edits yourself. Review returned diffs, not just reports.

## On-Demand Rule Loading

L1 craft lives here plus `~/.ai-rules/skills/*`; L2 repository rules live in each repo — load only topic-matching files, never a whole directory.

- Non-trivial frontend work — data UI, reuse/shared props, API/schema/mapper, state derivation, forms, timers/animation, styling/visual QA, i18n: read `~/.ai-rules/skills/coding-quality/SKILL.md`, then only the routed topic reference.
- Figma MCP extraction or visual reconstruction from Figma: read `~/.ai-rules/skills/figma-read/SKILL.md` before coding.
- Set-operation changes (units in/out of a layout or container, deleting a control group / retiring an experiment, batch replace/migration, multi-site rename, "all/every/each of N" where a miss must fail at compile time): read `~/.ai-rules/skills/change-scoping/SKILL.md` before coding.
- Before coding or committing in `~/github/fameex-web` or its worktrees: read `~/.ai-rules/rules/fameex-local.md` (git flow, repo rules, module layout, docs_tdd status).

## Conversation Defaults

- Reply to the user in Chinese unless they ask otherwise. Keep code, identifiers, commands, and paths in English.

## Git Authorization

- Authority ends at `git add`/`git commit`; never `git push` unless the user explicitly authorizes it in the current request — one-time, never carried over.
