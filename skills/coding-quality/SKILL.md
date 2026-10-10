---
name: coding-quality
description: Frontend code-quality checklist for React/TypeScript work. Use when writing data-request UI, reuse-sensitive UI, repeated JSX blocks (tabs/steps/list rows) or shared prop contracts across sibling components, API/schema/mapper code, loading/empty/error states, multi-branch state derivation, lookup-table resolvers, resolving a bound/range/limit/default from a DTO with a fallback, controlled form/params hooks that backfill from server edit-state or clamp values on commit, timers, animation, carousels, countdowns, tickers, styling/token choices, visual QA, or i18n key/copy selection. Short hard rules stay in /Users/aven/.ai-rules/AGENT.md; this skill holds longer on-demand checks.
---

# Frontend Code Quality Checklist

Global high-risk rules live in `/Users/aven/.ai-rules/AGENT.md`. This skill owns the longer implementation-quality checklist: DRY threshold, lookup-table mappings, route/component/API layering, schema and mapper detail, React Query vs Zustand boundaries, pure helpers for risky logic, useful comments, and task-specific checks. Load only what the current task needs.

## 0. Pre-Code Quality Card

Before writing non-trivial frontend code, answer these briefly in your own working notes and let the code follow the answers:

- Scope: which route, component, hook, service, store, mapper, or style surface changes, and what must stay untouched?
- Reuse: what nearby/shared implementation was searched, and why direct reuse or a light wrapper is or is not enough?
- Data contract: what is the API/source shape, where is schema/narrowing done, and what UI model leaves the mapper?
- State owner: what belongs to React Query/server state, local component state, URL state, or Zustand?
- Branch model: which status/copy/style/action branches should be a `Record` or resolver instead of scattered JSX conditions?
- Verification: which focused command, pure test, browser scenario, or visual check proves this exact change?

## 0.1 Output Quality Gate

Before finishing any code change, check both the local implementation and the whole solution shape. Do not treat passing syntax or a green narrow test as enough when the solution is poorly placed or hard to maintain.

Local implementation quality:

- Components, hooks, dispatchers, and utilities with 2+ inputs use a named `XxxProps` / `XxxParams` contract and destructure in the body.
- Types are explicit at boundaries; no bare `any`, unjustified broad casts, or `schema.parse(x) as T` masking.
- Logic is readable, scoped, and testable; risky business rules such as money, precision, sorting, permissions, route decisions, and state machines sit in pure helpers when practical.
- Exported components/hooks/functions get a useful one-line business-purpose or constraint comment; do not restate the code.
- `.tsx` components stay under 300 lines; split children, helpers, constants, or feature-local types before review becomes difficult.
- Request-driven UI handles loading, empty, error, disabled, unauthorized, and unauthenticated states where relevant.
- Missing required data renders an explicit empty marker; optional missing data usually does not render. Do not invent fake defaults or duplicate fallback data.
- Branches that are static mappings use `Record`/constant maps or semantic resolvers instead of scattered JSX conditions.

Whole-solution quality:

- The change follows existing route/page/component/service/store/mapper ownership boundaries and nearby code patterns.
- Reuse was checked before adding components, hooks, services, stores, utils, formatters, route actions, or styles.
- New abstraction exists only when it removes real duplication or complexity, or matches a stable local pattern already present in the codebase.
- Server state stays in React Query and local UI/session state stays local or in Zustand only when it truly crosses component boundaries.
- API DTOs stay out of components; mapper output stays contract-aligned and does not fabricate fields.
- The verification plan matches the risk and touched surface; skipped checks have a concrete reason, not a vague note.

If a simpler, more local, or more architecture-aligned implementation is available, use it unless there is a documented tradeoff. If the chosen design is not obviously the simplest fit, record the reason in the task notes or project evidence.

## On-Demand Topic References

§0 / §0.1 above are the always-on quality gates. The longer checks below live one-per-file under `references/`; load only the rows that match the current task, not the whole set.

| Load when the task involves | Reference |
|------|-----------|
| Request-driven UI: loading / empty / error / disabled / unauthorized / refresh-failure states | [references/data-request-states.md](references/data-request-states.md) |
| Multi-branch status/copy/style derivation; lookup tables & resolvers; resolving a bound/range/limit/default from a DTO with a named fallback | [references/state-derivation-lookup.md](references/state-derivation-lookup.md) |
| Timers, animation, carousels, countdowns, tickers, `requestAnimationFrame` — Page Visibility pause/resume | [references/timers-animation-visibility.md](references/timers-animation-visibility.md) |
| i18n key/copy selection; enum/status → copy maps; keeping keys WYSIWYG for i18n Ally | [references/i18n-keys.md](references/i18n-keys.md) |
| Before adding a component/hook/service/store/util/formatter/route action/style — reuse search first | [references/reuse-before-new-ui.md](references/reuse-before-new-ui.md) |
| API/schema/mapper work; DTO narrowing; mock-data parity; contract-aligned mapper fields | [references/api-schema-mapper.md](references/api-schema-mapper.md) |
| Deciding which file a new symbol belongs in — placement by concept, prefix boundaries | [references/placement-by-concept.md](references/placement-by-concept.md) |
| Styling/token choices and visual QA across breakpoints, themes, and UI states | [references/styling-visual-qa.md](references/styling-visual-qa.md) |
| Moving fixed product copy into constants/i18n; copy-as-contract assertions | [references/copy-contracts.md](references/copy-contracts.md) |
| Turning PRD bullets into tasks/acceptance; deciding whether evidence really proves copy, DOM behavior, logic, payload, interaction, or visual requirements | [references/acceptance-evidence.md](references/acceptance-evidence.md) |
| Repeated JSX blocks (tabs/steps/rows/cards/chips); shared prop contracts across sibling components/variants | [references/data-driven-rendering.md](references/data-driven-rendering.md) |
| `useXxxForm` / `useXxxParams` hooks: server-edit-state backfill, in-flight vs committed value, memoized return | [references/controlled-form-hooks.md](references/controlled-form-hooks.md) |
