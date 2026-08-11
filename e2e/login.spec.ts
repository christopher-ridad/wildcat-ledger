import { expect, test } from '@playwright/test';

// DEMO: this assertion is deliberately wrong (real heading is "WildcatLedger")
// so the Dev job's e2e step visibly fails on the PR. Fix the expected text
// once you've seen it go red, then this becomes a real smoke test.
test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Totally Wrong Title' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send me a link' })).toBeVisible();
});
