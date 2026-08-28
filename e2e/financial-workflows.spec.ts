import { expect, Page, test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

import { AUTH_STATE_PATH_2 } from './global-setup';

// End-to-end coverage for the core financial workflow rules in
// docs/BUSINESS_RULES.md -- dual-approval, payment-status/balance timing,
// and debit-card reconciliation, in that doc's own order. Unlike the
// component tests for these same rules, nothing here mocks Supabase: every
// assertion is against a real RLS policy or Postgres function, which is the
// only layer that can catch a bug like an RLS allow-list-vs-deny-list
// mistake or an integer overflow -- both real bugs this project has hit
// that were invisible to a mocked-client unit test.
//
// Run serially, not in parallel: the balance-timing and reconciliation
// tests both read-then-assert-a-delta against the same shared org's Debit
// Card budget line, and reconciliation additionally reads the *entire*
// unreconciled list -- two of these running concurrently can genuinely
// race each other (confirmed directly: a Debit Card purchase created by
// one test while another was mid-poll threw its balance-delta assertion
// off by exactly the other test's amount). Correctness over wall-clock
// time for tests about money.
test.describe.configure({ mode: 'serial' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RSO_AGREEMENT_PDF = path.resolve(__dirname, '../public/forms/rso-agreement.pdf');
const W9_PDF = path.resolve(__dirname, '../public/forms/w9.pdf');
// A real PDF, standing in for a signed exemption form -- content doesn't
// matter, only that it's a real file the upload actually has to move
// through Storage and back.
const SAMPLE_PDF = W9_PDF;

// ─── docs/BUSINESS_RULES.md#dual-approval-workflow ──────────────────────
// This is the core rule the app exists to enforce -- an amount/type/
// budget-line edit or a delete always needs a second SOFO Approver's
// sign-off, and nobody can approve their own request. A single-session
// test can only ever exercise the "request" half of that, so these specs
// open a second authenticated browser context (a real second approver,
// seeded in global-setup) to exercise the actual second-person
// enforcement, not just the UI around it.

// Non-Officer Reimbursement, deliberately -- not Debit Card. A Debit Card
// purchase left with no receipt sits in the shared seeded org forever,
// blocking the reconciliation test below (ReconciliationModal hides ALL
// checkboxes while *any* unreconciled debit card transaction is uncovered,
// not just the one under test). These transactions have nothing to do with
// reconciliation, so keep them off that budget line entirely.
const addReimbursement = async (page: Page, title: string, amount: string) => {
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
  await addReimbursement(page, title, '10.00');

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
  await addReimbursement(page, title, '30.00');

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
  await addReimbursement(page, title, '40.00');

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
  await addReimbursement(page, title, '15.00');

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

// ─── docs/BUSINESS_RULES.md#payment-status-lifecycle ────────────────────
// Payment Request / Reimbursement / NU-Employee / reload amounts are
// deliberately deferred -- they shouldn't hit the budget line's balance
// until they reach Paid, since the money hasn't actually gone out while
// still Pending or Approved. BUSINESS_RULES.md's own historical note
// describes this exact rule having broken in production before (every
// transaction counted immediately regardless of status), so it's worth
// verifying against the real update_payment_status_with_audit function
// rather than trusting a mock.

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
  // (rather than acknowledged missing, as transactions.spec.ts's
  // missing-documents test uses) since this test needs the Approved/Paid
  // transition to actually succeed -- update_payment_status_with_audit
  // blocks it otherwise.
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

// ─── docs/BUSINESS_RULES.md#debit-card-reconciliation ───────────────────
// A purchase can only be reconciled once "covered" (a real receipt or
// exemption form actually uploaded to Storage -- not just a client-side
// flag), enforced by reconcile_transactions_with_audit. Reconciling it
// doesn't freeze it, though -- a correction afterward goes through the
// same dual-approval rule as any other transaction (see the next test).
test('reconciling a covered debit card purchase', async ({ page }) => {
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
  // listed transaction has a receipt or exemption form, not just this one.
  // Other tests sharing this seeded org can leave their own uncovered
  // debit card transactions behind, which would block this test too if
  // only this item got covered -- so cover every uncovered item currently
  // listed. The file input is always present once an item is missing its
  // receipt (the visible button just programmatically clicks it), so
  // upload directly to each one rather than clicking through the button
  // first.
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

  await expect(row.getByText('Reconciled', { exact: true })).toBeVisible();
});

// See docs/BUSINESS_RULES.md#dual-approval-workflow -- reconciled
// transactions aren't a special case, they go through the same rule as
// everything else. An amount change still needs a second approver; it
// isn't blocked outright the way it used to be, and it isn't applied
// unilaterally either.
test('correcting a reconciled debit card transaction still needs a second approver', async ({
  page,
  browser,
}) => {
  const title = `E2E Reconciled Correction ${Date.now()}`;

  await page.goto('/dashboard');
  await page.getByRole('button', { name: '+ Add Transaction' }).click();
  const addDialog = page.getByRole('dialog');
  await addDialog.getByLabel(/^Title/).fill(title);
  await addDialog.getByLabel(/^Amount/).fill('20.00');
  await addDialog.getByLabel('Receipt Photo').setInputFiles(SAMPLE_PDF);
  await addDialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(addDialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(title) });
  await expect(row.getByText('Not Reconciled')).toBeVisible();

  await page.getByRole('button', { name: 'Reconcile Debit Card' }).click();
  const reconDialog = page.getByRole('dialog');

  // This transaction already has its receipt attached, but another test
  // sharing this seeded org can leave an uncovered debit card transaction
  // behind, which hides every checkbox and disables Confirm until it's
  // covered too -- same defensive covering as the reconciliation test
  // above.
  const fileInputs = await reconDialog.locator('input[type="file"]').all();
  for (const input of fileInputs) {
    await input.setInputFiles(SAMPLE_PDF);
  }
  await reconDialog.getByRole('button', { name: /Confirm & Reconcile/ }).click();
  await expect(reconDialog.getByText('Reconciliation complete!')).toBeVisible();
  await reconDialog.getByRole('button', { name: 'Done' }).click();
  await expect(reconDialog).toBeHidden();
  await expect(row.getByText('Reconciled', { exact: true })).toBeVisible();

  // Edit/Delete are still there -- reconciliation isn't a dead end.
  await row.getByLabel('Edit transaction').click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel(/^Amount/).fill('35.00');
  await editDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(editDialog).toBeHidden();

  // Amount changes still need a second approver -- not applied directly,
  // and not blocked outright either.
  await expect(row.getByText('Edit Requested')).toBeVisible();
  await expect(row.getByText('-$20.00')).toBeVisible();

  const contextB = await browser.newContext({ storageState: AUTH_STATE_PATH_2 });
  const pageB = await contextB.newPage();
  await pageB.goto('/dashboard');
  const rowB = pageB.getByRole('row', { name: new RegExp(title) });
  await rowB.getByRole('button', { name: 'Approve' }).click();

  await expect(rowB.getByText('-$35.00')).toBeVisible();
  await expect(rowB.getByText('Reconciled', { exact: true })).toBeVisible();
  await contextB.close();

  await expect(row.getByText('-$35.00')).toBeVisible();
});
