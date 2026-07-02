/**
 * Dev convenience: generates a magic-link sign-in URL via the Admin API
 * without sending an email, so you can test login while the default SMTP
 * rate limit is exhausted. Open the printed link in your browser.
 *
 * Run with:  node scripts/devLogin.mjs you@example.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/devLogin.mjs you@example.com');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email,
});

if (error) {
  console.error(error);
  process.exit(1);
}

console.log('\nOpen this link in your browser to sign in:\n');
console.log(data.properties.action_link);
