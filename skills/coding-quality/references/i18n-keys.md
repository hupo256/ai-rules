# i18n Keys Are What-You-See-In-Source (i18n Ally WYSIWYG)

The i18n Ally editor extension resolves a full literal key inside a `t('...')` call and shows the translated copy inline in the source. That preview only works when the literal key sits directly in the `t()` call. Optimize every i18n decision for keeping the literal key visible in source, not just grepable.

- Write full literal keys inline: `t('namespace:key')`. This is the default for every string.
- For enum/status/value -> copy, build the map **inside** the component or a hook, where every map **value** is a literal `t('ns:literal.key')` call, and index into it by the variable. The literal keys stay inline (i18n Ally previews them); only the lookup is indirect. Canonical shape:

  ```ts
  const reasonMap: Record<string, string> = {
    NOT_EXISTS: t('campaign:reject.detail.NOT_EXISTS'),
    OFFLINE: t('campaign:reject.detail.OFFLINE'),
    // ...one inline t('literal') per value
  }
  const message = reasonMap[reason]
  ```

- Do NOT store i18n **key strings** in a `Record`/constant and later feed them into `t(variable)`. That indirection (`const KEY_BY_X: Record<..., string> = { A: 'ns:a' }; t(KEY_BY_X[x])`) hides copy from i18n Ally and duplicates a key list that drifts. Convert such tables to the value-is-`t()` shape above.
- Do NOT build the whole key by interpolation from a variable, such as `t(`ns:status.${status}`)` or `t(keyVar)` — the composed key is not a literal, so i18n Ally cannot preview it and grep cannot find `ns:status.active`. Enumerate the finite cases as literal `t()` values in a map instead.
- When a lookup encodes business grouping unrelated to copy (e.g. several backend enum values are one semantic category), let the table resolve to a plain **semantic category** literal-union type, then let the consuming component map category -> literal `t('ns:literal')`. Keep i18n keys out of the shared/pure table.
- Only exception — an **unbounded** backend string that cannot be enumerated may use a dynamic key with i18next `defaultValue` fallback (`t(`ns:reject.${reason}`, { defaultValue: fallback })`). This is deliberate fallback behavior, not a lookup table; keep it isolated and commented, and do not use it as an excuse to skip literal keys for finite enums.
