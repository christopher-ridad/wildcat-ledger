/**
 * Reads club_officers.csv (with a president/treasurer/other `role` column
 * per row) and creates/updates each club in Supabase with:
 *   sofo_approvers: [president email, ..., treasurer email, ...]
 *   officers:       [email, ...]
 *
 * Also upserts every {email, name} pair it sees into the `people` directory
 * table (display names only -- unrelated to org membership/permissions).
 * Reads a name per row either from a combined `name` column or separate
 * `first_name`/`last_name` columns, whichever the CSV has; rows with
 * neither are skipped (that email just displays as-is in the app).
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

function personName(row) {
  const combined = row.name?.trim();
  if (combined) return decodeHTML(combined);
  const first = row.first_name?.trim();
  const last = row.last_name?.trim();
  const joined = [first, last].filter(Boolean).join(' ');
  return joined ? decodeHTML(joined) : '';
}

// Read CSV → { clubs: { clubName: { presidents: Set, treasurers: Set, officers: Set } },
//              people: Map<email, name> } (people is global, not per-club --
//              the directory table isn't org-scoped)
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const clubs = {};
    const people = new Map();
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

        const fullName = personName(row);
        if (fullName) people.set(email, fullName);
      })
      .on('end', () => resolve({ clubs, people }))
      .on('error', reject);
  });
}

async function importAdmins() {
  console.log('Reading CSV...');
  const { clubs, people } = await readCSV(csvPath);
  const clubNames = Object.keys(clubs);
  console.log(`Found ${clubNames.length} clubs.\n`);

  let created = 0,
    updated = 0;

  for (const clubName of clubNames) {
    const { presidents, treasurers, officers } = clubs[clubName];
    const fields = {
      sofo_approvers: [...Array.from(presidents), ...Array.from(treasurers)],
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
        `  ✓ updated: ${clubName} — ${fields.sofo_approvers.length} SOFO approvers, ${fields.officers.length} officers`,
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
        `  + created: ${clubName} — ${fields.sofo_approvers.length} SOFO approvers, ${fields.officers.length} officers`,
      );
      created++;
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);

  if (people.size > 0) {
    const peopleRows = Array.from(people, ([email, name]) => ({ email, name }));
    const { error } = await supabase
      .from('people')
      .upsert(peopleRows, { onConflict: 'email' });
    if (error) throw error;
    console.log(`Upserted ${peopleRows.length} names into the people directory.`);
  }

  process.exit(0);
}

importAdmins().catch((err) => {
  console.error(err);
  process.exit(1);
});
