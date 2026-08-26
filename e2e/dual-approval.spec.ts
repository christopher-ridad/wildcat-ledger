import { expect, test } from '@playwright/test';

import { AUTH_STATE_PATH_2 } from './global-setup';

// See docs/BUSINESS_RULES.md#dual-approval-workflow. This is the core rule
// the app exists to enforce -- an amount/type/budget-line edit or a delete
// always needs a second SOFO Approver's sign-off, and nobody can approve
// their own request. A single-session test can only ever exercise the
// "request" half of that, so these specs open a second authenticated
// browser context (a real second approver, seeded in global-setup) to
// exercise the actual second-person enforcement, not just the UI around it.

// Non-Officer Reimbursement, deliberately -- not Debit Card. A Debit Card
// purchase left with no receipt sits in the shared seeded org forever,
// blocking reconciliation.spec.ts (ReconciliationModal hides ALL checkboxes
// while *any* unreconciled debit card transaction is uncovered, not just
// the one under test). This spec's transactions have nothing to do with
// reconciliation, so keep them off that budget line entirely.
const addTransaction = async (
  page: import('@playwright/test').Page,
  title: string,
  amount: string,
) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Transaction Type/).selectOption('Non-Officer Reimbursement');
  await dialog.getByLabel(/^Title/).fill(title);
  await dialog.getByLabel(/^Amount/).fill(amount);
  await dialog.getByLabel(/Name of Member Being Reimbursed/).fill('E2E Test Member');
  await dialog.getByLabel(/Zelle Email or Phone Number/).fill('e2e-member@example.com');
  await dialog.getByText("I don't have a receipt yet").click();
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toBeHidden();
};

test('a second approver can approve a pending amount edit', async ({ page, browser }) => {
  const title = `E2E Dual Approval Edit ${Date.now()}`;
  await addTransaction(page, title, '10.00');

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('Edit transaction').click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel(/^Amount/).fill('25.00');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();

  // The requester sees the change is pending, not yet applied, and can't
  // approve their own request (no Approve/Reject shown to them).
  await expect(row.getByText('Edit Requested')).toBeVisible();
  await expect(row.getByText('Awaiting Approval')).toBeVisible();
  await expect(row.getByText('-$10.00')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);

  // A second approver, in a separate session, can see and act on it.
  const contextB = await browser.newContext({ storageState: AUTH_STATE_PATH_2 });
  const pageB = await contextB.newPage();
  await pageB.goto('/dashboard');
  const rowB = pageB.getByRole('row', { name: new RegExp(title) });
  await rowB.getByRole('button', { name: 'View details' }).click();
  await expect(pageB.getByText('Before')).toBeVisible();
  await expect(pageB.getByText('After')).toBeVisible();
  await rowB.getByRole('button', { name: 'Approve' }).click();

  await expect(rowB.getByText('-$25.00')).toBeVisible();
  await expect(rowB.getByText('Edit Requested')).not.toBeVisible();
  await contextB.close();

  // The requester's own (still-open) session picks up the approval too.
  await expect(row.getByText('-$25.00')).toBeVisible();
});

test('a second approver can reject a pending amount edit, leaving it unchanged', async ({
  page,
  browser,
}) => {
  const title = `E2E Dual Approval Reject ${Date.now()}`;
  await addTransaction(page, title, '30.00');

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('Edit transaction').click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel(/^Amount/).fill('99.00');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();
  await expect(row.getByText('Edit Requested')).toBeVisible();

  const contextB = await browser.newContext({ storageState: AUTH_STATE_PATH_2 });
  const pageB = await contextB.newPage();
  await pageB.goto('/dashboard');
  const rowB = pageB.getByRole('row', { name: new RegExp(title) });
  await rowB.getByRole('button', { name: 'Reject' }).click();

  await expect(rowB.getByText('-$30.00')).toBeVisible();
  await expect(rowB.getByText('Edit Requested')).not.toBeVisible();
  await contextB.close();

  await expect(row.getByText('-$30.00')).toBeVisible();
  await expect(row.getByText('Edit Requested')).not.toBeVisible();
});

test('the requester can cancel their own pending edit without a second approver', async ({
  page,
}) => {
  const title = `E2E Dual Approval Cancel ${Date.now()}`;
  await addTransaction(page, title, '40.00');

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('Edit transaction').click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel(/^Amount/).fill('55.00');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();
  await expect(row.getByText('Awaiting Approval')).toBeVisible();

  await row.getByRole('button', { name: 'Cancel' }).click();

  await expect(row.getByText('-$40.00')).toBeVisible();
  await expect(row.getByText('Awaiting Approval')).not.toBeVisible();
});

test('deleting a transaction requires a second approver to sign off', async ({
  page,
  browser,
}) => {
  const title = `E2E Dual Approval Delete ${Date.now()}`;
  await addTransaction(page, title, '15.00');

  const row = page.getByRole('row', { name: new RegExp(title) });
  await row.getByLabel('Delete transaction').click();
  await expect(page.getByText(/Submit a delete request for/)).toBeVisible();
  await page.getByText('Submit Request').click();

  await expect(row.getByText('Delete requested')).toBeVisible();
  await expect(row.getByText('Awaiting Approval')).toBeVisible();

  const contextB = await browser.newContext({ storageState: AUTH_STATE_PATH_2 });
  const pageB = await contextB.newPage();
  await pageB.goto('/dashboard');
  const rowB = pageB.getByRole('row', { name: new RegExp(title) });
  await rowB.getByRole('button', { name: 'Approve' }).click();

  await expect(pageB.getByRole('row', { name: new RegExp(title) })).toHaveCount(0);
  await contextB.close();

  await expect(page.getByRole('row', { name: new RegExp(title) })).toHaveCount(0);
});
