# Contributing

First, open an issue to discuss changes before investing time in PR.

## Getting started

**Prerequisites:** Node.js 22+, npm

```bash
git clone https://github.com/R0kshan/github-profile-constellation.git
cd github-profile-constellation
npm install
```

### Local development with Vercel

```bash
npm i -g vercel
vercel dev --debug
```

The function will be available at `http://localhost:3000`.

## Testing

### Available scripts

| Command | Description |
|---|---|
| `npm run typecheck` | TypeScript strict type checking (`tsc --noEmit`) |
| `npm run lint` | ESLint on `api/` and `lib/` |
| `npm test` | Vitest snapshot test |
| `npm run check` | Fast prereq: typecheck + lint |

At the moment, this project uses a single snapshot test via Vitest.

- **Mocked time:** `Date.now()` is frozen to `1725000000000` using `vi.useFakeTimers()`.
- **Mocked fetch:** All GitHub API and Linguist YAML requests are mocked
- **Fixtures:** Stored in `lib/__tests__/__fixtures__/`
- **Golden file:** `expected.svg` in the fixtures directory.

When you change the SVG template, update the snapshot:

```bash
npm test -- --update
```
Commit the updated `expected.svg` alongside your changes.

## Deployment

The project deploys to Vercel automatically on push.
