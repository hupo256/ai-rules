# Controlled Form / Params Hook State

Trigger: you are writing a `useXxxForm` / `useXxxParams` hook that owns controlled inputs, backfills from a server edit-state (e.g. an edit/回填 payload), and assembles a submit payload. These habits keep such hooks correct and cheap for consumers.

- **Backfill only when the source identity changes, not on every render.** Resetting controlled state from the server edit-state on each render clobbers in-flight user edits whenever an unrelated re-render happens (a sibling count refresh, a parent state change). Compute a stable signature of the backfill source and compare it against a ref; only reset when it actually changed.

  ```ts
  const signature = [editState?.marginMode, editState?.leverageMode, editState?.leverage].join('|')
  const signatureRef = useRef(signature)
  useEffect(() => {
    if (signatureRef.current === signature) return // unrelated re-render — keep in-flight edits
    signatureRef.current = signature
    setValue(resolveInitial(editState))
  }, [editState, signature])
  ```

- **Separate the in-flight value from the committed value.** Let typing write the raw string unclamped — intermediate states (empty, out-of-range, a lone `.`) are legal mid-edit. Clamp/normalize only on blur or submit via a `commit*` action, and return whether clamping occurred (and the clamped value) so the caller can toast and the confirm modal can read the same committed value. Clamping on every keystroke fights the user.

- **Memoize the whole hook return object.** After memoizing each field and action, wrap the returned object in `useMemo` as well. Consumers routinely drop the hook result into a dependency array or pass it as a prop; a fresh object every render defeats their downstream memoization and re-fires their effects.

- **Unknown is not unset: never submit a default while the server value is still loading or failed.** A product default ("auto-subscribe on by default") applies only when the server says the value was never set. While the setting query is pending or errored the true value is unknown, so displaying the default is fine but sending it with a write is not — it can silently re-enable something the user turned off (worst for money/permission flags). Expose a `ready` flag (query succeeded, or the field does not apply) and gate both the toggle and the submit on it; on error, keep them disabled or offer retry rather than falling back to the default (PR-01507: auto-subscribe flag sent as `1` when the setting read failed).

  ```ts
  const ready = !applies || settingQuery.isSuccess // pending/error = unknown, not "never set"
  const checked = (pendingFlag ?? settingQuery.data ?? DEFAULT_ON) === 1 // display only
  const canSubmit = ready && validationPassed
  ```

