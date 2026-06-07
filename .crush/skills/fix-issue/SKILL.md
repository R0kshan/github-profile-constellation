---
name: fix-issue
description: Systematic workflow for diagnosing and fixing bugs — discover code, apply targeted fix, verify via vercel dev --debug + inline SVG inspection from fetch tool.
user-invocable: true
disable-model-invocation: false
---

## Fix Issue Workflow

**Trigger:** User reports a bug, visual artifact, incorrect behavior, or asks to correct something in the codebase.

### Phase 1 — Locate (before touching anything)

1. **Read relevant source files.** For constellation rendering issues, read `lib/generateConstellation.ts`. For request/validation issues, read `api/index.ts`.
2. **Understand the data flow.** Every bug starts with: where does the output originate? In this project it's always `generateConstellation()` returning a raw SVG string.
3. **No build step, no test framework** — use `vercel dev --debug` for local serving and the `fetch` tool to inspect produced SVG directly from the response body.

### Phase 2 — Diagnose

1. **Check what the SVG should look like vs. what the code produces.** If visual: trace rendering logic back to its source (SVG element attributes, filters, positioning).
2. **Look for common SVG compositing gotchas:**
   - `filter` on elements with small bounding boxes gets clipped → wrap in a `<g>` or give larger dimensions
   - `feGaussianBlur` / `feComposite` filter bounds: check `x/y/width/height` attributes on filter definitions in `<defs>`
3. **Read the exact line numbers** and surrounding SVG template string — whitespace matters inside template literals.

### Phase 3 — Fix

1. Apply the minimal change that addresses only the root cause. No refactors, no style changes, no "while I'm here" edits.
2. Prefer wrapping elements in a `<g>` over adding extra SVG filters or padding.
3. Verify the fix by diffing before committing mentally: does this actually change what you intended?

### Phase 4 — Verify (mandatory, repeat until confirmed)

1. **Start vercel dev in background:**
   ```bash
   npx vercel dev --debug &
   sleep 5
   ```
2. **Fetch the SVG via `fetch` tool** (curl is banned):
   ```
   fetch → url=http://localhost:3000?username=R0kshan, format=text
   ```
3. **Inspect the output directly in the conversation.** For structural checks, diff against expected SVG elements (e.g., verify all 3 `<line>` elements appear inside a single `<g filter="url(#softGlow)">` wrapper).

4. **If still broken:** go back to Phase 2, read more context (e.g., the full SVG definition of the problematic filter in `<defs>`), identify the true root cause, re-fix. Loop until verified.

### Gotchas

- SVG elements with `filter` must have a bounding box large enough for the blur radius, or the glow clips to their own bounds
- Template literal whitespace is preserved — indentation inside `` ` `` blocks adds to the final SVG
- The project has **no tsconfig.json**, **no eslint config**, and **no test framework** — verify by inspection of rendered output only
- `curl` is banned for HTTP requests — always use the `fetch` tool with `format='text'` to inspect responses
