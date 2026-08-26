import { expect, Page, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RSO_AGREEMENT_PDF = path.resolve(__dirname, '../public/forms/rso-agreement.pdf');
const W9_PDF = path.resolve(__dirname, '../public/forms/w9.pdf');

// See docs/BUSINESS_RULES.md#payment-status-lifecycle. Payment Request /
// Reimbursement / NU-Employee / reload amounts are deliberately deferred --
// they shouldn't hit the budget line's balance until they reach Paid, since
// the money hasn't actually gone out while still Pending or Approved.
// BUSINESS_RULES.md's own historical note describes this exact rule having
// broken in production before (every transaction counted immediately
// regardless of status), so it's worth verifying against the real
// update_payment_status_with_audit function rather than trusting a mock.

const budgetLineBalance = async (page: Page, line: string): Promise<number> => {
  const card = page.locator('.wl-budget-card-optionB', { hasText: line });
  const text = await card.locator('.wl-budget-card-optionB-balance').innerText();
  return parseFloat(text.replace(/[$,]/g, ''));
};

test('a Payment Request only affects its budget line balance once Paid, not before', async ({
  page,
}) => {
  const title = `E2E Payment Status ${Date.now()}`;
  const amount = 77.5;

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: '+ Add Transaction' })).toBeVisible();
  const startingBalance = await budgetLineBalance(page, 'ASG');

  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Transaction Type/).selectOption('Payment Request');
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill(String(amount));
  // Default funding is ASG -- no need to change it. Real documents attached
  // (rather than acknowledged missing, as missing-documents.spec.ts uses)
  // since this test needs the Approved/Paid transition to actually succeed
  // -- update_payment_status_with_audit blocks it otherwise.
  await dialog.getByLabel('RSO Agreement').setInputFiles(RSO_AGREEMENT_PDF);
  await dialog.getByLabel('W-9').setInputFiles(W9_PDF);
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row.getByLabel('Payment status')).toHaveValue('Pending');
  await expect.poll(() => budgetLineBalance(page, 'ASG')).toBe(startingBalance);

  await row.getByLabel('Payment status').selectOption('Approved');
  await expect(row.getByLabel('Payment status')).toHaveValue('Approved');
  await expect.poll(() => budgetLineBalance(page, 'ASG')).toBe(startingBalance);

  await row.getByLabel('Payment status').selectOption('Paid');
  await expect(row.getByLabel('Payment status')).toHaveValue('Paid');
  await expect
    .poll(() => budgetLineBalance(page, 'ASG'))
    .toBeCloseTo(startingBalance - amount, 2);
});

test('a Debit Card purchase affects its budget line balance immediately', async ({
  page,
}) => {
  const title = `E2E Debit Immediate ${Date.now()}`;
  const amount = 12.25;

  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: '+ Add Transaction' })).toBeVisible();
  const startingBalance = await budgetLineBalance(page, 'Debit Card');

  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');
  // Debit Card is the default selected type.
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill(String(amount));
  await dialog.getByText("I don't have a receipt").click();
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(() => budgetLineBalance(page, 'Debit Card'))
    .toBeCloseTo(startingBalance - amount, 2);
});
