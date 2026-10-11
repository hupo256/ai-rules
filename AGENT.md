# Codex Global Coding Rules

> Keep this resident file short; load long checklists from matching skills or repository rules.

## Rule Layers And Loading

- L1 global craft lives here plus `~/.ai-rules/skills/*`: pure coding technique that works across repositories.
- L2 repository anchors live in the repo, e.g. `~/github/fameex-web/.cursor/rules/*.mdc`: load only topic-matching files, never the whole directory.

## React / TypeScript Hard Rules

- Use named input types: a React component, custom hook, dispatcher, or utility with 2+ inputs including callbacks gets `XxxProps`/`XxxParams`, destructured inside the body. No anonymous inline object parameter types or `Record<string, unknown>` shortcuts.
- Avoid bare `any`: narrow external data with schemas, type guards, `unknown`, or existing contracts instead of hiding uncertainty with `any` or broad casts.
- Keep i18n keys as literals in source (i18n Ally WYSIWYG): write `t('ns:literal.key')` with the full key inline. In enum/status->copy maps the map value must be a literal `t()` call indexed by the variable (the `reasonMap` shape); never store key strings in a `Record` feeding `t(variable)`, and never interpolate the key like `t(`ns:${x}`)`. Only an unbounded backend string may use a dynamic key with i18next `defaultValue`. Details in `coding-quality` §4.
- Treat schemas and mappers as API truth: model real fields/types/nullability, reject `schema.parse(x) as T`, parse list items element-resiliently, keep one-source field names contract-aligned, never fabricate missing fields. Load `coding-quality` -> `references/api-schema-mapper.md` for API/schema/mapper work.
- Do not patch backend-root-cause defects in the frontend: a wrong value rooted in a wrong/missing backend field gets reported (raise a blocker), not masked via sibling-field arithmetic, enum-from-display-text inference, or schema-comment rewrites. A temporary workaround needs product/API-owner approval, a filed backend ticket, activation/removal conditions, an independent contract test, and a named owner — strictest for money/status/permission/irreversible actions. Details in `coding-quality` -> `api-schema-mapper.md`.
- Keep server state in React Query and local UI state in Zustand; do not duplicate server or derived state into stores unless existing architecture requires it.
- Keep `.tsx` components under 300 lines; split child components, pure helpers, constants, or feature-local types before the file becomes hard to review.
- Do not fake missing data: required missing values render as an explicit empty marker such as `--`; optional missing values usually do not render. Do not invent business defaults with `?? 'fake copy'` or `|| 'fake value'`.

## Validation Economy

- Do not run format, type, lint, test, or build commands during iterative edits; batch edits, then run once stable, scoped to touched files only — never a whole-repo/whole-suite run for a small change. If a pre-commit hook reruns a formatter (e.g. Husky-staged Biome) at commit, don't duplicate it per edit — the hook is the final guarantee.
- Test pure/tool-shaped code by default — mappers, resolvers, formatters, calculations, state machines, contracts, meaningful branches/boundaries, regressions, cross-cutting invariants. Never write test cases for `.tsx` components — no `*.test.tsx`, no render/unit tests, no reshaping component logic for testability or mocked-call asserts; verify rendering (label/visibility/conditional) via a DOM-contract script or a real browser check.
- Report excluded checks as `not-required`, not passed/skipped; unexecuted checks never pass.

## On-Demand Rule Loading

- For non-trivial frontend work — data UI, reuse/shared props, API/schema/mapper, state derivation, forms, timers/animation, styling/visual QA, i18n — read `~/.ai-rules/skills/coding-quality/SKILL.md`, then only the routed topic reference.
- Figma MCP extraction or visual reconstruction from Figma: read `~/.ai-rules/skills/figma-read/SKILL.md` before coding.
- Set-operation changes (units in/out of a layout or container, deleting a control group / retiring an experiment, batch replace/migration, multi-site rename, "all/every/each of N" where a miss must fail at compile time): read `~/.ai-rules/skills/change-scoping/SKILL.md` before coding.
- Structuring a complex FameEX feature module (multi tab/branch, layered subcomponents, shared state, Zustand-store decision, sibling splits): read `~/.ai-rules/rules/fameex-feature-module-layout.md` before coding. L2-personal, pre-approval.
- FameEX coding anchors live in `~/github/fameex-web/.cursor/rules/*.mdc`; load only topic-matching prefixes (`architecture/patterns/react19`, `state/rerender`, `async/server`, `bundle/rendering/client`, `js` for hot paths).

## Conversation Defaults

- Reply to the user in Chinese unless they ask otherwise. Keep code, identifiers, commands, and paths in English.

## Git Authorization

- Authority ends at `git add`/`git commit`; never `git push` unless the user explicitly authorizes it in the current request — one-time, never carried over.

## FameEX Local Git Flow

- FameEX uses `feature/*` for features and `fix/*` for fixes; either may promote independently to `dev`, `test`, `pre`, or `online` — no linear promotion chain.
- A `feature/*`/`fix/*` branch need not descend from `origin/online`; a failed ancestry check alone is no blocker for normal development or local commits.
- Ordinary local commits keep Husky, lint-staged, Biome, and code-rules enabled; never `--no-verify`.

## FameEX Local Execution Protocol

- Before business coding in `~/github/fameex-web` or its worktrees, read repo `AGENTS.md`/`CLAUDE.md` and only topic-matching `.cursor/rules/*.mdc`.
- New requests do not run `docs-tdd.mjs context/changed/gate/doctor` or build evidence suites. `~/github/docs_tdd` is a frozen read-only archive; a legacy v1/v2 project under its `prds/` follows its own README only when that project is the task.
