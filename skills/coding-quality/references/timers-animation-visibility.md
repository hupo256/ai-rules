# Page Visibility For Timers And Animation

Carousels, marquees, tickers, countdowns, long animations, and `requestAnimationFrame` loops must handle Page Visibility:

- Pause timers/animation/rAF while the tab is hidden.
- On visibility restore, normalize the current position/time before resuming so the UI does not jump through missed frames.
- Combine hover/focus pause with visibility pause through a single `shouldPlay`-style decision; any pause source stops playback.
- Infinite loops must handle loop boundaries themselves and cannot rely on `transitionend` or `animationiteration` firing while the tab is hidden.
