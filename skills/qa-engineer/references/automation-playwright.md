# Automation — Playwright + TypeScript

Promote stable, high-value manual cases into a headless suite that runs in CI.
Scaffold with `node scripts/scaffold_playwright.mjs <target-dir>`; write specs
from `assets/playwright-spec.template.ts`.

## Project shape

```
e2e/
├── playwright.config.ts     — projects, webServer, retries, reporter
├── pages/                   — Page Object Models
│   └── LoginPage.ts
├── fixtures/                — auth storageState, seed helpers
└── specs/
    └── login.spec.ts
```

On Windows use **pnpm**, not npm (Defender breaks npm here). TypeScript scripts
run through `tsx` (`.mts` for ESM). Playwright downloads its own Chromium; if that
fails, fall back to the system Chrome channel (`channel: 'chrome'`).

## Selector discipline

Prefer, in order: `getByTestId` (stable, owned by the app) → `getByRole` (accessible,
semantic) → `getByLabel`/`getByText` → CSS. Avoid brittle XPath, nth-child, and
generated class hashes. Ask the team to add `data-testid` where a stable hook is
missing rather than coupling to layout.

```ts
await page.getByTestId('login-email').fill(email)
await page.getByRole('button', { name: /sign in/i }).click()
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
```

## No flake

- Never `page.waitForTimeout(n)`. Use auto-waiting locators and
  `await expect(locator).toBeVisible()` / `waitForResponse` / `waitForURL`.
- Keep tests independent — no shared mutable state between specs.
- Isolate the network: `page.route()` to stub slow/flaky third parties, or hit a
  seeded test backend.
- Run in parallel (`fullyParallel: true`, `workers` from CI), so a hidden ordering
  dependency surfaces immediately.
- In CI set `retries: 2` and treat a retry-pass as a flake to fix, not a win.

## Authentication reuse

Log in once, save `storageState`, reuse it — do not re-login in every spec:

```ts
// global-setup.ts — write fixtures/auth.json once
const ctx = await browser.newContext()
const page = await ctx.newPage()
await page.goto(`${BASE}/login`)
await page.getByTestId('login-email').fill(process.env.QA_EMAIL!)
await page.getByTestId('login-password').fill(process.env.QA_PW!)
await page.getByRole('button', { name: /sign in/i }).click()
await page.waitForURL('**/dashboard')
await ctx.storageState({ path: 'fixtures/auth.json' })
await ctx.close()
```

Reference it in the config project (`storageState: 'fixtures/auth.json'`). Secrets
come from env vars — never committed, never in the report.

## API + DB in the same suite

- Seed/clean via `request` fixtures (`playwright.config` `use.request`) or an
  API context hitting the backend directly — faster and more reliable than UI
  clicks for setup.
- Verify persisted data through the API response, not the DB, unless the test is
  specifically about DB state (then see `references/database-testing.md`).

## Config essentials (CI-safe)

```ts
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.BASE_URL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

`trace` + `screenshot: 'only-on-failure'` give CI evidence without paying for it on
green runs. Upload the `playwright-report/` and traces as CI artifacts (see
`references/cicd-github-actions.md`).

## Run

```bash
pnpm exec playwright test                     # all
pnpm exec playwright test specs/login.spec.ts # one file
pnpm exec playwright test --grep @smoke       # tagged subset
pnpm exec playwright show-report              # open last HTML report
```

Tag tests (`@smoke`, `@regression`, `@P0`) in the title so CI can run the smoke
subset on every push and the full regression nightly.

## Report

Summarise from the run: `{ total, passed, failed, flaky, duration }` and the names
of the failed specs with the assertion that broke. Each genuine failure becomes a
bug report with the trace/screenshot as evidence.
