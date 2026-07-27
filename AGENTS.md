# AGENTS.md — github-profile-constellation

## What this project does
Generates animated SVG "constellation" badges for GitHub user profiles, visualizing repos as interconnected nodes in a starfield. Deployed as a Vercel Serverless Function.

## Architecture (single data flow)

```
Request → api/index.ts (validate) → lib/generateConstellation.ts
             4 parallel fetches (user, repos, starred 1st page, Linguist YAML)
                 → paginated starred via fetchStarredPages()
                 → deterministic SVG layout via seedrandom
                 → SVG string → response
```

### Key files
- **`api/index.ts`** — Vercel handler. Validates `username` + optional `terminalColor`, applies input regex, sets cache header (`public, max-age=3600`).
- **`lib/generateConstellation.ts`** — Core logic: 4 parallel fetches, paginated starred helper, language counting, MST layout, SVG template assembly.
- **`lib/types/`** — Per-interface type files (`GitHubUser`, `GitHubRepo`, `LinguistEntry`, `ConstellationNode`).
- **`lib/__tests__/`** — Snapshot test with frozen `Date.now` and mocked GitHub/linguist API responses.
- **`lib/package.json`** / **`api/package.json`** — Each contains `{ "type": "module" }` so Vercel Lambda recognizes compiled `.js` as ESM at runtime.
- **`tsconfig.json`** — TypeScript strict mode, `noEmit: true` (Vercel handles compilation via `@vercel/node@^3.0.0`).
- **`.github/workflows/code-quality.yml`** — Runs `typecheck`, `lint`, and `test` on push/PR to main, feature/*, fix/*, chore/*.
- **`.github/workflows/security.yml`** — Runs zizmor (GitHub Actions security audit), dependency-review (checks new/updated deps for vulnerabilities), and CodeQL (JS/TS vulnerability analysis) on push/PR.
- **`.github/dependabot.yml`** — Weekly automated PRs for npm and GitHub Actions dependency updates.
- **`vercel.json`** — URL rewrite: `/` → `/api/index`.
- **`.eslintrc.json`** — `no-unused-vars: warn`, `no-undef: off` (TypeScript handles types).
- **`.gitattributes`** — `* text=auto eol=lf` to prevent cross-OS diff noise.

### How constellation nodes are computed
Each repo becomes a `<circle>` node positioned around a radial spiral (not a simple circle — uses per-repo `seedrandom` for **deterministic but varied** radius via `repo.size`, `repo.id`, `repo.created_at`, `repo.node_id`). Nodes connected by minimal spanning tree (Prim's algorithm via `flatMap` + `reduce`) using Euclidean distance with a 35% canvas-width threshold. Twinkling animation durations are randomized based on stargazer count and `randNumGen()`.

## Commands

```bash
npm install             # install all deps (Node.js 22+)
npm run typecheck       # tsc --noEmit (strict mode)
npm run lint            # ESLint on api/ and lib/
npm test                # vitest snapshot test
npm run check           # typecheck + lint (fast prereq check)
```

Run the function locally via `vercel dev --debug` or deploy to Vercel.

## Coding conventions

- **TypeScript** with strict mode (`tsconfig.json`). Use ES modules (`import`/`export`).
- **Import `.js` extension** for all relative imports — this matches the ESM spec and the compiled output (TypeScript resolves `.js` → `.mts`/`.ts` at compile time).
- **`import type`** for type-only imports (`import type { GitHubUser } from './types/GitHubUser.js'`).
- **Interfaces** live in `lib/types/`, one file per interface, `export interface` declared inline.
- **Exports**: named only (`export { generateConstellation }`). No default exports from source files.
- **No nested if/for** — prefer early returns, `.filter().forEach()`, `flatMap` + `reduce`.
- **Input validation** in `api/index.ts`: username `/^[a-zA-Z0-9-]{1,39}$/`, color `/^#[0-9a-fA-F]{3,6}$/`. URL-encoded `#` must be unquoted: `.replace(/^%23/, '#')`.
- **SVG output**: string template concatenation (not a library). Color interpolation and glow filters use inline FE composite SVG elements.
- **Terminal text rendered twice**: once with `neonTextGlow` filter, once without — for readability on all backgrounds.
- **User, repos, starred (first page), and linguist fetches** batched in a single `Promise.all`; starred pagination runs via the extracted `fetchStarredPages()` helper. Essential APIs (`user`, `repos`, `linguist`) validated with `res.ok` throws; starred endpoint failure degrades gracefully to empty array.
- **Avoid bare `process.env` access** outside `generateConstellation` — `GITHUB_TOKEN` is read once at the top of the fetch block and passed as `fetchInit`.

## Gotchas & non-obvious details

1. **No build step.** Everything runs on Vercel's Node runtime. `tsconfig.json` uses `noEmit: true` — don't add a build step. Vercel compiles via `@vercel/node@^3.0.0`. **Do not upgrade to v5** — v5 preserves ESM `import` syntax but Vercel's Lambda bundle strips the root `"type": "module"`, causing `SyntaxError: Cannot use import statement outside a module`.

2. **ESM module type via per-directory package.json.** The root `package.json` does NOT set `"type": "module"`. Instead, `api/package.json` and `lib/package.json` each contain `{ "type": "module" }`. This ensures the compiled `.js` files are treated as ESM by Node.js in Vercel's Lambda runtime, where the nearest `package.json` in the function bundle takes precedence.

3. **The `generateConstellation` function is pure except for the `GITHUB_TOKEN` env var** (used in the Authorization header for rate limiting). To test locally, set `GITHUB_TOKEN` in `.env.local`. The token is optional — `fetchInit` is `undefined` when absent, making unauthenticated requests with stricter rate limits.

4. **Linguist colors** are fetched live from `github/linguist/master/lib/linguist/languages.yml`. New languages won't appear until this fetch runs again — not a bug, just how it works. Hardcoded fallback is `"Python"`.

5. **Deterministic layouts**: Every node position and animation duration uses `seedrandom` with specific string seeds (`${userName}-${userInfo.id}`). Changing any part of the seed formula will shift all positions for a given user — intentional for consistent per-user profiles but surprising if debugging layout issues. Same seed applies to background starfield via `randNumGen()`.

6. **`constellationNodesCount = repos.length`** is used as padding when `repos` is empty (`Array(constellationNodesCount).fill({})`). The API can still generate output with an empty repo list (blank constellation with starfield only).

7. **No caching on the library side** beyond the response header (`public, max-age=3600`). Each request recomputes everything from scratch (4 fetches + paginated starred + full SVG template assembly).

8. **Snapshot test freezes `Date.now()` and mocks all fetch calls** via fixture files in `lib/__tests__/__fixtures__/`. The fixtures are anonymized from real R0kshan GitHub data. Run `npm test` after any change to the SVG template to verify the output hasn't drifted. To update the snapshot: `npm test -- --update`.

9. **`fetchStarredPages()`** is a top-level async helper, not nested inside `generateConstellation`. It uses early returns to flatten control flow: `if (!ok) return []`, `if (!nextMatch) return items`, then while-loop pagination. Pagination errors (`!res.ok`) break silently — empty starfield is preferable to a 500.

10. **Repository URL** in `package.json` was corrected from `vercel-svg-badge-example.git` to `github-profile-constellation.git`.
