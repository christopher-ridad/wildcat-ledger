/**
 * Reads club_officers.csv and creates/updates each club in Supabase with:
 *   president: [email, ...]
 *   treasurer: [email, ...]
 *   officers:  [email, ...]
 *
 * Run with:  node scripts/importAdmins.mjs path/to/club_officers.csv
 *       or:  CLUB_OFFICERS_CSV=path/to/club_officers.csv node scripts/importAdmins.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import { createReadStream } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const csvPath = process.argv[2] ?? process.env.CLUB_OFFICERS_CSV;

if (!csvPath) {
  console.error(
    'Usage: node scripts/importAdmins.mjs path/to/club_officers.csv\n' +
      '   or: CLUB_OFFICERS_CSV=path/to/club_officers.csv node scripts/importAdmins.mjs',
  );
  process.exit(1);
}

function decodeHTML(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// Read CSV → { clubName: { presidents: Set, treasurers: Set, officers: Set } }
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const clubs = {};
    createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row) => {
        const name = decodeHTML(row.club_name?.trim() || '');
        const email = row.email?.trim();
        const role = row.role?.trim().toLowerCase();
        if (!name || !email) return;

        if (!clubs[name]) {
          clubs[name] = { presidents: new Set(), treasurers: new Set(), officers: new Set() };
        }

        if (role === 'president') clubs[name].presidents.add(email);
        else if (role === 'treasurer') clubs[name].treasurers.add(email);
        else clubs[name].officers.add(email);
      })
      .on('end', () => resolve(clubs))
      .on('error', reject);
  });
}

async function importAdmins() {
  console.log('Reading CSV...');
  const clubs = await readCSV(csvPath);
  const clubNames = Object.keys(clubs);
  console.log(`Found ${clubNames.length} clubs.\n`);

  let created = 0,
    updated = 0;

  for (const clubName of clubNames) {
    const { presidents, treasurers, officers } = clubs[clubName];
    const fields = {
      president: Array.from(presidents),
      treasurer: Array.from(treasurers),
      officers: Array.from(officers),
    };

    const { data: existing, error: selectError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', clubName)
      .maybeSingle();
    if (selectError) throw selectError;

    if (existing) {
      const { error } = await supabase
        .from('organizations')
        .update(fields)
        .eq('id', existing.id);
      if (error) throw error;
      console.log(
        `  ✓ updated: ${clubName} — ${fields.president.length} presidents, ${fields.treasurer.length} treasurers, ${fields.officers.length} officers`,
      );
      updated++;
    } else {
      const { error } = await supabase.from('organizations').insert({
        name: clubName,
        ...fields,
        budget_allocations: { ASG: 0, Operating: 0, Gifts: 0, 'Debit Card': 0 },
        is_budget_lines_set: false,
      });
      if (error) throw error;
      console.log(
        `  + created: ${clubName} — ${fields.president.length} presidents, ${fields.treasurer.length} treasurers, ${fields.officers.length} officers`,
      );
      created++;
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
  process.exit(0);
}

importAdmins().catch((err) => {
  console.error(err);
  process.exit(1);
});
