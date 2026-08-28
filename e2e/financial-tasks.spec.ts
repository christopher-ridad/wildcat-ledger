import { expect, test } from '@playwright/test';

import { E2E_EMAIL, E2E_EMAIL_2 } from './global-setup';

// End-to-end coverage for the Financial Tasks feature (src/features/tasks) --
// previously zero e2e coverage existed for it. Unit tests already cover the
// quarter-bucketing math and the form's client-side validation in isolation
// (see groupTasksByQuarter.test.ts / TaskFormModal.test.tsx), so this file
// focuses on what actually needs a real browser + real Supabase/RLS to
// verify: that a task round-trips through the real financial_tasks table,
// and -- the one piece of this feature's logic complex enough to be worth
// checking against a real database rather than only a mocked client -- that
// syncFinancialTaskRequirements' diff-by-key upsert genuinely keeps an
// overlapping requirement's completed_at across a payment-type change,
// rather than that behavior only holding true against a hand-rolled mock.

// Quarter tabs are keyed to the CURRENT academic year (Sep 23 -> Jun 11,
// see isDateInSupportedQuarter), which shifts forward every July -- so
// derive due dates from the real current date the same way the app itself
// does (academicYearStartOf) instead of hardcoding a year that would go
// stale.
const now = new Date();
const currentYearStart =
  now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
const FALL_DUE_DATE = `${currentYearStart}-10-01`;
const SPRING_DUE_DATE = `${currentYearStart + 1}-05-01`;

// TaskRow's root element is a CSS Modules class, so its rendered class
// attribute is the literal name plus a build hash (e.g.
// "wl-task-row_oma1s_1 wl-task-row--complete_oma1s_91") rather than the
// exact "wl-task-row" App.css's global classes use elsewhere in this suite.
// The trailing underscore keeps this from also matching modifier classes
// like "wl-task-row--complete_..." or "wl-task-row-header_...".
const taskRow = (page: import('@playwright/test').Page, title: string) =>
  page.locator('[class*="wl-task-row_"]', { hasText: title });

test.beforeEach(async ({ page }) => {
  await page.goto('/timeline');
  await expect(page.getByRole('heading', { name: 'Financial Tasks' })).toBeVisible();
});

test('creating, editing, completing, and deleting a task', async ({ page }) => {
  const title = `E2E Task ${Date.now()}`;
  const updatedTitle = `${title} (updated)`;

  await page.getByRole('button', { name: '+ Add Task' }).click();
  const addDialog = page.getByRole('dialog');
  await addDialog.getByLabel('Title').fill(title);
  await addDialog.getByLabel('Due Date').fill(FALL_DUE_DATE);
  await addDialog.getByRole('button', { name: 'Save' }).click();
  await expect(addDialog).toBeHidden();

  const row = taskRow(page, title);
  await expect(row).toBeVisible();
  await expect(row.getByText(`Due ${FALL_DUE_DATE}`)).toBeVisible();

  // Edit: rename it.
  await row.getByText(title, { exact: true }).click();
  await row.getByRole('button', { name: `Edit ${title}` }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('Title').fill(updatedTitle);
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(editDialog).toBeHidden();

  const updatedRow = taskRow(page, updatedTitle);
  await expect(updatedRow).toBeVisible();

  // Complete: the checkbox is keyed off the task's current title.
  const checkbox = updatedRow.getByRole('checkbox', {
    name: `Mark ${updatedTitle} as complete`,
  });
  await expect(checkbox).not.toBeChecked();
  // This checkbox's checked state is controlled by the task's completedAt
  // column, which only flips after the toggle mutation round-trips through
  // Supabase -- .check()'s own built-in post-click verification is too
  // fast for that, so click and then poll with an auto-retrying assertion
  // instead.
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  // Delete.
  await updatedRow.getByText(updatedTitle, { exact: true }).click();
  await updatedRow.getByRole('button', { name: `Delete ${updatedTitle}` }).click();
  await expect(taskRow(page, updatedTitle)).toHaveCount(0);
});

test('quarter tabs isolate tasks by due date', async ({ page }) => {
  const fallTitle = `E2E Fall Task ${Date.now()}`;
  const springTitle = `E2E Spring Task ${Date.now()}`;

  for (const [title, dueDate] of [
    [fallTitle, FALL_DUE_DATE],
    [springTitle, SPRING_DUE_DATE],
  ] as const) {
    await page.getByRole('button', { name: '+ Add Task' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill(title);
    await dialog.getByLabel('Due Date').fill(dueDate);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
  }

  await page.getByRole('tab', { name: 'Fall Quarter' }).click();
  await expect(taskRow(page, fallTitle)).toBeVisible();
  await expect(taskRow(page, springTitle)).toHaveCount(0);

  await page.getByRole('tab', { name: 'Spring Quarter' }).click();
  await expect(taskRow(page, springTitle)).toBeVisible();
  await expect(taskRow(page, fallTitle)).toHaveCount(0);
});

test('assigning multiple roster members shows both once expanded', async ({ page }) => {
  const title = `E2E Multi-Assignee ${Date.now()}`;

  await page.getByRole('button', { name: '+ Add Task' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill(title);
  await dialog.getByLabel('Due Date').fill(FALL_DUE_DATE);
  await dialog.getByRole('checkbox', { name: E2E_EMAIL }).check();
  await dialog.getByRole('checkbox', { name: E2E_EMAIL_2 }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  const row = taskRow(page, title);
  await row.getByText(title, { exact: true }).click();
  await expect(row.getByText(`Assigned to: ${E2E_EMAIL}, ${E2E_EMAIL_2}`)).toBeVisible();
});

// This is the one part of the feature complex enough to need real-database
// coverage: syncFinancialTaskRequirements diffs by key rather than blindly
// wiping and regenerating, so a requirement key present both before and
// after a payment-type change should keep its checked state, while one no
// longer needed should disappear and a newly-needed one should show up
// unchecked.
test("changing a task's payment type keeps overlapping requirements and drops stale ones", async ({
  page,
}) => {
  const title = `E2E Requirements ${Date.now()}`;

  await page.getByRole('button', { name: '+ Add Task' }).click();
  const addDialog = page.getByRole('dialog');
  await addDialog.getByLabel('Title').fill(title);
  await addDialog.getByLabel('Due Date').fill(FALL_DUE_DATE);
  await addDialog.getByLabel('Payment Type (optional)').selectOption('Payment Request');
  await addDialog.getByLabel('Is this an individual vendor?').check();
  await addDialog.getByRole('button', { name: 'Save' }).click();
  await expect(addDialog).toBeHidden();

  const row = taskRow(page, title);
  await row.getByText(title, { exact: true }).click();
  await expect(row.getByText('RSO Agreement')).toBeVisible();
  await expect(row.getByText('W-9')).toBeVisible();
  await expect(row.getByText('Contracted Services Form')).toBeVisible();
  await expect(row.getByText('Conflict of Interest Form')).toBeVisible();

  // Check off one of the requirements that Payment to NU Employee (below)
  // also needs -- this is the one the diff-sync should preserve. Same
  // async-controlled-checkbox reasoning as the completion checkbox above:
  // click, then poll rather than relying on .check()'s own verification.
  await row.getByRole('checkbox', { name: 'RSO Agreement' }).click();
  await expect(row.getByRole('checkbox', { name: 'RSO Agreement' })).toBeChecked();

  await row.getByRole('button', { name: `Edit ${title}` }).click();
  const editDialog = page.getByRole('dialog');
  await editDialog
    .getByLabel('Payment Type (optional)')
    .selectOption('Payment to NU Employee');
  await editDialog.getByRole('button', { name: 'Save' }).click();
  await expect(editDialog).toBeHidden();

  await row.getByText(title, { exact: true }).click();
  // Contract/W-9 are shared between Payment Request and Payment to NU
  // Employee -- kept, and RSO Agreement's checked state survives.
  await expect(row.getByRole('checkbox', { name: 'RSO Agreement' })).toBeChecked();
  await expect(row.getByRole('checkbox', { name: 'W-9' })).not.toBeChecked();
  // Special Pay Form is newly required, unchecked.
  await expect(row.getByRole('checkbox', { name: 'Special Pay Form' })).toBeVisible();
  await expect(row.getByRole('checkbox', { name: 'Special Pay Form' })).not.toBeChecked();
  // No longer required by Payment to NU Employee -- removed entirely.
  await expect(row.getByText('Contracted Services Form')).toHaveCount(0);
  await expect(row.getByText('Conflict of Interest Form')).toHaveCount(0);
});

test('the due date field only accepts the current academic year, September 23 to June 11', async ({
  page,
}) => {
  await page.getByRole('button', { name: '+ Add Task' }).click();
  const dialog = page.getByRole('dialog');
  const dueDateInput = dialog.getByLabel('Due Date');

  await expect(dueDateInput).toHaveAttribute('min', `${currentYearStart}-09-23`);
  await expect(dueDateInput).toHaveAttribute('max', `${currentYearStart + 1}-06-11`);

  // July is always outside the supported range, regardless of when this
  // test runs.
  await dueDateInput.fill(`${currentYearStart}-07-15`);
  await expect(
    dialog.getByText(/Due date must fall between September 23 and June 11/),
  ).toBeVisible();
  await expect(dueDateInput).toHaveValue('');
});
