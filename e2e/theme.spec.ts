import { expect, test } from '@playwright/test';

// The public site renders *through* the active theme. With no API reachable the
// theme resolver degrades to the default (editorial) theme, so this runs against
// the web server alone. The full admin → public switch is exercised in live
// verification against a real API + Postgres.
test('the home page renders through the theme system (default editorial)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-public-theme="editorial"]')).toBeVisible();
  await expect(page.getByText('Editorial theme')).toBeVisible();
});

test('the blog index renders inside the active theme chrome', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.locator('[data-public-theme="editorial"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
});
