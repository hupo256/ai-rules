# API Schema And Mapper Checks

- Keep raw DTOs out of components; map external data through schema, mapper, selector, or explicit narrowing before rendering.
- Mock data must pass the same schema/mapper/UI type path as real API data.
- Keep one-source mapper fields aligned with API names even after type/format conversion or source disambiguation. Rename only for real cross-source unification or multi-field semantic derivation, and record the source fields.
- Avoid fake contract fields: if UI needs data that the API does not provide, show an explicit empty marker or document the missing field instead of inventing fallbacks.
- Treat `schema.parse(x) as T` as a red flag because the parse may strip undeclared fields while the cast hides the mismatch.

## List Responses Must Be Element-Resilient

A single top-level `z.array(itemSchema).parse(raw)` (or `listSchema.parse` wrapping such an array) throws on the **first** non-conforming element and discards the **entire** array. In production this reads as "接口有返回，前端不显示" / "暂无数据": one anomalous row (a market-maker rebate order with a reduced field set, a legacy record, a new nullable field the schema hasn't caught up to) blanks the whole table. This is a recurring, high-severity failure mode — treat whole-array `.parse` on a rendered list as a bug.

Required pattern for any array that feeds a list/table UI:

1. Parse the **envelope** loosely — keep the array as `z.array(z.unknown())` (plus `count`, paging, etc.), so envelope shape is still validated but rows are not yet.
2. `safeParse` **each element** with the item schema. Push successes; on failure, skip that row and `console.warn` **only in non-production** (`process.env.NODE_ENV !== 'production'`) with the index, `error.issues`, and the raw item so the specific bad field is diagnosable.
3. Return the surviving rows plus the real `count`. Wire this resilient parser into the query `transfer`, not the raw `.parse`.

```ts
export const parseXxxList = (raw: unknown): XxxList => {
  const envelope = z.object({ list: z.array(z.unknown()).nullish(), count: z.number().nullish() }).nullish().parse(raw)
  if (!envelope) return undefined
  const list: XxxItem[] = []
  envelope.list?.forEach((item, index) => {
    const parsed = xxxItemSchema.safeParse(item)
    if (parsed.success) list.push(parsed.data)
    else if (process.env.NODE_ENV !== 'production') console.warn(`[xxx] row ${index} parse failed, skipped`, parsed.error.issues, item)
  })
  return { list, count: envelope.count ?? 0 }
}
```

- Per-row skip is a **safety net, not a substitute** for a correct schema. Still relax fields to `nullable()/optional()` where the API genuinely omits them (honest nullability), and reconcile against the real contract — do not leave the schema wrong and lean on the skip to hide it.
- Cover it with a unit test that a single broken row is skipped while the other rows survive and `count` is preserved, so the "one row nukes the table" regression cannot come back silently.

## Backend-Root-Cause: Do Not Compensate In The Frontend

When a displayed value is wrong, first locate the **first place the wrong value appears** along `API → schema/mapper → state → UI`. If the API response itself already carries the wrong/missing value and the frontend only displays it, the root cause is the **backend**. The correct action is to report it (raise a backend defect / blocker) and leave the frontend as a faithful pass-through — **not** to make the symptom disappear with frontend arithmetic.

Concrete anti-patterns (all observed in real defects, all forbidden):

- **Reverse-engineering an authoritative field by arithmetic on siblings.** The backend returns `availableTrialFee`, `affectedTotalAmount`, `frozenAmount`, `positionOccupiedAmount` as authoritative fields. Do NOT do:

  ```ts
  // ❌ guessing the "inactive" slice by subtraction, then overriding the backend value
  const inactive = bn(affectedTotalAmount).minus(availableTrialFee).minus(frozenAmount)
  const displayAvailable = inactive.gt(0) ? bn(availableTrialFee).plus(inactive).toFixed() : availableTrialFee
  // ❌ re-deriving the total the frontend "thinks" is right
  const displayTotal = bn(affectedTotalAmount).minus(positionOccupiedAmount).toFixed()
  ```

  The composition formula is a **guess**; the moment the backend's composition differs, the frontend silently shows a wrong number — and on an **irreversible / money / risk** confirmation dialog the displayed value now disagrees with what the backend actually executes. Render the backend field directly (`amount(preview.availableTrialFee)`); push the口径 question to the backend.

- **Inferring an enum/state from a display-text field.** `couponStatusText === '已过期'` to decide "expired" couples logic to a localized display string; it breaks on copy/locale change and masks a backend that isn't returning a clean `status`. Decide from the real `status` enum; if `status` is missing/wrong after an operation, that is a backend bug.

- **Editing schema comments to match the symptom.** Do not rewrite a field's doc comment to encode your reverse-engineered assumption ("弹窗展示时需剔除仓位占用") — that launders a guess into apparent contract truth. Keep comments faithful to the backend field and mark the口径 as *pending backend confirmation*.

- **Writing mocks/tests that prove your own formula.** A test asserting the subtracted number is "correct" just entrenches the guess. Tests should assert **faithful pass-through** of the backend field, not the compensation.

Removing a **fake default** is different and legitimate: `status ?? Unused` / `Number(x) : Unused` that turns unknown/missing state into a business value (e.g. "claimable") is itself a frontend bug — deleting it and rendering `--` / not rendering is the correct fix (see "Do not fake missing data").

A temporary frontend workaround for a backend defect is allowed ONLY with all of: product/API-owner approval, a filed backend defect ticket, explicit activation + removal conditions, an independent contract test, and a named cleanup owner. Without complete evidence of the backend value, do not guess — mark the item "待补充证据 / evidence pending" and stop.
