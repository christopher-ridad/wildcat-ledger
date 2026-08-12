-- Org-level debit card info needed to pre-fill the official SOFO debit card
-- reconciliation form (#22) -- account number, last 4 digits, inventory
-- control number, and the card's load balance (the fixed limit, distinct
-- from the live running balance in budget_allocations).
--
-- Plain columns, not specially encrypted: last-4-digits and the ICN aren't
-- the full card number, and Postgres/Supabase already encrypts data at rest
-- the same way it does for every other column here (emails, notes, etc.).

alter table organizations add column if not exists debit_card_account_number text;
alter table organizations add column if not exists debit_card_last_four text;
alter table organizations add column if not exists debit_card_icn text;
alter table organizations add column if not exists debit_card_load_balance numeric;
