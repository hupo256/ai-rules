# State Derivation And Lookup Resolvers

- Use `Record` or constant objects for static `A -> B` mappings.
- For simple priority rules, compute candidates first, then choose with `??` or a clear branch.
- For complex conditions, put the decision in a semantic resolver instead of scattering branches through JSX.
- Let tables map values; let resolvers decide when a table applies.
- Make fallback branches explicit so the UI does not infer behavior from `undefined`.
- Do not over-abstract one-off checks: if a branch is 1-2 lines and unlikely to expand, inline code or a small resolver can be clearer than a rule array.

Prefer server-sent bounds over hardcoded ones, but resolve them defensively. When the backend starts sending a value that used to be a frontend constant (a range, min/max, step, limit, or default), read it DTO-first and fall back to a **named** constant only when the DTO value is missing or invalid — never scatter the raw magic number at the read site. Guard validity explicitly (not a number, non-finite, out of the allowed sign, `min >= max`) and return the whole fallback object on any invalid combination, so a half-valid DTO cannot produce a broken range. Keep the resolver pure and unit-test the fallback branches (missing / NaN / inverted).

```ts
export const LEVERAGE_FALLBACK = { min: 1, max: 20 } // named fallback, referenced everywhere — not a loose literal
const isValidLevel = (v?: number | null): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
export const resolveLeverageBounds = (dto?: { min?: number; max?: number } | null) => {
  const min = isValidLevel(dto?.min) ? dto.min : LEVERAGE_FALLBACK.min
  const max = isValidLevel(dto?.max) ? dto.max : LEVERAGE_FALLBACK.max
  return min >= max ? LEVERAGE_FALLBACK : { min, max } // any inconsistent pair → whole fallback, never a broken range
}
```
