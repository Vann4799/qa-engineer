import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'

// Tag titles so CI can run subsets: --grep @smoke, --grep @regression, --grep @P0
test.describe('Login @smoke', () => {
  test('valid credentials reach the dashboard @P0', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(process.env.QA_EMAIL!, process.env.QA_PW!)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('invalid password shows an error, stays on login @P1', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.signIn(process.env.QA_EMAIL!, 'wrong-password')

    await expect(login.errorBanner).toBeVisible()
    await expect(login.errorBanner).toContainText(/invalid|incorrect/i)
    await expect(page).toHaveURL(/\/login/)
  })

  test('empty submit is blocked by client validation @P2', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.submit()

    await expect(login.emailInput).toHaveAttribute('aria-invalid', 'true')
  })
})

// ---- Page Object Model -------------------------------------------------
// Keep selectors in one place; prefer data-testid and ARIA roles over CSS/XPath.
export class LoginPage {
  constructor(private page: import('@playwright/test').Page) {}
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
  async submit() {
    await this.submitButton.click()
  }
}
