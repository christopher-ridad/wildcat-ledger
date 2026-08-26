import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.e2e') });

// Shared with the spec files so they know what org/user they're running
// against, and where the authenticated storage state lives.
export const E2E_EMAIL = 'e2e-treasurer@example.com';
// A second SOFO approver -- needed to test the dual-approval workflow for
// real (nobody can approve their own request, so a single-user session can
// only ever exercise the "request" half).
export const E2E_EMAIL_2 = 'e2e-approver-2@example.com';
export const E2E_ORG_NAME = 'E2E Test Org';
export const AUTH_STATE_PATH = path.resolve(__dirname, '.auth/user.json');
export const AUTH_STATE_PATH_2 = path.resolve(__dirname, '.auth/user2.json');

// Seeds a SOFO approver + fully-configured org directly against the local
// Supabase instance (via the service role, bypassing RLS -- organizations
// have no insert policy for regular users by design, see 0001_init.sql),
// then authenticates a real browser through the same magic-link
// verification flow production users go through (skipping only the
// "check your email" step, since we mint the link via the admin API
// instead of an inbox) and saves the resulting session for every spec to
// reuse via Playwright's `storageState`.
export default async function globalSetup() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Is .env.e2e present, ' +
        'and is `npx supabase start` running?',
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clean slate: drop any org left over from a previous local run (cascades
  // to its transactions/audit_log/pending_changes via FK).
  await admin.from('organizations').delete().eq('name', E2E_ORG_NAME);

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: E2E_ORG_NAME,
      // sofo_approvers grants the same "manager" permissions the old
      // treasurer/president/admins columns did before they were merged
      // (see migration 0018) -- SOFO itself doesn't distinguish which title
      // processed a club's paperwork, just that an approver did. Two
      // approvers so the dual-approval spec can exercise a real second
      // sign-off instead of just the "request" half.
      sofo_approvers: [E2E_EMAIL, E2E_EMAIL_2],
      is_budget_lines_set: true,
      // Generous balances so outflow specs don't trip the overdraft-warning
      // flow; that flow gets its own dedicated coverage instead.
      budget_allocations: {
        ASG: 10000,
        Operating: 10000,
        Gifts: 10000,
        'Debit Card': 10000,
      },
    })
    .select()
    .single();
  if (orgError || !org) {
    throw new Error(`Failed to seed the e2e test org: ${orgError?.message}`);
  }

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4173';

  // Finds-or-creates the given user, authenticates a real browser through
  // the same magic-link flow production users go through (skipping only the
  // "check your email" step, since the link is minted via the admin API
  // instead of an inbox), and saves the resulting session to storageStatePath
  // for specs to reuse.
  const authenticateUser = async (email: string, storageStatePath: string) => {
    let userId: string | undefined;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created?.user) {
      userId = created.user.id;
    } else if (createError) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === email)?.id;
    }
    if (!userId) {
      throw new Error(
        `Failed to find or create the e2e test user ${email}: ${createError?.message}`,
      );
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${baseURL}/login` },
    });
    if (linkError || !linkData) {
      throw new Error(
        `Failed to generate a magic link for ${email}: ${linkError?.message}`,
      );
    }

    const browser = await chromium.launch();
    const page = await browser.newPage({ baseURL });
    await page.goto(linkData.properties.action_link);
    // AuthContext picks up the session from the redirect URL and LoginPage
    // navigates away once `user` is set.
    await page.waitForURL('**/organizations', { timeout: 15_000 });
    await page.getByText(E2E_ORG_NAME).click();
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    await page.context().storageState({ path: storageStatePath });
    await browser.close();
  };

  await authenticateUser(E2E_EMAIL, AUTH_STATE_PATH);
  await authenticateUser(E2E_EMAIL_2, AUTH_STATE_PATH_2);
}
