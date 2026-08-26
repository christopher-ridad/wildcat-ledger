import { expect, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// A real PDF, standing in for a signed exemption form -- content doesn't
// matter, only that it's a real file the upload actually has to move
// through Storage and back.
const SAMPLE_PDF = path.resolve(__dirname, '../public/forms/w9.pdf');

// See docs/BUSINESS_RULES.md#debit-card-reconciliation. A purchase can only
// be reconciled once "covered" (a real receipt or exemption form actually
// uploaded to Storage -- not just a client-side flag), and once reconciled
// it's permanently locked, enforced by reconcile_transactions_with_audit
// itself rather than the interface hiding the buttons.
test('reconciling a covered debit card purchase locks it permanently', async ({
  page,
}) => {
  const title = `E2E Reconcile ${Date.now()}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const addDialog = page.getByRole('dialog');
  await addDialog.getByLabel(/^Title/).fill(title);
  await addDialog.getByLabel(/^Amount/).fill('18.00');
  // Debit Card is the default type -- leave it unset.
  await addDialog.getByText("I don't have a receipt").click();
  await addDialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(addDialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row.getByText('Not Reconciled')).toBeVisible();

  await page.getByRole('button', { name: 'Reconcile Debit Card' }).click();
  const reconDialog = page.getByRole('dialog');

  // Not covered yet -- Confirm & Reconcile is blocked entirely until every
  // listed transaction has a receipt or exemption form, not just this one
  // (see docs/BUSINESS_RULES.md#debit-card-reconciliation). Other specs
  // sharing this seeded org can leave their own uncovered debit card
  // transactions behind, which would block this test too if only this
  // item got covered -- so cover every uncovered item currently listed.
  // The file input is always present once an item is missing its receipt
  // (the visible button just programmatically clicks it), so upload
  // directly to each one rather than clicking through the button first.
  await expect(
    reconDialog.getByRole('button', { name: /Confirm & Reconcile/ }),
  ).toBeDisabled();

  const fileInputs = await reconDialog.locator('input[type="file"]').all();
  for (const input of fileInputs) {
    await input.setInputFiles(SAMPLE_PDF);
  }
  await expect(
    reconDialog.getByRole('button', { name: '↑ Attach Completed Exemption Form' }),
  ).toHaveCount(0);

  const confirmButton = reconDialog.getByRole('button', { name: /Confirm & Reconcile/ });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(reconDialog.getByText('Reconciliation complete!')).toBeVisible();
  await reconDialog.getByRole('button', { name: 'Done' }).click();
  await expect(reconDialog).toBeHidden();

  // Locked for good: reconciled badge, no Edit/Delete actions available.
  await expect(row.getByText('Reconciled', { exact: true })).toBeVisible();
  await expect(row.getByLabel('Edit transaction')).toHaveCount(0);
  await expect(row.getByLabel('Delete transaction')).toHaveCount(0);
});
