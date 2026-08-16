-- SOFO Project ID, alongside the existing account number/ICN fields used to
-- pre-fill the official SOFO debit card reconciliation form (#22, see
-- 0011_debit_card_settings.sql).

alter table organizations add column if not exists debit_card_project_id text;
