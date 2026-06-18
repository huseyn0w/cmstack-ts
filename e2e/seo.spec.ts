import { expect, test } from '@playwright/test';

// These SEO surfaces render even with the API unreachable (they degrade to a
// safe fallback), so they run against the web server alone.

test('robots.txt advertises the sitemap', async ({ page }) => {
  const res = await page.goto('/robots.txt');
  expect(res?.ok()).toBe(true);
  const body = await page.textContent('body');
  expect(body).toContain('Sitemap:');
});

test('llms.txt is served as a GEO feed', async ({ page }) => {
  const res = await page.goto('/llms.txt');
  expect(res?.ok()).toBe(true);
  const body = await page.textContent('body');
  expect(body).toContain('# Typress');
});

test('the services page renders inside the active theme', async ({ page }) => {
  await page.goto('/services');
  await expect(page.locator('[data-public-theme]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
});
