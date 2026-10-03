-- SOFO has discontinued the debit card Inventory Control Number, so the app
-- no longer collects or prints it (the reconciliation form's field is left
-- blank). Drops the column added in 0011 along with any values saved in it.

alter table organizations drop column debit_card_icn;
