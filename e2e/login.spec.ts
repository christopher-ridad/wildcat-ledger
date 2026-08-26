import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'WildcatLedger' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
});

test('login page has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'WildcatLedger' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
