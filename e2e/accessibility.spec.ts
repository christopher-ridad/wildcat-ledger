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

test('the audit log page has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/audit-log');
  await expect(page.getByText('← Back to Dashboard')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the Reconcile Debit Card modal has no WCAG 2.0/2.1 A/AA violations', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Reconcile Debit Card' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the SOFO / CO Settings modal has no WCAG 2.0/2.1 A/AA violations', async ({
  page,
}) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'SOFO / CO Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the edit-transaction modal has no WCAG 2.0/2.1 A/AA violations', async ({
  page,
}) => {
  const title = `E2E A11y Edit ${Date.now()}`;
  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel(/^Title/).fill(title);
  await createDialog.getByLabel(/^Amount/).fill('10');
  await createDialog.getByText("I don't have a receipt").click();
  await createDialog
    .getByRole('button', { name: 'Add Transaction', exact: true })
    .click();
  await expect(createDialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('Edit transaction').click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the Financial Tasks page has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { name: 'Financial Tasks' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the Add Task modal has no WCAG 2.0/2.1 A/AA violations', async ({ page }) => {
  await page.goto('/timeline');
  await page.getByRole('button', { name: '+ Add Task' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test('the transaction files modal has no WCAG 2.0/2.1 A/AA violations', async ({
  page,
}) => {
  const title = `E2E A11y Files ${Date.now()}`;
  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel(/Transaction Type/).selectOption('Payment Request');
  await createDialog.getByLabel(/^Title/).fill(title);
  await createDialog.getByLabel(/^Amount/).fill('200');
  await createDialog.locator('input[name="contractAcknowledgedMissing"]').check();
  await createDialog.locator('input[name="w9AcknowledgedMissing"]').check();
  await createDialog
    .getByRole('button', { name: 'Add Transaction', exact: true })
    .click();
  await expect(createDialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('View missing documents').click();
  const filesDialog = page.getByRole('dialog');
  await expect(filesDialog).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .include('[role="dialog"]')
    .analyze();

  expect(results.violations).toEqual([]);
});
