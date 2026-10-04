#!/usr/bin/env node
// scaffold_playwright.mjs — generate a Playwright + TypeScript e2e project skeleton.
// Usage:
//   node scaffold_playwright.mjs <target-dir> [--force]
// Writes playwright.config.ts, package.json, tsconfig.json, .gitignore, a sample
// spec and a Page Object. Refuses to overwrite existing files unless --force.
// Dependency-free (Node >= 18). Uses pnpm in the printed next steps (npm is
// unreliable on Windows/Defender here).
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const force = argv.includes('--force')
const target = argv.find((a) => !a.startsWith('--'))

if (!target) {
  console.log('usage: node scaffold_playwright.mjs <target-dir> [--force]')
  process.exit(2)
}

const root = resolve(target)

const files = {
  'package.json': `{
  "name": "e2e",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
`,
  'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "@playwright/test"]
  },
  "include": ["**/*.ts"]
}
`,
  'playwright.config.ts': `import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Start the app under test automatically. Adjust the command to the repo.
  webServer: {
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
`,
  'pages/LoginPage.ts': `import { expect, type Page } from '@playwright/test'

// Prefer data-testid and ARIA roles over brittle CSS/XPath.
export class LoginPage {
  constructor(private page: Page) {}
  readonly emailInput = this.page.getByTestId('login-email')
  readonly passwordInput = this.page.getByTestId('login-password')
  readonly submitButton = this.page.getByRole('button', { name: /sign in/i })
  readonly errorBanner = this.page.getByRole('alert')

  async goto() {
    await this.page.goto('/login')
    await expect(this.emailInput).toBeVisible()
  }
  async signIn(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
`,
  'specs/login.spec.ts': `import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'

test.describe('Login @smoke', () => {
  test('valid credentials reach the dashboard @P0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(process.env.QA_EMAIL!, process.env.QA_PW!)
    await expect(page).toHaveURL(/\\/dashboard/)
  })

  test('invalid password stays on login with an error @P1', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(process.env.QA_EMAIL!, 'wrong')
    await expect(login.errorBanner).toBeVisible()
    await expect(page).toHaveURL(/\\/login/)
  })
})
`,
  '.gitignore': `node_modules/
test-results/
playwright-report/
blob-report/
playwright/.cache/
fixtures/auth.json
*.local
.env
`,
}

if (existsSync(root) && readdirSync(root).length && !force) {
  const conflict = Object.keys(files).find((f) => existsSync(join(root, f)))
  if (conflict) {
    console.log(`ERROR  ${root} already contains ${conflict}. Re-run with --force to overwrite, or pick an empty dir.`)
    process.exit(1)
  }
}

let written = 0
for (const [rel, contents] of Object.entries(files)) {
  const path = join(root, rel)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, contents, 'utf8')
  console.log(`wrote  ${rel}`)
  written++
}

console.log(`\nScaffolded ${written} files in ${root}`)
console.log('Next:')
console.log('  cd ' + root)
console.log('  pnpm install')
console.log('  pnpm exec playwright install --with-deps chromium')
console.log('  # set BASE_URL, QA_EMAIL, QA_PW env vars, then:')
console.log('  pnpm test')
console.log('Then copy assets/qa-ci.yml into the repo .github/workflows/ and adapt.')
