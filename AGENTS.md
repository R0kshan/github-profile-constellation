# AGENTS.md — github-profile-constellation

## What this project does
Generates animated SVG "constellation" badges for GitHub user profiles, visualizing repos as interconnected nodes in a starfield. Deployed as a Vercel Serverless Function.

## Architecture (single data flow)

```
Request → api/index.ts (auth/validate/caching) → lib/generateConstellation.ts (6 parallel GitHub API fetches → SVG string generation)
```

### Key files
- **`api/index.ts`** — Vercel handler. Validates `username` + optional `terminalColor`, applies input constraints, sets cache header (`public, max-age=3600`).
- **`lib/generateConstellation.ts`** — Everything: fetches GitHub user/repos/events/gists/starred + linguist languages DB, computes deterministic SVG layout via seeded PRNG, assembles the full SVG template string. ~325 lines, monolithic function.

### How constellation nodes are computed
Each repo becomes a `<circle>` node positioned around a radial spiral (not a simple circle — uses per-repo `seedrandom` for **deterministic but varied** radius via `repo.size`, `repo.id`, etc). Nodes connected by minimal spanning tree using Euclidean distance with a 35% canvas-width threshold. Twinkling animation durations are randomized based on stargazer count and deterministic hash.

## Commands

```bash
npm install             # install deps (Vercel deployment target)
```

There is no local dev server, test framework, or local lint config. Run the function by deploying to Vercel or using `vercel dev`.

### Lint (matches CI in `.github/workflows/lint.yml`)
```bash
./node_modules/.bin/eslint lib/generateConstellation.ts \
  --no-eslintrc \
  --env browser \
  --env es2022 \
  --parser @typescript-eslint/parser \
  --parser-options '{"ecmaVersion": 2022, "sourceType": "module"}' \
  --rule '{"no-undef": "off", "no-unused-vars": "warn"}'
```

## Coding conventions

- **TypeScript** with no `tsconfig.json` — compiler assumes default settings. Use ES modules (`import`/`export`).
- Exports: named only (`export { generateConstellation }`). No default exports from source files.
- Input validation in `api/index.ts`: username `/^[a-zA-Z0-9-]{1,39}$/`, color `/^#[0-9a-fA-F]{3,6}$/`. URL-encoded `#` must be unquoted: `.replace(/^%23/, '#')`.
- SVG output: string template concatenation (not a library). Color interpolation and glow filters use inline FE composite SVG elements.
- All GitHub API calls batched in a single `Promise.all`; linguist languages DB fetched from raw GitHub to avoid maintaining a local dump.

## Gotchas & non-obvious details

1. **No tsconfig.json, no eslint config, no tests.** Everything runs on Vercel's Node runtime. Don't add a build step — it's not needed for serverless deployment.

2. **The `generateConstellation` function is pure except for the `GITHUB_TOKEN` env var** (used in the Authorization header for rate limiting). To test locally, set `GITHUB_TOKEN`.

3. **Linguist colors** are fetched live from `github/linguist/master/lib/linguist/languages.yml`. New languages won't appear until this fetch runs again — not a bug, just how it works. Hardcoded fallback is `"Python"`.

4. **Deterministic layouts**: Every node position and animation duration uses `seedrandom` with specific string seeds. Changing any part of the seed formula will shift all positions for a given user — intentional for consistent per-user profiles but surprising if debugging layout issues.

5. **`constellationNodesCount = repos.length`** is checked in `api/index.ts` validation but also used as padding when `repos` is empty (`Array(constellationNodesCount).fill({})`). The API can still generate output with an empty repo list.

6. **Background starfield** uses `randNumGen()` seeded from `userName + yearsActive` — so every user gets a unique consistent background pattern, not truly random stars.

7. **No caching on the library side** beyond the response header. Each request recomputes everything from scratch (6 API calls + full SVG generation).
