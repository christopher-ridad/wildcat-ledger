import { expect, test } from '@playwright/test';

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
