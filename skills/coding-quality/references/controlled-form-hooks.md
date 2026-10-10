# Controlled Form / Params Hook State

Trigger: you are writing a `useXxxForm` / `useXxxParams` hook that owns controlled inputs, backfills from a server edit-state (e.g. an edit/回填 payload), and assembles a submit payload. These three habits keep such hooks correct and cheap for consumers.

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
