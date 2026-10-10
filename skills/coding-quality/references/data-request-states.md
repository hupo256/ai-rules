# Data Requests Need Visible States

Every request-driven UI must account for these states:

- Initial load: skeleton/loading plus a visible error state and retry path.
- Local refresh: local loading that does not block the whole page.
- Mutation: the triggering control is disabled/loading, and failed mutation does not optimistically become success unless the product explicitly requires optimistic UI.
- Refresh failure with existing data: keep old data visible and show a toast, inline error, or other scoped degradation.
- Empty, error, unauthorized, and unauthenticated states: each has explicit UI instead of a blank surface.
