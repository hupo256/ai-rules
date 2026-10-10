# Styling And Visual QA

- Prefer existing design tokens, theme variables, Tailwind preset classes, and shared style utilities before arbitrary values.
- Do not add `.scss` or `.less` for one-off page styling when the surrounding code uses Tailwind/token patterns.
- For UI changes, check desktop, 390px mobile, dark and light themes when applicable, plus core CTA, modal/bottom sheet, empty, error, loading, disabled, unauthenticated, and unauthorized states.
- If a project defaults to dark theme, verify first load after clearing preference and verify that switching to light persists.
- For Figma-derived UI, compare layout, spacing, radius, typography, color, icons, state variants, and mobile behavior; screenshots can help, but the final evidence should name pass/fail modules and deviations.
