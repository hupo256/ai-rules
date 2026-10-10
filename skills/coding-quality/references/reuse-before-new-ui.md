# Reuse Before New UI

- Before adding components, hooks, services, stores, utils, formatters, route actions, or styles, search nearby feature code, sibling domains, and shared packages for existing implementations.
- Prefer direct reuse, then light wrappers/composition/props, then extracting a shared helper only after at least two real consumers need the same behavior.
- For high-reuse UI patterns such as modals, bottom sheets, share rows, poster saving, copy links, pagination, empty tables, status CTAs, task cards, ranking lists, and steppers, search across the app before creating new UI.
- Do not create a new component just because the plan named a new file, the difference is only copy/one button, or reuse feels slower; write down the concrete incompatibility before new code.
- When candidates are scarce, record the search terms and hit count rather than claiming reuse was skipped.
