# Data-Driven Rendering And Shared Prop Contracts

Two coupled patterns for repeated UI. Trigger: you are about to write (or are reviewing) N near-identical JSX blocks — tabs, steps, list rows, radio cards, filter chips — or the same prop set is passed to 2+ sibling components/variants.

## Render repeated structure from data, not copy-paste

- When 2+ sibling blocks differ only by a few values (key/title/content, label/icon/route), model them as one `Array<Config>` and render with a single `.map`. The config item type is a named `interface` (`XxxTab`, `XxxStep`).
- Put per-item differences in the data; keep the render body identical for every item. If one item needs an extra field (e.g. only one tab has `defaultValues`), keep it optional on the config type or assemble that one item's element inline — do not fork the render into per-item branches.
- Do not turn genuinely divergent blocks into a forced table: if items share almost no structure, or the "config" needs a `variant`-shaped `if` inside the render for each field, keep them as separate explicit elements. Data-driven pays off when the render body is truly shared.

## Choose the vehicle first: self-read vs a threaded shared prop contract

When the same group of values feeds 2+ sibling components (form variants, a component and its verbose child), first decide *how* they should reach consumers — do not reflexively thread them as props:

- If the shared group is **server state**, let each consumer self-read the same React Query hook (wrap it in one `useXxxContext` hook so every call site is uniform). The query cache dedups by key, so there is no extra request and no prop threading — and no mirroring into a store. This is the default for shared server data.
- If the shared group is **client UI state that already crosses sibling boundaries** (multi-select, modal open state, a working draft), it belongs in a store; consumers read it with single-field selectors. Again, no threading.
- Only values that are **genuinely local to this parent and owned by neither a query nor a store** (a per-variant `defaultValues`, the `variant` discriminator, an `onSubmitSuccess` the parent controls) travel as props. Reach for a shared prop contract only for *these*.

For the props that do travel, collapse the duplicated prop list to one source:

- Define one `XxxSharedProps` interface for the common fields. Each consumer's own interface `extends` it and adds only its unique fields (`interface FixedFormProps extends CopyFormSharedProps { variant: ... }`).
- In the parent, assemble the shared values **once** into a variable and `{...spread}` it into each consumer, instead of re-listing every prop per call site.
- **Type the assembled object explicitly** (`const shared: XxxSharedProps = { ... }`). JSX spread relaxes excess-property checking, so an untyped shared object lets a stray or misspelled field slip through silently; the annotation makes a missing/extra field fail at the assembly site.
- Keep a field optional on the shared type if not every parent supplies it (e.g. `onSubmitSuccess?`), so one shared contract still serves parents that omit it.

Canonical shape (shared context is self-read; only per-tab locals travel as props):

```ts
// hooks/useCopySettingContext.ts — deep consumers self-read server state; React Query cache dedups by key
export const useCopySettingContext = () => {
  const leaderUserId = useSettingFormStore((s) => s.leaderUserId) // route param / store, not server state
  const { data } = useBeforeFollow(leaderUserId)                  // same key → no extra request
  return { followSetting: data?.followSetting, isFollowed: resolveIsFollowed(data?.myFollowSetting) /* ... */ }
}

// each variant reads the shared context itself — the parent does NOT thread it down
function AmountCopyForm({ variant, onSubmitSuccess }: { variant: AmountCopyType; onSubmitSuccess?: () => void }) {
  const { followSetting, isFollowed } = useCopySettingContext()
  // ...
}

// parent wires only per-tab locals (variant / defaultValues / onSubmitSuccess), not the shared server/UI state
const tabs: CopyTypeTab[] = [
  { key: 'smart', title: t('...'), content: <SmartCopyForm defaultValues={...} /> },
  { key: 'fixed', title: t('...'), content: <AmountCopyForm variant="fixed" /> },
]
```

If those per-tab locals themselves grow into a shared group across variants, apply the `XxxSharedProps` extends + assemble-once-spread + explicit-type recipe above to *them* — but never to values a query or store already owns.

## Let the variant config carry the data-access strategy, not just presentation

When merged variants read *different source fields* for the same UI slot (fixed reads `fixedAmountMin/Max`, proportional reads `fixedRateMin/Max`), do not branch on `variant` at the read site. Put the source field names — and each variant's fallback default — in the config entry, then read the DTO through those pointers with a resolver. The config becomes the single place where "which fields and defaults this variant uses" lives; the render body and the read site stay variant-free, and adding a variant is a new config row rather than a new `if`.

```ts
interface AmountBoundsFields {
  minField: 'fixedAmountMin' | 'fixedRateMin'   // pointer into the DTO, not a value
  maxField: 'fixedAmountMax' | 'fixedRateMax'
  defaultMin: string                             // fallback when the DTO is absent
  defaultMax: string
}
const CONFIG: Record<Variant, { boundsFields: AmountBoundsFields /* + presentation flags */ }> = { /* ... */ }

const resolveAmountBounds = (f: AmountBoundsFields, dto?: FollowSetting) => ({
  amountMin: dto ? String(dto[f.minField]) : f.defaultMin,
  amountMax: dto ? String(dto[f.maxField]) : f.defaultMax,
})
```
