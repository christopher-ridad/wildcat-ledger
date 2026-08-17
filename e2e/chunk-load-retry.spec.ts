import { expect, test } from '@playwright/test';

// Simulates the exact production failure this guards against: a new deploy
// changes a page's chunk filename (Vite content-hashes them), so a browser
// tab that navigates to a not-yet-visited route after that deploy gets a
// 404 for the old filename it still has in memory. lazyWithRetry.ts should
// catch that and force a one-time reload, which then succeeds since the
// reload fetches the current index.html (and therefore the current, valid
// chunk references) instead of leaving the visitor on a dead page.
test('recovers from a stale/404 chunk after a deploy by reloading once', async ({
  page,
}) => {
  let requestCount = 0;
  await page.route('**/assets/AuditLogPage-*.js', (route) => {
    requestCount++;
    // Only the first request (the "stale reference from before the deploy")
    // fails; the retried request (after lazyWithRetry's reload) succeeds
    // normally, matching how a real deploy only breaks the *old* filename.
    if (requestCount === 1) return route.abort('failed');
    return route.continue();
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Audit History' }).click();

  await expect(page.getByText('← Back to Dashboard')).toBeVisible({ timeout: 15_000 });
  expect(requestCount).toBeGreaterThanOrEqual(2);
});
