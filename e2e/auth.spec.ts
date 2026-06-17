import { expect, test } from '@playwright/test';

test('the sign-in page renders the credentials form', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('the home page links to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});
