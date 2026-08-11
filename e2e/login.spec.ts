import { expect, test } from '@playwright/test';

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'WildcatLedger' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible();
});
