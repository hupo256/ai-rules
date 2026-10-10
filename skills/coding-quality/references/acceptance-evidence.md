# Atomic Acceptance And Evidence

Use this checklist when translating PRD requirements into implementation tasks, writing acceptance evidence, or deciding whether a frontend change is ready for testing.

## 1. Make The PRD Bullet The Acceptance Unit

- Give every in-scope PRD bullet a stable requirement ID such as `R-F09-01`.
- Split bundled task wording such as “change A, hide B, and add C” into one task per requirement ID. Each task owns its own status and evidence; a parent checkmark must not close multiple requirements.
- Keep one observable predicate per requirement. If one PRD bullet requires several proof dimensions, list every required evidence type explicitly instead of weakening it to one convenient test.
- Traceability must be bidirectional: requirement → exactly one task; acceptance item → requirement + task.

## 2. Match Evidence To The Claim

| Requirement claim | Required evidence type | Acceptable proof |
|---|---|---|
| Exact user-facing copy | `copy-literal` | Literal equality assertion against the approved source text |
| Label, visibility, position, conditional rendering | `component-dom` | Rendered component/DOM assertion, or an equivalent UI branch test |
| Calculation, resolver, state transition | `pure-logic` | Focused deterministic unit test |
| Submitted payload or request mapping | `payload-contract` | Submit/request assertion against the exact payload |
| API/schema contract | `api-contract` | Schema/contract test using a real or approved fixture |
| Click, navigation, modal, toast, browser-only side effect | `browser-interaction` | Real browser steps plus the resulting side effect |
| Color, spacing, responsive layout, visual hierarchy | `visual` | Human visual comparison/checklist with the target state identified |

A copy assertion proves only the string. It does not prove that a label changed, a field disappeared, a condition selected the right branch, the text is red, or the text is located under the intended field. One evidence item may satisfy only the evidence type it actually exercises.

## 3. Reconcile Before Saying “Ready For Test”

Perform a PRD requirement ↔ evidence reconciliation, not a commit ↔ feature reconciliation:

1. Every in-scope requirement ID points to its single task.
2. Every required evidence type has a current, passing acceptance item.
3. Changed files pass the repository's required formatter/linter, typecheck, and focused tests.
4. Manual UI/visual checks are listed explicitly and signed by the responsible human when the repository requires it.
5. In a `docs_tdd` repository, the full G6 result is persisted as PASS and its HEAD, dirty hash, and rule fingerprints still match the working state.

If any item is missing, say “implementation pending evidence”, “ready for integration”, or “pending reconciliation” as appropriate. Do not say “ready for test”. A partial G6 result is evidence of partial progress only; it is never a full G6 PASS.
