---
name: figma-read
description: Figma MCP reading technique for extracting geometry, colors, borders, and radius accurately. Use before implementing UI from Figma or when reading Figma nodes to avoid missing atomic node radius, stroke, brand color, or icon details. Project-specific spec tables and gates remain in repository docs.
---

# Figma MCP Reading Technique

This skill covers how to read Figma data. Where to record specs, gate status, and project decisions belongs to the repository workflow docs.

## 0. Primary path — persist a spec with `figma-spec.mjs` first

Before hand-reading nodes via MCP, run the bundled REST reader. It logs in with a token,
reads the full detailed geometry/tokens/text, and **persists to disk** — deterministic,
cacheable, no MCP/browser/headless flakiness. Read the resulting `spec.md` before writing code.

```bash
export FIGMA_API_KEY=figd_...   # Figma PAT, scope: file_content:read (+ file_dev_resources:read)
node ~/.ai-rules/skills/figma-read/scripts/figma-spec.mjs \
  "https://www.figma.com/design/<KEY>/x?node-id=19782-4898" --out <evidence-dir>
# → <evidence-dir>/<KEY>-<node>/{spec.json, spec.md, preview-*.png}
# prints  FIGMA_SPEC_WRITTEN: <dir>   (machine-checkable proof the design was read)
```

- The node-id is parsed from the URL, or pass it explicitly as the 2nd arg.
- `spec.md` = greppable geometry tree + tokens; `spec.json` = normalized + raw (`--raw`).
- Canonical copy for the FameEX lark-bot worker is vendored at
  `~/github/lark-bot/scripts/figma-spec.mjs` (versioned); this `~/.ai-rules` copy is the
  portable one for interactive use across repos. Keep them in sync.
- The MCP calls below (§2) are the **interactive fallback** when you need to poke at a single
  node live or the token path is unavailable — not the default for "read the design and implement".

## 1. Common Failure Modes

- Reading only the parent frame and accidentally applying its radius or fill to child controls.
- Recording width and height but missing `cornerRadius`, stroke, or fill.
- Guessing from convention instead of reading the atomic control node.
- Treating a text-visible snapshot as visual acceptance without checking shape, border, color, or icon identity.

Core rule: read atomic nodes, record geometry fields, and verify shapes rather than only copy presence.

## 2. Reading Sequence

For each module, inspect interactive controls one atomic node at a time:

| Step | MCP call | Purpose |
|------|----------|---------|
| 1 | `get_metadata(nodeId)` | Child tree, dimensions, child node IDs |
| 2 | `get_design_context` per atomic control | Class hints, padding, radius, border, fill |
| 3 | `get_variable_defs` | Token definitions for colors and spacing |
| 4 | `get_screenshot` if needed | Temporary side-by-side visual aid |

If MCP output is fuzzy for radius/stroke, use the Figma plugin path when available to read `node.cornerRadius`, `width`, `height`, and `strokes` directly.

## 3. Required Geometry Fields

For buttons, icon containers, cards, and modals, capture at least:

- `nodeId`
- `width x height`
- `cornerRadius`
- `border` / `stroke`
- `fill`
- icon identity, especially for brand SVGs

Circle rule:

```text
cornerRadius >= min(width, height) / 2 -> circle / rounded-full
otherwise                              -> map the measured radius to the nearest valid token
```

Do not infer a circular button from `48 x 48` alone; read or explicitly mark the radius source.

## 4. Fallback When MCP Cannot Read A Field

Use this order and record the source at each step:

1. Retry with metadata plus plugin-derived node fields.
2. If still missing, compare with a confirmed same-design same-control node and mark `source: analogous to <nodeId>`.
3. If no reliable analogy exists, mark the geometry as `pending confirmation`, record the question, and use the closest reasonable placeholder without treating it as confirmed.

Never silently turn a guess into a confirmed spec.

## 5. Acceptance Focus

Side-by-side checks must include: circle vs rounded rectangle, border width/color, fill/token match, and whether the icon is the correct brand asset. Text presence alone is not enough.

## 6. UI Reconstruction Regression Gate

Apply this gate whenever a stakeholder reports that a Figma-based UI is visually wrong, and before claiming the correction is complete.

1. **Inventory every visible mismatch before editing.** Build a compact checklist from the screenshot and atomic nodes: modal dimensions, title typography/token, close icon, tabs (order, width, active treatment), copy hierarchy, list markers, row order, selected-state border/fill, action spacing, button geometry, and icon identity. Do not fix only the first highlighted symptom.
2. **Separate behavior authority from visual authority.** PRD controls content, ordering, defaults, and interaction; Figma controls geometry, typography, colors, borders, fills, spacing, and icons. Record any conflict explicitly instead of silently choosing one.
3. **Copy Dev Mode tokens exactly when provided.** For example, if the selected node says `text-1 font-bold text-h5`, use those local classes rather than assuming a semantically similar shared default is equivalent.
4. **Prefer feature-local overrides.** Pass a styled title node or add classes in the feature component first. Do not change a shared component's default appearance for one dialog. Extend a shared API only when no existing local route can express a required structural property, and keep that extension behavior-neutral.
5. **Re-read the extracted node after editing.** Compare implementation against the checklist line by line. In particular, verify common low-level misses: adjacent tabs accidentally stretched with `flex-1`, bullets accidentally rendered as numbers, selected rows accidentally given a brand border, rounded rectangles accidentally rendered as circles, and generic help icons substituted for the designed customer-service icon.
6. **Visual evidence is distinct from code evidence.** Typecheck, unit tests, and DOM/source contracts do not prove visual fidelity. Run a real browser screenshot or side-by-side inspection when available. If unavailable, state `visual QA not run` and do not claim pixel/Figma restoration as verified.
7. **After one visual rejection, stop incremental guessing.** Re-audit the whole component against the Figma screenshot/spec before the next edit; repeated one-symptom patches are a process failure.
