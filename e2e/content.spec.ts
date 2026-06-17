import { expect, test } from '@playwright/test';

// The blog index renders even with no API reachable (it degrades to an empty
// list), so this smoke test runs against the web server alone.
test('the blog index renders', async ({ page }) => {
  await page.goto('/blog');
  await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
});

test('the home page links to the blog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Blog' })).toBeVisible();
});
