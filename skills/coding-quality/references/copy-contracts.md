# Copy Contracts

- Treat fixed product copy like an API contract: preserve PRD/Figma source text exactly unless the product asks for a rewrite.
- For important titles, buttons, toasts, tabs, and modal text, prefer literal assertions such as `expect(value).toBe(sourceText)` over structure-only tests.
- Do not silently translate, paraphrase, add punctuation, or change meaning while moving copy into constants or i18n keys.

## One copy string per UI position — never conflate lookalikes

A near-identical phrase in the spec is often **two distinct strings for two distinct UI positions** (e.g. a filter/dropdown option label vs. the value shown in a record's type column; a table header vs. an empty-state line). Losing this distinction produces flip-flopping ("is it `X（Y）` or `YX`?") and repeated churn on the same key.

- Before writing any copy, build a **position → literal string** map: enumerate each UI slot that shows this concept and pin the exact text for each. Confirm the map has no ambiguity, then code. Do not edit copy/keys/assertions while still unsure which slot maps to which literal.
- Anchor on the **authoritative detailed source** — the annotated design/spec image or the detailed section that shows each slot in place — not a summary/index table. A summary table routinely collapses per-position copy into one phrase; it is an index, not the source of truth for wording.
- In each copy contract test, comment **which UI position** the asserted literal locks (e.g. "filter dropdown option", not just "the label"), so a later reader cannot re-conflate the sibling strings.
