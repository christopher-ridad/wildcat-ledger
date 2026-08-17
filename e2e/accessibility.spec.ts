import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Static linting (eslint-plugin-jsx-a11y) already catches JSX-detectable
// issues (missing labels, invalid ARIA, etc.) and is clean. axe-core scans
// the actually-rendered DOM instead, which catches what static analysis
// can't -- color contrast, focus order, live-region/ARIA-state correctness.

test('dashboard has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: '+ Add Transaction' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('organizations page has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/organizations');
  await expect(page.getByText('E2E Test Org')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the Add Transaction modal has no WCAG 2.0/2.1 A/AA violations', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Scope to the dialog -- the rest of the page behind it is inert while
    // it's open and irrelevant to this check.
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});
