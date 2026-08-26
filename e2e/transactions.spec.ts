import { expect, test } from '@playwright/test';

test('create a Debit Card transaction without a receipt, acknowledging it', async ({
  page,
}) => {
  const title = `E2E Debit Card ${Date.now()}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill('12.50');
  // Debit Card is the default selected type -- no need to change it.
  await dialog.getByText("I don't have a receipt").click();
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();

  // The modal closes on success and the new row appears in the table.
  await expect(dialog).toBeHidden();
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await expect(row.getByText('-$12.50')).toBeVisible();
});

test('create a Payment Request', async ({ page }) => {
  const title = `E2E Payment Request ${Date.now()}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel(/Transaction Type/).selectOption('Payment Request');
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill('200');
  await dialog.locator('input[name="contractAcknowledgedMissing"]').check();
  await dialog.locator('input[name="w9AcknowledgedMissing"]').check();
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();

  await expect(dialog).toBeHidden();
  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row).toBeVisible();
  await expect(
    row.getByRole('cell', { name: 'Payment Request', exact: true }),
  ).toBeVisible();
});

test('a Payment Request missing its documents is flagged and blocked from Approved', async ({
  page,
}) => {
  const title = `E2E Missing Docs ${Date.now()}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel(/Transaction Type/).selectOption('Payment Request');
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill('200');
  await dialog.locator('input[name="contractAcknowledgedMissing"]').check();
  await dialog.locator('input[name="w9AcknowledgedMissing"]').check();
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row.getByText('⚠ Missing: RSO Agreement, W-9')).toBeVisible();

  // Missing required documents block the Approved/Paid transition
  // (update_payment_status_with_audit's document-completeness gate).
  await row.getByLabel('Payment status').selectOption('Approved');
  await expect(row.getByRole('alert')).toHaveText(
    /Cannot mark as Approved — missing required documents/,
  );
  // The gate rejected the change server-side, so the select reverts.
  await expect(row.getByLabel('Payment status')).toHaveValue('Pending');
});
