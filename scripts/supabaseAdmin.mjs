/**
 * Shared service-role Supabase client for the standalone scripts in this
 * directory (backupLedger, devLogin, importAdmins) -- each previously
 * loaded .env and constructed this client independently.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

export const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
